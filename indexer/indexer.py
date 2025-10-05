#!/usr/bin/env python3

import os
import json
import requests
import time
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
from opensearchpy import OpenSearch
import logging
import xml.etree.ElementTree as ET

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ResourceIndexer:
    def __init__(self):
        self.opensearch_host = os.getenv('OPENSEARCH_HOST', 'opensearch-service')
        self.opensearch_port = int(os.getenv('OPENSEARCH_PORT', '9200'))
        self.namespace = os.getenv('NAMESPACE', 'default')
        self.backend_url = os.getenv('BACKEND_URL', f'http://{self.namespace}-community-backend-service:5000')

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
        self.user_agent = 'ResourceIndexer/1.0'


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
            response = requests.get(f"{self.backend_url}/api/cards", timeout=10)
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

    def load_help_wanted_posts(self):
        """Load help wanted posts from the API"""
        try:
            response = requests.get(f"{self.backend_url}/api/help-wanted?status=open&limit=1000", timeout=10)
            response.raise_for_status()

            data = response.json()
            posts = data.get('posts', [])

            # Convert help wanted posts to resource format
            help_wanted_resources = []
            for post in posts:
                # Create a pseudo-URL for help wanted posts
                post_url = f"{self.backend_url}/help-wanted/{post['id']}"

                # Format category display
                category_map = {
                    'hiring': 'Help Wanted - Hiring',
                    'collaboration': 'Help Wanted - Collaboration',
                    'general': 'Help Wanted - General'
                }
                category = category_map.get(post.get('category', 'general'), 'Help Wanted')

                resource = {
                    'id': 20000 + post['id'],  # Offset help wanted IDs to avoid conflicts
                    'title': post['title'],
                    'description': post.get('description', ''),
                    'url': post_url,
                    'category': category,
                    'phone': '',
                    'address': post.get('location', ''),
                    'budget': post.get('budget', ''),
                    'contact_preference': post.get('contact_preference', ''),
                    'post_id': post['id'],
                    'created_by': post.get('creator', {}).get('first_name', '') + ' ' + post.get('creator', {}).get('last_name', ''),
                    'created_date': post.get('created_date', ''),
                    'is_help_wanted': True
                }
                help_wanted_resources.append(resource)

            logger.info(f"Loaded {len(help_wanted_resources)} help wanted posts")
            return help_wanted_resources

        except Exception as e:
            logger.error(f"Failed to load help wanted posts from API: {e}")
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
                        "is_homepage": {"type": "boolean"},
                        "is_help_wanted": {"type": "boolean"},
                        "post_id": {"type": "integer"},
                        "budget": {"type": "text"},
                        "contact_preference": {"type": "keyword"},
                        "created_by": {"type": "text"},
                        "created_date": {"type": "date"}
                    }
                }
            }

            try:
                self.client.indices.create(index=self.index_name, body=index_mapping)
                logger.info(f"Created index: {self.index_name}")
            except Exception as e:
                logger.error(f"Failed to create index: {e}")

    def scrape_url(self, url, max_retries=3):
        """Scrape content from a URL with retries"""
        # Check robots.txt compliance first
        if not self.is_url_allowed(url):
            logger.info(f"URL blocked by robots.txt: {url}")
            return None

        for attempt in range(max_retries):
            try:
                headers = {
                    'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +https://smoltech.us/)'
                }

                response = requests.get(url, headers=headers, timeout=10)
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
                if len(text) > 5000:
                    text = text[:5000] + "..."

                return {
                    'content': text,
                    'page_title': page_title,
                    'page_description': page_description
                }

            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
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
                    'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +https://smoltech.us/)'
                }
                response = requests.head(sitemap_url, headers=headers, timeout=5)
                if response.status_code == 200:
                    sitemap_urls.append(sitemap_url)
                    logger.info(f"Found sitemap: {sitemap_url}")
            except Exception as e:
                logger.debug(f"No sitemap at {sitemap_url}: {e}")

        # Try to find sitemap in robots.txt
        try:
            robots_url = urljoin(base_domain, '/robots.txt')
            response = requests.get(robots_url, headers=headers, timeout=5)
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
                'User-Agent': f'Mozilla/5.0 (compatible; {self.user_agent}; +https://smoltech.us/)'
            }
            response = requests.get(sitemap_url, headers=headers, timeout=10)
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

    def get_all_site_urls(self, base_url, max_pages=50):
        """Get all URLs for a site, with fallback to homepage only"""
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

    def index_resource(self, resource):
        """Index all pages for a single resource using sitemap discovery"""
        try:
            # Get all URLs for this site
            all_urls = self.get_all_site_urls(resource['url'])

            success_count = 0
            for i, page_url in enumerate(all_urls):
                if self.index_single_page(resource, page_url, i):
                    success_count += 1

                # Small delay between pages to be respectful
                time.sleep(0.5)

            logger.info(f"Successfully indexed {success_count}/{len(all_urls)} pages for {resource['title']}")
            return success_count > 0

        except Exception as e:
            logger.error(f"Failed to index resource {resource['title']}: {e}")
            return False

    def index_help_wanted_post(self, resource):
        """Index a help wanted post (no web scraping needed)"""
        try:
            # Create unique document ID for help wanted posts
            doc_id = f"helpwanted-{resource['post_id']}"

            # Prepare document for indexing
            doc = {
                'resource_id': resource['id'],
                'title': resource['title'],
                'description': resource['description'],
                'url': resource['url'],
                'page_url': resource['url'],
                'category': resource['category'],
                'content': resource['description'],  # Use description as content for search
                'phone': resource.get('phone', ''),
                'address': resource.get('address', ''),
                'domain': 'help-wanted',
                'is_homepage': True,
                'is_help_wanted': True,
                'post_id': resource['post_id'],
                'budget': resource.get('budget', ''),
                'contact_preference': resource.get('contact_preference', ''),
                'created_by': resource.get('created_by', ''),
                'created_date': resource.get('created_date', ''),
                'indexed_at': time.strftime('%Y-%m-%dT%H:%M:%S')
            }

            # Index document
            response = self.client.index(
                index=self.index_name,
                id=doc_id,
                body=doc
            )

            logger.info(f"Indexed help wanted post: {resource['title']}")
            return True

        except Exception as e:
            logger.error(f"Failed to index help wanted post {resource['title']}: {e}")
            return False

    def index_all_resources(self):
        """Index all resources from business cards and help wanted posts"""
        logger.info("Starting resource indexing process")

        # Load business cards with websites
        business_resources = self.load_business_cards()
        logger.info(f"Loaded {len(business_resources)} business cards with websites")

        # Load help wanted posts
        help_wanted_resources = self.load_help_wanted_posts()
        logger.info(f"Loaded {len(help_wanted_resources)} help wanted posts")

        if not business_resources and not help_wanted_resources:
            logger.warning("No resources found to index")
            return

        # Create index
        self.create_index_if_not_exists()

        # Index business cards
        business_success_count = 0
        for resource in business_resources:
            if self.index_resource(resource):
                business_success_count += 1

            # Small delay between requests to be respectful
            time.sleep(1)

        logger.info(f"Business card indexing complete. Successfully indexed {business_success_count}/{len(business_resources)} business cards")

        # Index help wanted posts
        help_wanted_success_count = 0
        for resource in help_wanted_resources:
            if self.index_help_wanted_post(resource):
                help_wanted_success_count += 1

            # Small delay between requests
            time.sleep(0.2)

        logger.info(f"Help wanted indexing complete. Successfully indexed {help_wanted_success_count}/{len(help_wanted_resources)} help wanted posts")
        logger.info(f"Total indexing complete. Indexed {business_success_count + help_wanted_success_count} total resources")

def main():
    indexer = ResourceIndexer()
    indexer.index_all_resources()

if __name__ == "__main__":
    main()