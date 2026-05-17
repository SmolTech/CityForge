from django.test import TestCase

from apps.accounts.models import User
from apps.forums.models import (
    ForumCategory,
    ForumCategoryRequest,
    ForumPost,
    ForumReport,
    ForumThread,
)


class ForumModelTests(TestCase):
    def test_string_representations(self) -> None:
        user = User.objects.create_user(
            "forum@example.com",
            "ForumPass!123",
            first_name="Forum",
            last_name="User",
        )
        category = ForumCategory.objects.create(name="General", slug="general", creator=user)
        request = ForumCategoryRequest.objects.create(name="Jobs", requester=user)
        thread = ForumThread.objects.create(
            category=category, title="Welcome", slug="welcome", creator=user
        )
        post = ForumPost.objects.create(thread=thread, content="Hello", creator=user)
        report = ForumReport.objects.create(thread=thread, post=post, reason="spam", reporter=user)
        self.assertEqual(str(category), "General")
        self.assertEqual(str(request), "Jobs")
        self.assertEqual(str(thread), "Welcome")
        self.assertIn("Post in", str(post))
        self.assertIn("Report for", str(report))
