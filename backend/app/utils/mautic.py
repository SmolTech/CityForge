"""Mautic API integration utility."""

import os
import logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Mautic configuration from environment variables
MAUTIC_URL = os.getenv("MAUTIC_URL", "")
MAUTIC_USERNAME = os.getenv("MAUTIC_USERNAME", "")
MAUTIC_PASSWORD = os.getenv("MAUTIC_PASSWORD", "")


def is_mautic_enabled() -> bool:
    """Check if Mautic integration is enabled."""
    return bool(MAUTIC_URL and MAUTIC_USERNAME and MAUTIC_PASSWORD)


def create_or_update_contact(
    email: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    tags: Optional[list] = None,
    custom_fields: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Create or update a contact in Mautic.

    Args:
        email: Contact's email address (required)
        first_name: Contact's first name
        last_name: Contact's last name
        tags: List of tags to apply to the contact
        custom_fields: Dictionary of custom field values

    Returns:
        bool: True if successful, False otherwise
    """
    if not is_mautic_enabled():
        logger.debug("Mautic integration not enabled, skipping contact creation")
        return False

    try:
        # Prepare contact data
        contact_data = {"email": email}

        if first_name:
            contact_data["firstname"] = first_name
        if last_name:
            contact_data["lastname"] = last_name
        if tags:
            contact_data["tags"] = tags
        if custom_fields:
            contact_data.update(custom_fields)

        # Make API request to create/update contact
        api_url = f"{MAUTIC_URL}/api/contacts/new"
        response = requests.post(
            api_url,
            json=contact_data,
            auth=(MAUTIC_USERNAME, MAUTIC_PASSWORD),
            timeout=10,
        )

        if response.status_code in [200, 201]:
            logger.info(f"Successfully created/updated Mautic contact for {email}")
            return True
        else:
            logger.warning(
                f"Failed to create Mautic contact for {email}: {response.status_code} - {response.text}"
            )
            return False

    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Mautic API: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error creating Mautic contact: {e}")
        return False


def add_contact_to_segment(contact_id: int, segment_id: int) -> bool:
    """
    Add a contact to a specific Mautic segment.

    Args:
        contact_id: Mautic contact ID
        segment_id: Mautic segment ID

    Returns:
        bool: True if successful, False otherwise
    """
    if not is_mautic_enabled():
        return False

    try:
        api_url = f"{MAUTIC_URL}/api/segments/{segment_id}/contact/{contact_id}/add"
        response = requests.post(
            api_url,
            auth=(MAUTIC_USERNAME, MAUTIC_PASSWORD),
            timeout=10,
        )

        if response.status_code == 200:
            logger.info(
                f"Successfully added contact {contact_id} to segment {segment_id}"
            )
            return True
        else:
            logger.warning(
                f"Failed to add contact to segment: {response.status_code} - {response.text}"
            )
            return False

    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Mautic API: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error adding contact to segment: {e}")
        return False
