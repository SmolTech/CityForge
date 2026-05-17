from __future__ import annotations

from django.apps import apps
from django.core.management.base import BaseCommand
from django.core.management.color import no_style
from django.db import DEFAULT_DB_ALIAS, connections, router, transaction


class Command(BaseCommand):
    help = "Synchronize database sequences with the current maximum primary keys."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default=DEFAULT_DB_ALIAS,
            help='Nominates a database to synchronize. Defaults to the "default" database.',
        )

    def handle(self, *args, **options):
        database = options["database"]
        connection = connections[database]
        models = [
            model
            for model in apps.get_models()
            if router.allow_migrate_model(database, model)
        ]
        statements = connection.ops.sequence_reset_sql(no_style(), models)

        if not statements:
            self.stdout.write("No sequences to synchronize.")
            return

        with transaction.atomic(using=database), connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)

        self.stdout.write(self.style.SUCCESS(f"Synchronized {len(statements)} sequence(s)."))
