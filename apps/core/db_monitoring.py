from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError, ProgrammingError

# ``cursor`` and ``connection`` are intentionally typed as ``Any`` because the
# code uses vendor-specific introspection SQL and raw cursor APIs that vary by
# Django database backend.

logger = logging.getLogger("apps.core.db")


def _row_as_dict(cursor: Any) -> dict[str, Any]:
    row = cursor.fetchone()
    if row is None:
        return {}
    return {column[0]: value for column, value in zip(cursor.description, row, strict=False)}


def _postgres_pool_metrics(connection: Any) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                current_database() AS database_name,
                pg_backend_pid() AS backend_pid,
                current_setting('max_connections')::int AS max_connections,
                current_setting('superuser_reserved_connections')::int AS reserved_connections,
                COUNT(*) FILTER (WHERE datname = current_database()) AS total_connections,
                COUNT(*) FILTER (WHERE datname = current_database() AND state = 'active') AS active_connections,
                COUNT(*) FILTER (
                    WHERE datname = current_database()
                    AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
                ) AS idle_connections,
                COUNT(*) FILTER (
                    WHERE datname = current_database()
                    AND wait_event_type IS NOT NULL
                    AND state <> 'idle'
                ) AS waiting_connections
            FROM pg_stat_activity
            """
        )
        metrics = _row_as_dict(cursor)

    available_connections = max(
        int(metrics["max_connections"]) - int(metrics["reserved_connections"]),
        1,
    )
    utilization_percent = round(
        (int(metrics["total_connections"]) / available_connections) * 100,
        2,
    )

    status = "ok"
    if (
        utilization_percent >= settings.DB_POOL_WARNING_UTILIZATION_PERCENT
        or int(metrics["waiting_connections"]) >= settings.DB_POOL_WARNING_WAITING_CONNECTIONS
    ):
        status = "warning"

    pool = {
        "supported": True,
        "status": status,
        "database_name": metrics["database_name"],
        "backend_pid": metrics["backend_pid"],
        "max_connections": metrics["max_connections"],
        "reserved_connections": metrics["reserved_connections"],
        "available_connections": available_connections,
        "total_connections": metrics["total_connections"],
        "active_connections": metrics["active_connections"],
        "idle_connections": metrics["idle_connections"],
        "waiting_connections": metrics["waiting_connections"],
        "utilization_percent": utilization_percent,
    }

    if status == "warning":
        logger.warning(
            "db.pool.warning alias=%s total=%s active=%s idle=%s waiting=%s utilization_pct=%s",
            connection.alias,
            pool["total_connections"],
            pool["active_connections"],
            pool["idle_connections"],
            pool["waiting_connections"],
            pool["utilization_percent"],
        )

    return pool


def get_database_health(alias: str = "default") -> dict[str, Any]:
    connection = connections[alias]
    health = {
        "alias": alias,
        "vendor": connection.vendor,
        "engine": connection.settings_dict.get("ENGINE"),
        "connection_age_limit_seconds": connection.settings_dict.get("CONN_MAX_AGE", 0),
        "healthy": False,
        "usable": False,
    }

    try:
        connection.ensure_connection()
        health["usable"] = connection.is_usable()
        health["healthy"] = bool(health["usable"])
    except OperationalError as exc:
        health["error"] = str(exc)
        health["pool"] = {
            "supported": connection.vendor == "postgresql",
            "status": "error",
        }
        return health

    if connection.vendor != "postgresql":
        health["pool"] = {
            "supported": False,
            "status": "unavailable",
            "detail": f"{connection.vendor} does not expose PostgreSQL pool metrics",
        }
        return health

    try:
        health["pool"] = _postgres_pool_metrics(connection)
    except (OperationalError, ProgrammingError) as exc:
        health["pool"] = {
            "supported": False,
            "status": "unavailable",
            "detail": str(exc),
        }

    return health
