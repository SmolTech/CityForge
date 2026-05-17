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
