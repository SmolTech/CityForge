from django.test import TestCase

from apps.accounts.models import User
from apps.classifieds.models import HelpWantedComment, HelpWantedPost, HelpWantedReport


class ClassifiedModelTests(TestCase):
    def test_string_representations(self) -> None:
        user = User.objects.create_user(
            "classified@example.com",
            "ClassifiedPass!123",
            first_name="Classified",
            last_name="User",
        )
        post = HelpWantedPost.objects.create(
            title="Need painter",
            description="Interior work",
            category="home",
            creator=user,
        )
        comment = HelpWantedComment.objects.create(post=post, content="I can help", creator=user)
        report = HelpWantedReport.objects.create(post=post, reason="spam", reporter=user)
        self.assertEqual(str(post), "Need painter")
        self.assertIn("Comment on", str(comment))
        self.assertIn("Report for", str(report))
