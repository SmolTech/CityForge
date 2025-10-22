#!/usr/bin/env python3

import argparse
import os
import sys
import json
import requests
import time
from datetime import UTC, datetime
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
from opensearchpy import OpenSearch
import logging
import xml.etree.ElementTree as ET

# Add backend to path for database models
# In Docker: /app/backend, Locally: ../backend
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if not os.path.exists(backend_path):
    # Running in Docker container where backend is in /app/backend
    backend_path = '/app/backend'
sys.path.insert(0, backend_path)

from app import create_app, db
from app.models.indexing_job import IndexingJob
from config import IndexerConfig

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ResourceIndexer:
    def __init__(self, use_tracking=True):
        self.opensearch_host = os.getenv('OPENSEARCH_HOST', 'opensearch-service')
        self.opensearch_port = int(os.getenv('OPENSEARCH_PORT', '9200'))
        self.namespace = os.getenv('NAMESPACE', 'default')
        self.backend_url = os.getenv('BACKEND_URL', f'http://cityforge-backend-service:5000')

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

        # Initialize Flask app for database tracking
        self.use_tracking = use_tracking
        if use_tracking:
            self.app = create_app()
            self.app_context = self.app.app_context()
            self.app_context.push()


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

    def load_business_cards(self):
        """Load business cards with websites from the API"""
        try:
            response = requests.get(
                f"{self.backend_url}/api/cards", timeout=IndexerConfig.REQUEST_TIMEOUT
            )
            response.raise_for_status()

            data = response.json()
            cards = data.get('cards', [])

            # Filter cards that have websites and convert to resource format
            business_resources = []
            for card in cards:
                website_url = card.get('website_url', '').strip()
                if website_url:
                    # Convert business card to resource format for consistent indexing
                    resource = {
                        'id': 10000 + card['id'],  # Offset business IDs to avoid conflicts
                        'title': card['name'],
                        'description': card.get('description', ''),
                        'url': website_url,
                        'category': 'Business Directory',  # All business cards get this category
                        'phone': card.get('phone_number', ''),
                        'address': card.get('address', ''),
                    }
                    business_resources.append(resource)

            logger.info(f"Loaded {len(business_resources)} business cards with websites")
            return business_resources

        except Exception as e:
            logger.error(f"Failed to load business cards from API: {e}")
            return []


    def create_index_if_not_exists(self):
        """Create the OpenSearch index if it doesn't exist"""
        if not self.client.indices.exists(index=self.index_name):
            index_mapping = {
                "mappings": {
                    "properties": {
                        "title": {"type": "text", "analyzer": "standard"},
                        "description": {"type": "text", "analyzer": "standard"},
                        "url": {"type": "keyword"},
                        "category": {"type": "keyword"},
                        "content": {"type": "text", "analyzer": "standard"},
                        "phone": {"type": "keyword"},
                        "address": {"type": "text"},
                        "domain": {"type": "keyword"},
                        "indexed_at": {"type": "date"},
                        "resource_id": {"type": "integer"},
                        "page_url": {"type": "keyword"},
                        "is_homepage": {"type": "boolean"}
                    }
                }
            }

            try:
                self.client.indices.create(index=self.index_name, body=index_mapping)
                logger.info(f"Created index: {self.index_name}")
            except Exception as e:
                logger.error(f"Failed to create index: {e}")

    def scrape_url(self, url, max_retries=None):
        """Scrape content from a URL with retries"""
        if max_retries is None:
            max_retries = IndexerConfig.MAX_RETRIES

        # Check robots.txt compliance first
        if not self.is_url_allowed(url):
            logger.info(f"URL blocked by robots.txt: {url}")
            return None

        for attempt in range(max_retries):
            try:
                headers = {
                    'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +{IndexerConfig.USER_AGENT_URL})'
                }

                response = requests.get(
                    url, headers=headers, timeout=IndexerConfig.REQUEST_TIMEOUT
                )
                response.raise_for_status()

                soup = BeautifulSoup(response.content, 'html.parser')

                # Extract page title
                page_title = ""
                title_tag = soup.find('title')
                if title_tag:
                    page_title = title_tag.get_text().strip()

                # Extract meta description
                page_description = ""
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

        return {
            'content': '',
            'page_title': '',
            'page_description': ''
        }

    def discover_sitemap_urls(self, base_url):
        """Discover sitemap URLs for a given domain"""
        parsed_url = urlparse(base_url)
        base_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"

        sitemap_urls = []

        # Common sitemap locations
        common_sitemap_paths = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/sitemap.txt',
            '/sitemaps.xml'
        ]

        for path in common_sitemap_paths:
            sitemap_url = urljoin(base_domain, path)
            try:
                headers = {
                    'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +{IndexerConfig.USER_AGENT_URL})'
                }
                response = requests.head(
                    sitemap_url, headers=headers, timeout=IndexerConfig.SITEMAP_HEAD_TIMEOUT
                )
                if response.status_code == 200:
                    sitemap_urls.append(sitemap_url)
                    logger.info(f"Found sitemap: {sitemap_url}")
            except Exception as e:
                logger.debug(f"No sitemap at {sitemap_url}: {e}")

        # Try to find sitemap in robots.txt
        try:
            robots_url = urljoin(base_domain, '/robots.txt')
            response = requests.get(
                robots_url, headers=headers, timeout=IndexerConfig.ROBOTS_TXT_TIMEOUT
            )
            if response.status_code == 200:
                for line in response.text.splitlines():
                    if line.strip().lower().startswith('sitemap:'):
                        sitemap_url = line.split(':', 1)[1].strip()
                        # Convert relative URLs to absolute URLs
                        sitemap_url = urljoin(base_domain, sitemap_url)
                        if sitemap_url not in sitemap_urls:
                            sitemap_urls.append(sitemap_url)
                            logger.info(f"Found sitemap in robots.txt: {sitemap_url}")
        except Exception as e:
            logger.debug(f"Could not check robots.txt for {base_domain}: {e}")

        return sitemap_urls

    def parse_sitemap(self, sitemap_url):
        """Parse a sitemap and return list of URLs"""
        urls = []

        try:
            headers = {
                'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +{IndexerConfig.USER_AGENT_URL})'
            }
            response = requests.get(
                sitemap_url, headers=headers, timeout=IndexerConfig.REQUEST_TIMEOUT
            )
            response.raise_for_status()

            # Handle text sitemaps
            if sitemap_url.endswith('.txt') or 'text/plain' in response.headers.get('content-type', ''):
                for line in response.text.splitlines():
                    line = line.strip()
                    if line and line.startswith('http') and self.is_url_allowed(line):
                        urls.append(line)
                return urls

            # Handle XML sitemaps
            try:
                root = ET.fromstring(response.content)

                # Handle sitemap index files
                for sitemap_elem in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}sitemap'):
                    loc_elem = sitemap_elem.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')
                    if loc_elem is not None:
                        # Recursively parse sub-sitemaps
                        sub_urls = self.parse_sitemap(loc_elem.text)
                        urls.extend(sub_urls)

                # Handle regular sitemap files
                for url_elem in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'):
                    loc_elem = url_elem.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')
                    if loc_elem is not None and self.is_url_allowed(loc_elem.text):
                        urls.append(loc_elem.text)

            except ET.ParseError as e:
                logger.warning(f"Could not parse XML sitemap {sitemap_url}: {e}")

        except Exception as e:
            logger.error(f"Failed to fetch sitemap {sitemap_url}: {e}")

        return urls

    def get_all_site_urls(self, base_url, max_pages=None):
        """Get all URLs for a site, with fallback to homepage only"""
        if max_pages is None:
            max_pages = IndexerConfig.MAX_PAGES_PER_SITE

        all_urls = []

        # Discover sitemaps
        sitemap_urls = self.discover_sitemap_urls(base_url)

        if sitemap_urls:
            # Parse all discovered sitemaps
            for sitemap_url in sitemap_urls:
                urls = self.parse_sitemap(sitemap_url)
                all_urls.extend(urls)

            # Remove duplicates and limit
            all_urls = list(set(all_urls))[:max_pages]
            logger.info(f"Found {len(all_urls)} URLs from sitemaps for {base_url}")
        else:
            # Fallback to homepage only
            all_urls = [base_url]
            logger.info(f"No sitemaps found for {base_url}, indexing homepage only")

        return all_urls

    def index_single_page(self, resource, page_url, page_index=0):
        """Index a single page for a resource"""
        try:
            # Scrape the page content
            scraped_data = self.scrape_url(page_url)

            # Parse domain from URL
            parsed_url = urlparse(page_url)
            domain = parsed_url.netloc

            # Create unique document ID by combining resource ID and page index
            doc_id = f"{resource['id']}-{page_index}"

            # Determine if this is the homepage
            is_homepage = page_url == resource['url']

            # Use page title if available, fall back to resource title
            display_title = scraped_data['page_title'] if scraped_data['page_title'] else resource['title']

            # Use page description if available, fall back to resource description
            display_description = scraped_data['page_description'] if scraped_data['page_description'] else resource['description']

            # Prepare document for indexing
            doc = {
                'resource_id': resource['id'],
                'title': display_title,
                'description': display_description,
                'url': resource['url'],  # Original resource URL
                'page_url': page_url,   # Actual page URL
                'category': resource['category'],
                'content': scraped_data['content'],
                'page_title': scraped_data['page_title'],
                'page_description': scraped_data['page_description'],
                'resource_title': resource['title'],  # Keep original resource title for reference
                'resource_description': resource['description'],  # Keep original resource description
                'phone': resource.get('phone', ''),
                'address': resource.get('address', ''),
                'domain': domain,
                'is_homepage': is_homepage,
                'indexed_at': time.strftime('%Y-%m-%dT%H:%M:%S')
            }

            # Index document
            response = self.client.index(
                index=self.index_name,
                id=doc_id,
                body=doc
            )

            page_type = "homepage" if is_homepage else "subpage"
            logger.info(f"Indexed {page_type}: {resource['title']} - {page_url}")
            return True

        except Exception as e:
            logger.error(f"Failed to index page {page_url} for {resource['title']}: {e}")
            return False

    def index_resource(self, resource, job=None):
        """Index all pages for a single resource using sitemap discovery"""
        try:
            # Get all URLs for this site
            all_urls = self.get_all_site_urls(resource['url'])

            # Update job with total pages if tracking enabled
            if job and self.use_tracking:
                job.total_pages = len(all_urls)
                job.pages_indexed = 0
                db.session.commit()

            success_count = 0
            for i, page_url in enumerate(all_urls):
                if self.index_single_page(resource, page_url, i):
                    success_count += 1

                    # Update progress if tracking enabled
                    if job and self.use_tracking:
                        job.pages_indexed = success_count
                        db.session.commit()

                # Small delay between pages to be respectful
                time.sleep(IndexerConfig.DELAY_BETWEEN_PAGES)

            logger.info(f"Successfully indexed {success_count}/{len(all_urls)} pages for {resource['title']}")
            return success_count > 0

        except Exception as e:
            logger.error(f"Failed to index resource {resource['title']}: {e}")
            return False


    def index_all_resources(self, mode='full'):
        """
        Index all resources from business cards

        Args:
            mode: 'full' (index all), 'resume' (skip completed), 'retry' (retry failed only)
        """
        logger.info(f"Starting resource indexing process (mode: {mode})")

        # Load business cards with websites
        business_resources = self.load_business_cards()
        logger.info(f"Loaded {len(business_resources)} business cards with websites")

        if not business_resources:
            logger.warning("No resources found to index")
            return

        # Create index
        self.create_index_if_not_exists()

        # Index each resource
        success_count = 0
        skipped_count = 0
        failed_count = 0

        for resource in business_resources:
            resource_id = resource['id']

            # Get or create job record if tracking enabled
            if self.use_tracking:
                job = IndexingJob.get_or_create(resource_id)

                # Check if should skip based on mode
                if mode == 'resume' and job.status == 'completed':
                    logger.info(f"Skipping {resource['title']} (already completed)")
                    skipped_count += 1
                    continue
                elif mode == 'retry' and job.status != 'failed':
                    logger.info(f"Skipping {resource['title']} (not in failed status)")
                    skipped_count += 1
                    continue
                elif mode == 'retry' and job.retry_count >= 3:
                    logger.info(f"Skipping {resource['title']} (max retries reached)")
                    skipped_count += 1
                    continue

                # Update job status to in_progress
                job.status = 'in_progress'
                job.started_at = datetime.now(UTC)
                if mode == 'retry':
                    job.retry_count += 1
                db.session.commit()
            else:
                job = None

            # Index the resource
            try:
                if self.index_resource(resource, job):
                    success_count += 1

                    # Update job status to completed
                    if job and self.use_tracking:
                        job.status = 'completed'
                        job.completed_at = datetime.now(UTC)
                        job.last_error = None
                        db.session.commit()
                else:
                    failed_count += 1

                    # Update job status to failed
                    if job and self.use_tracking:
                        job.status = 'failed'
                        job.last_error = "Indexing returned False"
                        db.session.commit()

            except Exception as e:
                failed_count += 1
                logger.error(f"Exception while indexing {resource['title']}: {e}")

                # Update job status to failed with error message
                if job and self.use_tracking:
                    job.status = 'failed'
                    job.last_error = str(e)
                    db.session.commit()

            # Small delay between requests to be respectful
            time.sleep(IndexerConfig.DELAY_BETWEEN_SITES)

        logger.info(f"Indexing complete. Success: {success_count}, Failed: {failed_count}, Skipped: {skipped_count}, Total: {len(business_resources)}")

def main():
    parser = argparse.ArgumentParser(
        description='Index business card websites into OpenSearch with error recovery'
    )

    parser.add_argument(
        '--mode',
        choices=['full', 'resume', 'retry'],
        default='full',
        help='Indexing mode: full (index all), resume (skip completed), retry (retry failed only)'
    )

    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset all indexing jobs to pending status before starting'
    )

    parser.add_argument(
        '--no-tracking',
        action='store_true',
        help='Disable database tracking (faster but no resume/retry support)'
    )

    parser.add_argument(
        '--reindex-resource',
        type=int,
        metavar='ID',
        help='Re-index a specific resource by ID'
    )

    args = parser.parse_args()

    # Initialize indexer
    use_tracking = not args.no_tracking
    indexer = ResourceIndexer(use_tracking=use_tracking)

    # Handle reset option
    if args.reset and use_tracking:
        logger.info("Resetting all indexing jobs...")
        IndexingJob.reset_all_jobs()
        logger.info("All jobs reset to pending status")

    # Handle single resource reindex
    if args.reindex_resource:
        logger.info(f"Re-indexing resource ID: {args.reindex_resource}")

        # Load all resources to find the one to reindex
        resources = indexer.load_business_cards()
        resource = next((r for r in resources if r['id'] == args.reindex_resource), None)

        if not resource:
            logger.error(f"Resource {args.reindex_resource} not found")
            return

        # Create index if needed
        indexer.create_index_if_not_exists()

        # Get or create job if tracking enabled
        if use_tracking:
            job = IndexingJob.get_or_create(args.reindex_resource)
            job.status = 'in_progress'
            job.started_at = datetime.now(UTC)
            job.retry_count = 0
            db.session.commit()
        else:
            job = None

        # Index the resource
        try:
            if indexer.index_resource(resource, job):
                logger.info(f"Successfully re-indexed {resource['title']}")
                if job and use_tracking:
                    job.status = 'completed'
                    job.completed_at = datetime.now(UTC)
                    job.last_error = None
                    db.session.commit()
            else:
                logger.error(f"Failed to re-index {resource['title']}")
                if job and use_tracking:
                    job.status = 'failed'
                    job.last_error = "Indexing returned False"
                    db.session.commit()
        except Exception as e:
            logger.error(f"Exception while re-indexing {resource['title']}: {e}")
            if job and use_tracking:
                job.status = 'failed'
                job.last_error = str(e)
                db.session.commit()
    else:
        # Index all resources with specified mode
        indexer.index_all_resources(mode=args.mode)

if __name__ == "__main__":
    main()
