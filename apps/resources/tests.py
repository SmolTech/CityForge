from django.test import TestCase

from apps.resources.models import QuickAccessItem, ResourceCategory, ResourceConfig, ResourceItem


class ResourceModelTests(TestCase):
    def test_string_representations(self) -> None:
        category = ResourceCategory.objects.create(name="Health")
        item = ResourceItem.objects.create(
            title="Clinic",
            url="https://clinic.example",
            description="Community clinic",
            category="Health",
            icon="hospital",
            category_obj=category,
        )
        quick = QuickAccessItem.objects.create(
            identifier="hotline",
            title="Hotline",
            subtitle="24/7",
            phone="5551234",
            color="red",
            icon="phone",
        )
        config = ResourceConfig.objects.create(key="site_name", value="CityForge")
        self.assertEqual(str(category), "Health")
        self.assertEqual(str(item), "Clinic")
        self.assertEqual(str(quick), "Hotline")
        self.assertEqual(str(config), "site_name")


class ResourceApiTests(TestCase):
    def setUp(self) -> None:
        self.category = ResourceCategory.objects.create(name="Health")
        ResourceCategory.objects.create(name="Education")
        self.item = ResourceItem.objects.create(
            title="Clinic",
            url="https://clinic.example",
            description="Community clinic",
            category="Health",
            icon="hospital",
            category_obj=self.category,
            is_active=True,
        )
        ResourceItem.objects.create(
            title="Library",
            url="https://library.example",
            description="Public library",
            category="Education",
            icon="book",
            is_active=True,
        )
        ResourceItem.objects.create(
            title="Inactive",
            url="https://inactive.example",
            description="Hidden",
            category="Health",
            icon="x",
            is_active=False,
        )
        QuickAccessItem.objects.create(
            identifier="hotline",
            title="Hotline",
            subtitle="24/7",
            phone="5551234",
            color="red",
            icon="phone",
            is_active=True,
        )
        QuickAccessItem.objects.create(
            identifier="hidden",
            title="Hidden",
            subtitle="Hidden",
            phone="5550000",
            color="gray",
            icon="phone",
            is_active=False,
        )

    def test_api_categories_returns_names(self) -> None:
        response = self.client.get("/api/resources/categories")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), ["Education", "Health"])

    def test_api_items_returns_active_items(self) -> None:
        response = self.client.get("/api/resources/items")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["title"], "Clinic")
        self.assertEqual(data[1]["title"], "Library")

    def test_api_items_filters_by_category(self) -> None:
        response = self.client.get("/api/resources/items?category=Health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Clinic")

    def test_api_quick_access_returns_active_items(self) -> None:
        response = self.client.get("/api/resources/quick-access")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Hotline")
