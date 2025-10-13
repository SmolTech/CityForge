#!/usr/bin/env python3
"""
Database migration management CLI for CityForge.

This script provides a convenient interface for common Alembic migration operations.
"""

import os
import sys
from subprocess import run


def print_help():
    """Print help information."""
    print(
        """
CityForge Database Migration CLI

Usage: python migrations.py <command> [options]

Commands:
  status              Show current migration status
  upgrade [revision]  Upgrade to a later version (default: head)
  downgrade [steps]   Downgrade to a previous version (default: -1)
  create <message>    Create a new migration (autogenerate)
  history             Show migration history
  current             Show current revision
  stamp <revision>    Mark a specific revision as current without running migrations

Examples:
  python migrations.py status
  python migrations.py upgrade
  python migrations.py upgrade +1
  python migrations.py downgrade
  python migrations.py downgrade -2
  python migrations.py create "add user preferences"
  python migrations.py history
  python migrations.py stamp head

For more advanced usage, use alembic directly:
  alembic --help
    """
    )


def check_database():
    """Check if database connection is configured."""
    required_vars = ["POSTGRES_HOST", "POSTGRES_DB"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        print(f"Warning: Missing environment variables: {', '.join(missing)}")
        print("Using default values. Set these variables for production use.")


def run_alembic(args):
    """Run an alembic command."""
    check_database()
    cmd = ["alembic"] + args
    result = run(cmd)
    return result.returncode


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "help" or command == "--help" or command == "-h":
        print_help()
        sys.exit(0)

    elif command == "status":
        print("=== Current Migration Status ===")
        run_alembic(["current", "--verbose"])
        print("\n=== Pending Migrations ===")
        # Show if we're up to date or behind
        result = run_alembic(["heads"])
        if result == 0:
            run_alembic(["current"])

    elif command == "upgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        print(f"Upgrading database to: {revision}")
        sys.exit(run_alembic(["upgrade", revision]))

    elif command == "downgrade":
        steps = sys.argv[2] if len(sys.argv) > 2 else "-1"
        print(f"Downgrading database by: {steps}")
        response = input(f"Are you sure you want to downgrade by {steps}? (yes/no): ")
        if response.lower() == "yes":
            sys.exit(run_alembic(["downgrade", steps]))
        else:
            print("Downgrade cancelled.")
            sys.exit(0)

    elif command == "create":
        if len(sys.argv) < 3:
            print("Error: Migration message required")
            print("Usage: python migrations.py create <message>")
            sys.exit(1)
        message = " ".join(sys.argv[2:])
        print(f"Creating new migration: {message}")
        sys.exit(run_alembic(["revision", "--autogenerate", "-m", message]))

    elif command == "history":
        print("=== Migration History ===")
        sys.exit(run_alembic(["history", "--verbose"]))

    elif command == "current":
        print("=== Current Revision ===")
        sys.exit(run_alembic(["current", "--verbose"]))

    elif command == "stamp":
        if len(sys.argv) < 3:
            print("Error: Revision required")
            print("Usage: python migrations.py stamp <revision>")
            sys.exit(1)
        revision = sys.argv[2]
        print(f"Stamping database at revision: {revision}")
        print(
            "Warning: This marks the database as being at this revision without running migrations."
        )
        response = input("Are you sure? (yes/no): ")
        if response.lower() == "yes":
            sys.exit(run_alembic(["stamp", revision]))
        else:
            print("Stamp cancelled.")
            sys.exit(0)

    else:
        print(f"Error: Unknown command '{command}'")
        print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
