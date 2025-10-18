import json

from flask import Blueprint, current_app, jsonify, request

from app import db
from app.models.resource import QuickAccessItem, ResourceConfig, ResourceItem

bp = Blueprint("resources", __name__)


@bp.route("/api/resources/config", methods=["GET"])
def get_resources_config():
    """Get the resources page configuration including title, description, footer, and site info from database"""
    try:
        config = {}
        config_items = ResourceConfig.query.all()
        config_dict = {item.key: item.value for item in config_items}

        config["site"] = {
            "title": config_dict.get("site_title", "Community Website"),
            "description": config_dict.get(
                "site_description", "Helping connect people to the resources available to them."
            ),
            "domain": config_dict.get("site_domain", "community.local"),
        }

        config["title"] = config_dict.get("resources_title", "Local Resources")
        config["description"] = config_dict.get(
            "resources_description", "Essential links to local services and information"
        )

        footer_json = config_dict.get("resources_footer")
        if footer_json:
            try:
                config["footer"] = json.loads(footer_json)
            except json.JSONDecodeError:
                config["footer"] = None

        if not config.get("footer"):
            config["footer"] = {
                "title": config_dict.get("footer_title", "Missing a Resource?"),
                "description": config_dict.get(
                    "footer_description",
                    "If you know of an important local resource that should be included on this page, please let us know.",
                ),
                "contactEmail": config_dict.get("footer_contact_email", "contact@example.com"),
                "buttonText": config_dict.get("footer_button_text", "Suggest a Resource"),
            }

        return jsonify(config)
    except Exception as e:
        current_app.logger.error(f"Error getting resources config: {str(e)}")
        return jsonify({"error": "Failed to load resources configuration"}), 500


@bp.route("/api/resources/quick-access", methods=["GET"])
def get_quick_access():
    """Get quick access items for resources page"""
    try:
        items = (
            QuickAccessItem.query.filter_by(is_active=True)
            .order_by(QuickAccessItem.display_order, QuickAccessItem.id)
            .all()
        )
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        current_app.logger.error(f"Error getting quick access items: {str(e)}")
        return jsonify({"error": "Failed to load quick access items"}), 500


@bp.route("/api/resources/items", methods=["GET"])
def get_resource_items():
    """Get resource items, optionally filtered by category"""
    try:
        category = request.args.get("category")
        query = ResourceItem.query.filter_by(is_active=True)

        if category:
            query = query.filter_by(category=category)

        items = query.order_by(
            ResourceItem.category, ResourceItem.display_order, ResourceItem.title
        ).all()
        return jsonify([item.to_dict() for item in items])
    except Exception as e:
        current_app.logger.error(f"Error getting resource items: {str(e)}")
        return jsonify({"error": "Failed to load resource items"}), 500


@bp.route("/api/resources/categories", methods=["GET"])
def get_resource_categories():
    """Get unique categories from resource items"""
    try:
        result = (
            db.session.query(ResourceItem.category).filter(ResourceItem.is_active).distinct().all()
        )
        categories = [row[0] for row in result if row[0]]
        return jsonify(sorted(categories))
    except Exception as e:
        current_app.logger.error(f"Error getting resource categories: {str(e)}")
        return jsonify({"error": "Failed to load resource categories"}), 500


@bp.route("/api/site-config", methods=["GET"])
def get_site_config():
    """Get site-wide configuration from database"""
    try:
        config_items = ResourceConfig.query.all()
        config_dict = {item.key: item.value for item in config_items}

        response = jsonify(
            {
                "site": {
                    "title": config_dict.get("site_title", "Community Website"),
                    "description": config_dict.get(
                        "site_description",
                        "Helping connect people to the resources available to them.",
                    ),
                    "domain": config_dict.get("site_domain", "community.local"),
                    "tagline": config_dict.get("site_tagline", "Community Directory"),
                    "directoryDescription": config_dict.get(
                        "site_directory_description",
                        "Discover local resources and community information.",
                    ),
                    "copyright": config_dict.get("site_copyright", "2025"),
                    "copyrightHolder": config_dict.get("site_copyright_holder", "Community"),
                    "copyrightUrl": config_dict.get("site_copyright_url", "#"),
                    "shortName": config_dict.get("site_short_name", "Community"),
                    "fullName": config_dict.get("site_full_name", "Community Website"),
                },
                "pagination": {
                    "defaultLimit": int(config_dict.get("pagination_default_limit", "20")),
                },
            }
        )
        # Cache for 10 minutes (600 seconds)
        response.headers["Cache-Control"] = "public, max-age=600"
        return response
    except Exception as e:
        current_app.logger.error(f"Error getting site config: {str(e)}")
        return jsonify({"error": "Failed to load site configuration"}), 500


@bp.route("/api/resources", methods=["GET"])
def get_resources():
    """Get complete resources page data in format expected by frontend"""
    try:
        config_response = get_resources_config()
        if config_response.status_code != 200:
            raise Exception("Failed to get config")
        config = config_response.get_json()

        quick_access_response = get_quick_access()
        if quick_access_response.status_code != 200:
            raise Exception("Failed to get quick access")
        quick_access = quick_access_response.get_json()

        items_response = get_resource_items()
        if items_response.status_code != 200:
            raise Exception("Failed to get resource items")
        resource_items = items_response.get_json()

        result = {
            "site": config["site"],
            "title": config["title"],
            "description": config["description"],
            "quickAccess": quick_access,
            "resources": resource_items,
            "footer": config["footer"],
        }

        response = jsonify(result)
        # Cache for 5 minutes (300 seconds) - resources change less frequently
        response.headers["Cache-Control"] = "public, max-age=300"
        return response
    except Exception as e:
        current_app.logger.error(f"Error getting complete resources data: {str(e)}")
        return jsonify({"error": "Failed to load resources data"}), 500
