#!/usr/bin/env python3
"""
Standalone indexer for CityForge that crawls business card websites
and indexes them into OpenSearch for full-text search.

This version works without the Flask backend by:
- Fetching cards from the Next.js API
- Using direct Postgres connection for progress tracking (optional)
"""

from __future__ import annotations

import argparse
import ipaddress
import logging
import os
import socket
import time
from collections import deque
from datetime import UTC, datetime
from hashlib import sha256
from typing import TYPE_CHECKING, Any, cast
from urllib.parse import urldefrag, urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from opensearchpy import OpenSearch

# Database imports (optional - for progress tracking)
try:
    import psycopg

    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False
    print("Warning: psycopg not installed. Progress tracking will be disabled.")

from config import IndexerConfig

if TYPE_CHECKING:
    from psycopg import Connection

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


class ResourceIndexer:
    def __init__(self, use_tracking: bool = True) -> None:
        self.opensearch_host = os.getenv("OPENSEARCH_HOST", "opensearch-service")
        self.opensearch_port = int(os.getenv("OPENSEARCH_PORT", "9200"))
        self.opensearch_use_https = os.getenv("OPENSEARCH_USE_HTTPS", "false").lower() == "true"
        self.namespace = os.getenv("NAMESPACE", "default")
        opensearch_username = os.getenv("OPENSEARCH_USERNAME", "")
        opensearch_password = os.getenv("OPENSEARCH_PASSWORD", "")
        http_auth: tuple[str, str] | None = None
        if opensearch_username:
            http_auth = (opensearch_username, opensearch_password)

        # Use Next.js API endpoint instead of Flask backend
        # Use Next.js API endpoint - check BACKEND_URL first, then API_URL for backward compatibility
        backend_url = os.getenv("BACKEND_URL", os.getenv("API_URL", "http://frontend:3000"))
        # Ensure we have the /api path for the API endpoints
        if not backend_url.endswith("/api"):
            backend_url = f"{backend_url}/api"
        self.api_url = backend_url

        # Initialize OpenSearch client
        self.client = OpenSearch(
            hosts=[
                {
                    "host": self.opensearch_host,
                    "port": self.opensearch_port,
                    "scheme": "https" if self.opensearch_use_https else "http",
                }
            ],
            http_auth=http_auth,
            use_ssl=self.opensearch_use_https,
            verify_certs=self.opensearch_use_https,
            connection_class=None,
        )

        # Index name based on namespace for isolation
        self.index_name = f"{self.namespace}-resources"

        # Cache for robots.txt parsers to avoid repeated fetches
        self.robots_cache: dict[str, RobotFileParser] = {}

        # User agent for robots.txt compliance
        self.user_agent = IndexerConfig.USER_AGENT

        # Initialize database connection for tracking (optional)
        self.use_tracking = use_tracking and HAS_PSYCOPG
        self.db_conn: Connection[Any] | None = None
        if self.use_tracking:
            try:
                db_url = self._build_database_url()
                self.db_conn = psycopg.connect(db_url)
                logger.info("Database tracking enabled")
            except Exception as e:
                logger.warning(f"Could not connect to database for tracking: {e}")
                self.use_tracking = False

    def _build_database_url(self) -> str:
        """Build database URL from environment variables"""
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            return database_url

        user = os.getenv("POSTGRES_USER", "postgres")
        password = os.getenv("POSTGRES_PASSWORD", "")
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        database = os.getenv("POSTGRES_DB", "cityforge")

        return f"postgresql://{user}:{password}@{host}:{port}/{database}"

    @staticmethod
    def _is_reserved_ip(address: str) -> bool:
        """Return True if the resolved IP address is non-public or reserved."""
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            return True
        return bool(
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )

    def _is_safe_url(self, url: str) -> bool:
        """Return True if the URL is a public HTTP(S) URL with no internal target.

        This guard prevents Server-Side Request Forgery (SSRF) by rejecting
        private/reserved IP ranges, link-local addresses, and common internal
        hostnames before any outbound request is made.
        """
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return False
        if not parsed.netloc:
            return False

        hostname = parsed.hostname
        if hostname is None:
            return False

        hostname_lower = hostname.lower()
        if hostname_lower in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
            return False
        if hostname_lower.endswith(".local") or hostname_lower.endswith(".localhost"):
            return False

        try:
            addrinfo = socket.getaddrinfo(hostname, None)
        except socket.gaierror:
            logger.debug(f"Could not resolve hostname for SSRF check: {hostname}")
            return False

        resolved_ips: set[str] = {cast(str, info[4][0]) for info in addrinfo}
        for ip in resolved_ips:
            if self._is_reserved_ip(ip):
                logger.warning(f"Blocked potential SSRF URL {url} (resolved to {ip})")
                return False
        return True

    @staticmethod
    def _index_properties() -> dict[str, dict[str, str]]:
        return {
            "resource_id": {"type": "integer"},
            "business_name": {"type": "text"},
            "title": {"type": "text"},
            "description": {"type": "text"},
            "page_description": {"type": "text"},
            "content": {"type": "text"},
            "tags": {"type": "text"},
            "contact_name": {"type": "text"},
            "url": {"type": "keyword"},
            "page_url": {"type": "keyword"},
            "category": {"type": "keyword"},
            "phone": {"type": "keyword"},
            "address": {"type": "text"},
            "domain": {"type": "keyword"},
            "featured": {"type": "boolean"},
            "is_homepage": {"type": "boolean"},
            "indexed_at": {"type": "date"},
        }

    def get_robots_parser(self, base_domain: str) -> RobotFileParser:
        """Get or create a robots.txt parser for the given domain"""
        if base_domain in self.robots_cache:
            return self.robots_cache[base_domain]

        robots_url = urljoin(base_domain, "/robots.txt")
        if not self._is_safe_url(robots_url):
            logger.warning(f"robots.txt URL blocked by SSRF guard: {robots_url}")
            rp = RobotFileParser()
            rp.set_url(robots_url)
            self.robots_cache[base_domain] = rp
            return rp

        try:
            response = requests.get(
                robots_url,
                timeout=IndexerConfig.ROBOTS_TXT_TIMEOUT,
                allow_redirects=False,
                headers={"User-Agent": self.user_agent},
            )
            response.raise_for_status()

            rp = RobotFileParser()
            rp.set_url(robots_url)
            rp.parse(response.text.splitlines())

            self.robots_cache[base_domain] = rp
            logger.info(f"Loaded robots.txt for {base_domain}")
            return rp
        except Exception as e:
            logger.debug(f"Could not load robots.txt for {base_domain}: {e}")
            # Create a permissive parser if robots.txt is not available
            rp = RobotFileParser()
            rp.set_url(robots_url)
            self.robots_cache[base_domain] = rp
            return rp

    def is_url_allowed(self, url: str) -> bool:
        """Check if URL is allowed by robots.txt"""
        try:
            parsed_url = urlparse(url)
            base_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"

            rp = self.get_robots_parser(base_domain)
            return rp.can_fetch(self.user_agent, url)
        except Exception as e:
            logger.debug(f"Error checking robots.txt for {url}: {e}")
            # If we can't check, be conservative and allow it
            return True

    def _normalize_page_url(self, url: str | None) -> str:
        """Normalize URLs for crawl deduplication and result links."""
        if not url:
            return ""
        url, _fragment = urldefrag(url)
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return ""
        normalized = parsed._replace(
            scheme=parsed.scheme.lower(),
            netloc=parsed.netloc.lower(),
            path=parsed.path or "/",
        )
        return urlunparse(normalized)

    def _extract_internal_links(
        self, soup: BeautifulSoup, current_url: str, site_netloc: str
    ) -> list[str]:
        """Extract same-site HTTP links from a page."""
        links: list[str] = []
        seen: set[str] = set()
        for anchor in soup.find_all("a", href=True):
            href = cast(str, anchor["href"])
            candidate = self._normalize_page_url(urljoin(current_url, href))
            if not candidate:
                continue
            parsed = urlparse(candidate)
            if parsed.netloc != site_netloc:
                continue
            if parsed.path.lower().endswith(
                (
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".gif",
                    ".svg",
                    ".webp",
                    ".pdf",
                    ".zip",
                    ".xml",
                    ".json",
                    ".txt",
                )
            ):
                continue
            if candidate in seen:
                continue
            seen.add(candidate)
            links.append(candidate)
        return links

    def fetch_cards(self) -> list[dict[str, Any]]:
        """Fetch business cards from the Next.js API"""
        try:
            # Fetch all cards from the API
            url = f"{self.api_url}/cards?limit=1000"
            logger.info(f"Fetching cards from {url}")

            response = requests.get(
                url,
                timeout=IndexerConfig.REQUEST_TIMEOUT,
                headers={
                    # The app sits behind TLS-terminating ingress in production and
                    # redirects plain HTTP unless the forwarded scheme is trusted.
                    "X-Forwarded-Proto": "https",
                },
            )
            response.raise_for_status()

            data = response.json()
            cards: list[dict[str, Any]] = data.get("cards", [])

            logger.info(f"Fetched {len(cards)} cards from API")
            return cards
        except Exception as e:
            logger.error(f"Error fetching cards from API: {e}")
            return []

    def scrape_page_content(self, url: str, max_retries: int = 3) -> dict[str, Any]:
        """Scrape content from a webpage with retries"""
        normalized_url = self._normalize_page_url(url) or url
        if not self._is_safe_url(url):
            logger.warning(f"URL blocked by SSRF guard: {url}")
            return {
                "content": "",
                "page_title": "",
                "page_description": "",
                "page_url": normalized_url,
                "links": [],
            }
        if not self.is_url_allowed(url):
            logger.info(f"URL not allowed by robots.txt: {url}")
            return {
                "content": "",
                "page_title": "",
                "page_description": "",
                "page_url": normalized_url,
                "links": [],
            }

        for attempt in range(max_retries):
            try:
                headers = {
                    "User-Agent": f"Mozilla/5.0 (compatible; {self.user_agent}; +{IndexerConfig.USER_AGENT_URL})"
                }

                response = requests.get(
                    url,
                    headers=headers,
                    timeout=IndexerConfig.SCRAPE_TIMEOUT,
                    allow_redirects=False,
                )
                response.raise_for_status()

                soup = BeautifulSoup(response.text, "html.parser")
                page_url = self._normalize_page_url(response.url) or normalized_url

                # Extract page title
                page_title = ""
                if soup.title:
                    page_title = soup.title.string.strip() if soup.title.string else ""

                # Extract meta description
                page_description = ""
                meta_desc = soup.find("meta", attrs={"name": "description"})
                if meta_desc:
                    page_description = str(meta_desc.get("content", "") or "").strip()

                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()

                # Extract text content
                text = soup.get_text()

                # Clean up text
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = " ".join(chunk for chunk in chunks if chunk)

                # Limit content length
                if len(text) > IndexerConfig.MAX_CONTENT_LENGTH:
                    text = text[: IndexerConfig.MAX_CONTENT_LENGTH] + "..."

                return {
                    "content": text,
                    "page_title": page_title,
                    "page_description": page_description,
                    "page_url": page_url,
                    "links": self._extract_internal_links(
                        soup, page_url, urlparse(page_url).netloc
                    ),
                }

            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    # Exponential backoff
                    time.sleep(IndexerConfig.RETRY_BASE_DELAY**attempt)
                else:
                    logger.error(f"Failed to scrape {url} after {max_retries} attempts")

        return {
            "content": "",
            "page_title": "",
            "page_description": "",
            "page_url": normalized_url,
            "links": [],
        }

    def scrape_site_pages(self, start_url: str) -> list[dict[str, Any]]:
        """Crawl and scrape the homepage plus same-site pages."""
        start_url = self._normalize_page_url(start_url)
        if not start_url:
            return []

        site_netloc = urlparse(start_url).netloc
        queue: deque[str] = deque([start_url])
        queued: set[str] = {start_url}
        crawled: set[str] = set()
        indexed_pages: set[str] = set()
        pages: list[dict[str, Any]] = []

        while queue and len(pages) < IndexerConfig.MAX_PAGES_PER_SITE:
            current_url = queue.popleft()
            queued.discard(current_url)
            if current_url in crawled:
                continue

            crawled.add(current_url)
            scraped = self.scrape_page_content(current_url)
            page_url = self._normalize_page_url(scraped.get("page_url")) or current_url
            crawled.add(page_url)

            if page_url not in indexed_pages:
                pages.append(scraped | {"page_url": page_url})
                indexed_pages.add(page_url)

            for link in scraped.get("links", []):
                normalized_link = self._normalize_page_url(link)
                if not normalized_link:
                    continue
                if urlparse(normalized_link).netloc != site_netloc:
                    continue
                if normalized_link in crawled or normalized_link in queued:
                    continue
                if len(pages) + len(queue) >= IndexerConfig.MAX_PAGES_PER_SITE:
                    break
                queue.append(normalized_link)
                queued.add(normalized_link)

            if queue and len(pages) < IndexerConfig.MAX_PAGES_PER_SITE:
                time.sleep(IndexerConfig.DELAY_BETWEEN_PAGES)

        return pages

    def index_resource(self, card: dict[str, Any]) -> None:
        """Index a single business card into OpenSearch"""
        try:
            card_id = card["id"]
            name = card["name"]
            website_url = card.get("website_url", "")
            normalized_website_url = self._normalize_page_url(website_url)

            if not website_url:
                logger.info(f"Skipping card {card_id} ({name}): No website URL")
                return
            if not normalized_website_url:
                logger.info(f"Skipping card {card_id} ({name}): Invalid website URL")
                return

            logger.info(f"Indexing card {card_id}: {name} - {website_url}")

            pages = self.scrape_site_pages(website_url)
            if not pages:
                pages = [
                    {
                        "content": "",
                        "page_title": "",
                        "page_description": "",
                        "page_url": normalized_website_url,
                        "links": [],
                    }
                ]

            self.client.delete_by_query(
                index=self.index_name,
                body={"query": {"term": {"resource_id": card_id}}},
                conflicts="proceed",
                refresh=True,
            )

            domain = urlparse(normalized_website_url).netloc if normalized_website_url else ""
            for page in pages:
                page_url = self._normalize_page_url(page.get("page_url")) or normalized_website_url
                is_homepage = page_url == normalized_website_url
                document = {
                    "resource_id": card_id,
                    "business_name": name,
                    "title": page.get("page_title") or name,
                    "description": card.get("description", ""),
                    "page_description": page.get("page_description", ""),
                    "content": page.get("content", ""),
                    "tags": card.get("tags", []),
                    "contact_name": card.get("contact_name", ""),
                    "url": normalized_website_url,
                    "page_url": page_url,
                    "category": "",  # Cards don't have categories in the new schema
                    "phone": card.get("phone_number", ""),
                    "address": card.get("address", ""),
                    "domain": domain,
                    "featured": card.get("featured", False),
                    "is_homepage": is_homepage,
                    "indexed_at": datetime.now(UTC).isoformat(),
                }
                document_id = (
                    f"resource_{card_id}"
                    if is_homepage
                    else f"resource_{card_id}_{sha256(page_url.encode()).hexdigest()[:12]}"
                )
                self.client.index(index=self.index_name, id=document_id, body=document)

            logger.info(f"Successfully indexed {len(pages)} page(s) for card {card_id}")

        except Exception as e:
            logger.error(f"Error indexing card {card.get('id', 'unknown')}: {e}")

    def create_index(self) -> None:
        """Create the OpenSearch index if it doesn't exist"""
        properties = self._index_properties()
        if self.client.indices.exists(index=self.index_name):
            self.client.indices.put_mapping(index=self.index_name, body={"properties": properties})
            logger.info(f"Index {self.index_name} already exists")
            return

        # Create index with mappings
        index_body = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 1,
                "analysis": {"analyzer": {"default": {"type": "standard"}}},
            },
            "mappings": {"properties": properties},
        }

        self.client.indices.create(index=self.index_name, body=index_body)
        logger.info(f"Created index {self.index_name}")

    def run(self, reindex_all: bool = False) -> None:
        """Run the indexer"""
        logger.info("Starting indexer...")

        # Create index if needed
        self.create_index()

        # Fetch cards from API
        cards = self.fetch_cards()

        if not cards:
            logger.warning("No cards found to index")
            return

        # Index each card
        total = len(cards)
        for i, card in enumerate(cards, 1):
            logger.info(f"Processing card {i}/{total}")
            self.index_resource(card)

            # Rate limiting - delay between different sites
            time.sleep(IndexerConfig.DELAY_BETWEEN_SITES)

        logger.info(f"Indexing complete. Processed {total} cards")

    def cleanup(self) -> None:
        """Cleanup resources"""
        if self.db_conn:
            self.db_conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Index business cards into OpenSearch")
    parser.add_argument(
        "--reindex-all",
        action="store_true",
        help="Reindex all resources, including previously indexed ones",
    )
    parser.add_argument(
        "--no-tracking", action="store_true", help="Disable database progress tracking"
    )

    args = parser.parse_args()

    indexer = ResourceIndexer(use_tracking=not args.no_tracking)

    try:
        indexer.run(reindex_all=args.reindex_all)
    finally:
        indexer.cleanup()


if __name__ == "__main__":
    main()
