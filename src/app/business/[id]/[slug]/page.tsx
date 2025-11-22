import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Navigation } from "@/components/shared";
import { BusinessDetail } from "@/components/cards";
import { CLIENT_CONFIG } from "@/lib/client-config";
import { logger } from "@/lib/logger";

// Force dynamic rendering to avoid database queries during build
export const dynamic = "force-dynamic";

interface BusinessPageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

// Static metadata for business pages
export const metadata: Metadata = {
  title: "Business Directory",
  description: "Explore local businesses in our community directory.",
};

async function getBusinessData(id: string, slug: string) {
  try {
    // Use absolute URL for server-side requests
    // In production, use the site URL; in development, use localhost
    const baseUrl =
      process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000";
    const url = `${baseUrl}/api/business/${id}/${slug}`;
    logger.info("[Business Page] Fetching:", url);
    const response = await fetch(url, {
      cache: "no-store", // Ensure fresh data for each request
    });
    logger.info("[Business Page] Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      if (response.status === 301) {
        const data = await response.json();
        return { redirect: data.redirect };
      }
      throw new Error("Failed to fetch business data");
    }

    return await response.json();
  } catch (error) {
    logger.error("Error fetching business data:", error);
    return null;
  }
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { id, slug } = await params;
  const businessData = await getBusinessData(id, slug);

  if (!businessData) {
    notFound();
  }

  if (businessData.redirect) {
    redirect(businessData.redirect);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation currentPage="Business" siteTitle={CLIENT_CONFIG.SITE_TITLE} />
      <BusinessDetail business={businessData} />
    </div>
  );
}
