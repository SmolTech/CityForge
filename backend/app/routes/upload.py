import logging
import os
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from app import limiter
from app.utils.cloudinary_helper import is_cloudinary_configured, upload_image_to_cloudinary
from app.utils.helpers import allowed_file

logger = logging.getLogger(__name__)
bp = Blueprint("upload", __name__)


@bp.route("/api/upload", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def upload_file():
    """
    Upload a file to either Cloudinary (if configured) or local storage (fallback).

    Returns:
        JSON response with file URL and metadata
    """
    if "file" not in request.files:
        return jsonify({"message": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No file selected"}), 400

    if not file or not allowed_file(file.filename):
        return jsonify({"message": "Invalid file type"}), 400

    try:
        # Try Cloudinary first if configured
        if is_cloudinary_configured():
            logger.info("Using Cloudinary for file upload")
            success, secure_url, public_id = upload_image_to_cloudinary(
                file=file, folder="cityforge/uploads"
            )

            if success and secure_url and public_id:
                return jsonify(
                    {
                        "success": True,
                        "url": secure_url,
                        "public_id": public_id,
                        "storage": "cloudinary",
                        "message": "File uploaded successfully to Cloudinary",
                    }
                )
            else:
                logger.warning("Cloudinary upload failed, falling back to local storage")

        # Fallback to local storage
        logger.info("Using local storage for file upload")
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"

        # Ensure upload folder exists
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        os.makedirs(upload_folder, exist_ok=True)

        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)

        return jsonify(
            {
                "success": True,
                "filename": unique_filename,
                "url": f"/api/uploads/{unique_filename}",
                "storage": "local",
                "message": "File uploaded successfully to local storage",
            }
        )

    except Exception as e:
        logger.error(f"File upload failed: {e}")
        return jsonify({"success": False, "message": "File upload failed", "error": str(e)}), 500


@bp.route("/api/uploads/<filename>")
def uploaded_file(filename):
    """
    Serve locally stored files.

    Note: This endpoint is only used for local storage fallback.
    Cloudinary images are served directly from Cloudinary CDN.
    """
    try:
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        return send_from_directory(upload_folder, filename)
    except Exception as e:
        logger.error(f"Error serving file {filename}: {e}")
        return jsonify({"message": "File not found"}), 404
