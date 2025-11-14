"""
Configuration constants for the CityForge indexer.

This module centralizes all magic numbers and configuration values used
throughout the indexer to make them easy to adjust and maintain.
"""


class IndexerConfig:
    """Configuration values for website crawling and indexing."""

    # Crawling limits
    MAX_PAGES_PER_SITE = 50  # Maximum pages to index per website
    MAX_CONTENT_LENGTH = 5000  # Maximum characters of content to index per page

    # Retry configuration
    MAX_RETRIES = 3  # Maximum number of retry attempts for failed requests
    RETRY_BASE_DELAY = 2  # Base delay in seconds for exponential backoff (2^attempt)

    # Rate limiting (be respectful to external sites)
    DELAY_BETWEEN_PAGES = 0.5  # Seconds to wait between indexing pages on same site
    DELAY_BETWEEN_SITES = 1.0  # Seconds to wait between indexing different sites

    # Timeouts
    REQUEST_TIMEOUT = 10  # Seconds to wait for HTTP requests
    SCRAPE_TIMEOUT = 10   # Seconds to wait for web page scraping
    SITEMAP_HEAD_TIMEOUT = 5  # Seconds to wait for HEAD requests to sitemaps
    ROBOTS_TXT_TIMEOUT = 5  # Seconds to wait for robots.txt requests

    # User agent
    USER_AGENT = "ResourceIndexer/1.0"
    USER_AGENT_URL = "https://smoltech.us/"
