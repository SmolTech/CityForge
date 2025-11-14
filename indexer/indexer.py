#!/usr/bin/env python3
"""
Standalone indexer for CityForge that crawls business card websites
and indexes them into OpenSearch for full-text search.

This version works without the Flask backend by:
- Fetching cards from the Next.js API
- Using direct Postgres connection for progress tracking (optional)
"""

import argparse
import os
import json
import requests
import time
from datetime import datetime, UTC
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
from opensearchpy import OpenSearch
import logging
import xml.etree.ElementTree as ET

# Database imports (optional - for progress tracking)
try:
    import psycopg
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False
    print("Warning: psycopg not installed. Progress tracking will be disabled.")

from config import IndexerConfig

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ResourceIndexer:
    def __init__(self, use_tracking=True):
        self.opensearch_host = os.getenv('OPENSEARCH_HOST', 'opensearch-service')
        self.opensearch_port = int(os.getenv('OPENSEARCH_PORT', '9200'))
        self.namespace = os.getenv('NAMESPACE', 'default')

        # Use Next.js API endpoint instead of Flask backend
        # Use Next.js API endpoint - check BACKEND_URL first, then API_URL for backward compatibility
        backend_url = os.getenv('BACKEND_URL', os.getenv('API_URL', 'http://frontend:3000'))
        # Ensure we have the /api path for the API endpoints
        if not backend_url.endswith('/api'):
            backend_url = f"{backend_url}/api"
        self.api_url = backend_url

        # Initialize OpenSearch client
        self.client = OpenSearch(
            hosts=[{'host': self.opensearch_host, 'port': self.opensearch_port}],
            http_auth=None,
            use_ssl=False,
            verify_certs=False,
            connection_class=None,
        )

        # Index name based on namespace for isolation
        self.index_name = f"{self.namespace}-resources"

        # Cache for robots.txt parsers to avoid repeated fetches
        self.robots_cache = {}

        # User agent for robots.txt compliance
        self.user_agent = IndexerConfig.USER_AGENT

        # Initialize database connection for tracking (optional)
        self.use_tracking = use_tracking and HAS_PSYCOPG
        self.db_conn = None
        if self.use_tracking:
            try:
                db_url = self._build_database_url()
                self.db_conn = psycopg.connect(db_url)
                logger.info("Database tracking enabled")
            except Exception as e:
                logger.warning(f"Could not connect to database for tracking: {e}")
                self.use_tracking = False

    def _build_database_url(self):
        """Build database URL from environment variables"""
        user = os.getenv('POSTGRES_USER', 'postgres')
        password = os.getenv('POSTGRES_PASSWORD', '')
        host = os.getenv('POSTGRES_HOST', 'localhost')
        port = os.getenv('POSTGRES_PORT', '5432')
        database = os.getenv('POSTGRES_DB', 'cityforge')

        return f"postgresql://{user}:{password}@{host}:{port}/{database}"

    def get_robots_parser(self, base_domain):
        """Get or create a robots.txt parser for the given domain"""
        if base_domain in self.robots_cache:
            return self.robots_cache[base_domain]

        try:
            rp = RobotFileParser()
            robots_url = urljoin(base_domain, '/robots.txt')
            rp.set_url(robots_url)
            rp.read()

            self.robots_cache[base_domain] = rp
            logger.info(f"Loaded robots.txt for {base_domain}")
            return rp
        except Exception as e:
            logger.debug(f"Could not load robots.txt for {base_domain}: {e}")
            # Create a permissive parser if robots.txt is not available
            rp = RobotFileParser()
            rp.set_url(urljoin(base_domain, '/robots.txt'))
            # Empty robots.txt allows everything
            rp.read()
            self.robots_cache[base_domain] = rp
            return rp

    def is_url_allowed(self, url):
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

    def fetch_cards(self):
        """Fetch business cards from the Next.js API"""
        try:
            # Fetch all cards from the API
            url = f"{self.api_url}/cards?limit=1000"
            logger.info(f"Fetching cards from {url}")

            response = requests.get(url, timeout=30)
            response.raise_for_status()

            data = response.json()
            cards = data.get('cards', [])

            logger.info(f"Fetched {len(cards)} cards from API")
            return cards
        except Exception as e:
            logger.error(f"Error fetching cards from API: {e}")
            return []

    def scrape_page_content(self, url, max_retries=3):
        """Scrape content from a webpage with retries"""
        if not self.is_url_allowed(url):
            logger.info(f"URL not allowed by robots.txt: {url}")
            return {
                'content': '',
                'page_title': '',
                'page_description': ''
            }

        for attempt in range(max_retries):
            try:
                headers = {
                    'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +{IndexerConfig.USER_AGENT_URL})'
                }

                response = requests.get(
                    url,
                    headers=headers,
                    timeout=IndexerConfig.SCRAPE_TIMEOUT,
                    allow_redirects=True
                )
                response.raise_for_status()

                soup = BeautifulSoup(response.text, 'html.parser')

                # Extract page title
                page_title = ''
                if soup.title:
                    page_title = soup.title.string.strip() if soup.title.string else ''

                # Extract meta description
                page_description = ''
                meta_desc = soup.find('meta', attrs={'name': 'description'})
                if meta_desc:
                    page_description = meta_desc.get('content', '').strip()

                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()

                # Extract text content
                text = soup.get_text()

                # Clean up text
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = ' '.join(chunk for chunk in chunks if chunk)

                # Limit content length
                if len(text) > IndexerConfig.MAX_CONTENT_LENGTH:
                    text = text[: IndexerConfig.MAX_CONTENT_LENGTH] + "..."

                return {
                    'content': text,
                    'page_title': page_title,
                    'page_description': page_description
                }

            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    # Exponential backoff
                    time.sleep(IndexerConfig.RETRY_BASE_DELAY**attempt)
                else:
                    logger.error(f"Failed to scrape {url} after {max_retries} attempts")

        return {
            'content': '',
            'page_title': '',
            'page_description': ''
        }

    def index_resource(self, card):
        """Index a single business card into OpenSearch"""
        try:
            card_id = card['id']
            name = card['name']
            website_url = card.get('website_url', '')

            if not website_url:
                logger.info(f"Skipping card {card_id} ({name}): No website URL")
                return

            logger.info(f"Indexing card {card_id}: {name} - {website_url}")

            # Scrape the website
            scraped_data = self.scrape_page_content(website_url)

            # Build document for OpenSearch
            document = {
                'resource_id': card_id,
                'title': scraped_data['page_title'] or name,
                'description': card.get('description', ''),
                'page_description': scraped_data['page_description'],
                'content': scraped_data['content'],
                'url': website_url,
                'page_url': website_url,
                'category': '', # Cards don't have categories in the new schema
                'phone': card.get('phone_number', ''),
                'address': card.get('address', ''),
                'domain': urlparse(website_url).netloc if website_url else '',
                'is_homepage': True,
                'indexed_at': datetime.now(UTC).isoformat(),
            }

            # Index into OpenSearch
            self.client.index(
                index=self.index_name,
                id=f"resource_{card_id}",
                body=document
            )

            logger.info(f"Successfully indexed card {card_id}")

        except Exception as e:
            logger.error(f"Error indexing card {card.get('id', 'unknown')}: {e}")

    def create_index(self):
        """Create the OpenSearch index if it doesn't exist"""
        if self.client.indices.exists(index=self.index_name):
            logger.info(f"Index {self.index_name} already exists")
            return

        # Create index with mappings
        index_body = {
            'settings': {
                'number_of_shards': 1,
                'number_of_replicas': 1,
                'analysis': {
                    'analyzer': {
                        'default': {
                            'type': 'standard'
                        }
                    }
                }
            },
            'mappings': {
                'properties': {
                    'resource_id': {'type': 'integer'},
                    'title': {'type': 'text'},
                    'description': {'type': 'text'},
                    'page_description': {'type': 'text'},
                    'content': {'type': 'text'},
                    'url': {'type': 'keyword'},
                    'page_url': {'type': 'keyword'},
                    'category': {'type': 'keyword'},
                    'phone': {'type': 'keyword'},
                    'address': {'type': 'text'},
                    'domain': {'type': 'keyword'},
                    'is_homepage': {'type': 'boolean'},
                    'indexed_at': {'type': 'date'},
                }
            }
        }

        self.client.indices.create(index=self.index_name, body=index_body)
        logger.info(f"Created index {self.index_name}")

    def run(self, reindex_all=False):
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

    def cleanup(self):
        """Cleanup resources"""
        if self.db_conn:
            self.db_conn.close()


def main():
    parser = argparse.ArgumentParser(description='Index business cards into OpenSearch')
    parser.add_argument('--reindex-all', action='store_true',
                       help='Reindex all resources, including previously indexed ones')
    parser.add_argument('--no-tracking', action='store_true',
                       help='Disable database progress tracking')

    args = parser.parse_args()

    indexer = ResourceIndexer(use_tracking=not args.no_tracking)

    try:
        indexer.run(reindex_all=args.reindex_all)
    finally:
        indexer.cleanup()


if __name__ == '__main__':
    main()
