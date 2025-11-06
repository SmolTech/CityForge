"""
Cloudinary integration utilities for image upload and management.

This module provides functions to upload, manage, and transform images
using the Cloudinary cloud service, replacing local file storage.
"""

import logging
import os
from typing import Any, Dict, Optional, Tuple

try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    import cloudinary.utils
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False

from werkzeug.datastructures import FileStorage

from app.utils.helpers import allowed_file

logger = logging.getLogger(__name__)


def configure_cloudinary() -> bool:
    """
    Configure Cloudinary with environment variables.
    
    Returns:
        bool: True if configuration is successful, False otherwise
    """
    if not CLOUDINARY_AVAILABLE:
        logger.error("Cloudinary package is not installed")
        return False
    
    try:
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        api_key = os.getenv("CLOUDINARY_API_KEY")
        api_secret = os.getenv("CLOUDINARY_API_SECRET")
        
        if not all([cloud_name, api_key, api_secret]):
            logger.warning("Cloudinary credentials not found in environment variables")
            return False
        
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        
        logger.info("Cloudinary configuration successful")
        return True
        
    except Exception as e:
        logger.error(f"Failed to configure Cloudinary: {e}")
        return False


def is_cloudinary_configured() -> bool:
    """
    Check if Cloudinary is properly configured.
    
    Returns:
        bool: True if Cloudinary is configured, False otherwise
    """
    return CLOUDINARY_AVAILABLE and all([
        os.getenv("CLOUDINARY_CLOUD_NAME"),
        os.getenv("CLOUDINARY_API_KEY"),
        os.getenv("CLOUDINARY_API_SECRET")
    ])


def upload_image_to_cloudinary(
    file: FileStorage,
    folder: str = "cityforge",
    public_id: Optional[str] = None,
    transformation: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Upload an image file to Cloudinary.
    
    Args:
        file: The file to upload
        folder: Cloudinary folder to organize uploads (default: "cityforge")
        public_id: Custom public ID for the image (optional)
        transformation: Image transformation options (optional)
    
    Returns:
        Tuple[bool, str, str]: (success, secure_url, public_id)
    """
    if not file or not allowed_file(file.filename):
        logger.warning(f"Invalid file type: {file.filename}")
        return False, None, None
    
    if not is_cloudinary_configured():
        logger.error("Cloudinary is not configured")
        return False, None, None
    
    try:
        # Configure Cloudinary
        if not configure_cloudinary():
            return False, None, None
        
        # Prepare upload options
        upload_options: Dict[str, Any] = {
            "folder": folder,
            "resource_type": "image",
            "format": "auto",  # Auto-optimize format (WebP when supported)
            "quality": "auto:good",  # Auto-optimize quality
            "fetch_format": "auto",  # Deliver optimal format
            "flags": "progressive",  # Progressive JPEG for better loading
        }
        
        if public_id:
            upload_options["public_id"] = public_id
        
        if transformation:
            upload_options["transformation"] = transformation
        else:
            # Default transformation for business card images
            upload_options["transformation"] = [
                {"quality": "auto:good"},
                {"fetch_format": "auto"},
                {"width": 800, "height": 600, "crop": "limit"},  # Limit max size
                {"flags": "progressive"}
            ]
        
        # Upload the file
        result = cloudinary.uploader.upload(file, **upload_options)
        
        logger.info(f"Successfully uploaded image to Cloudinary: {result.get('public_id')}")
        return True, result.get("secure_url"), result.get("public_id")
        
    except Exception as e:
        logger.error(f"Failed to upload image to Cloudinary: {e}")
        return False, None, None


def delete_image_from_cloudinary(public_id: str) -> bool:
    """
    Delete an image from Cloudinary.
    
    Args:
        public_id: The public ID of the image to delete
    
    Returns:
        bool: True if deletion was successful, False otherwise
    """
    if not public_id:
        logger.warning("No public_id provided for deletion")
        return False
    
    if not is_cloudinary_configured():
        logger.error("Cloudinary is not configured")
        return False
    
    try:
        # Configure Cloudinary
        if not configure_cloudinary():
            return False
        
        result = cloudinary.uploader.destroy(public_id)
        
        if result.get("result") == "ok":
            logger.info(f"Successfully deleted image from Cloudinary: {public_id}")
            return True
        else:
            logger.warning(f"Failed to delete image from Cloudinary: {result}")
            return False
            
    except Exception as e:
        logger.error(f"Error deleting image from Cloudinary: {e}")
        return False


def generate_cloudinary_url(
    public_id: str,
    transformation: Optional[Dict[str, Any]] = None,
    format: str = "auto",
    quality: str = "auto:good"
) -> Optional[str]:
    """
    Generate a Cloudinary URL for an image with optional transformations.
    
    Args:
        public_id: The public ID of the image
        transformation: Optional transformation parameters
        format: Image format (default: "auto")
        quality: Image quality (default: "auto:good")
    
    Returns:
        str: The generated Cloudinary URL, or None if failed
    """
    if not public_id:
        return None
    
    if not is_cloudinary_configured():
        logger.error("Cloudinary is not configured")
        return None
    
    try:
        # Configure Cloudinary
        if not configure_cloudinary():
            return None
        
        url_options: Dict[str, Any] = {
            "format": format,
            "quality": quality,
            "secure": True
        }
        
        if transformation:
            url_options["transformation"] = transformation
        
        url = cloudinary.utils.cloudinary_url(public_id, **url_options)[0]
        return url
        
    except Exception as e:
        logger.error(f"Error generating Cloudinary URL: {e}")
        return None


def get_image_info(public_id: str) -> Optional[Dict[str, Any]]:
    """
    Get information about an image stored in Cloudinary.
    
    Args:
        public_id: The public ID of the image
    
    Returns:
        Dict: Image information, or None if not found
    """
    if not public_id:
        return None
    
    if not is_cloudinary_configured():
        logger.error("Cloudinary is not configured")
        return None
    
    try:
        # Configure Cloudinary
        if not configure_cloudinary():
            return None
        
        result = cloudinary.api.resource(public_id)
        return result
        
    except Exception as e:
        logger.error(f"Error getting image info from Cloudinary: {e}")
        return None