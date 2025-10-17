import os
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from app import limiter
from app.utils.helpers import allowed_file

bp = Blueprint("upload", __name__)


@bp.route("/api/upload", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def upload_file():
    if "file" not in request.files:
        return jsonify({"message": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No file selected"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file.save(os.path.join(current_app.config["UPLOAD_FOLDER"], unique_filename))

        return jsonify({"filename": unique_filename, "url": f"/api/uploads/{unique_filename}"})

    return jsonify({"message": "Invalid file type"}), 400


@bp.route("/api/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)
