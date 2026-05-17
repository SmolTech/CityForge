from django.test import TestCase

from apps.indexing.models import IndexingJob


class IndexingModelTests(TestCase):
    def test_string_representation(self) -> None:
        job = IndexingJob.objects.create(resource_id=12, status="queued")
        self.assertEqual(str(job), "Resource 12: queued")
