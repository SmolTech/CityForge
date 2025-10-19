import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Navigation } from "@/components/shared";
import { BusinessDetail } from "@/components/cards";
import { CLIENT_CONFIG } from "@/lib/client-config";
import { logger } from "@/lib/logger";

interface BusinessPageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

async function getBusinessData(id: string, slug: string) {
  try {
    // Use BACKEND_API_URL for server-side requests (Docker), fallback to NEXT_PUBLIC_API_URL for client-side
    const API_BASE =
      process.env["BACKEND_API_URL"] ||
      process.env["NEXT_PUBLIC_API_URL"] ||
      process.env["NEXT_PUBLIC_API_BASE"] ||
      "http://localhost:5000";
    const url = `${API_BASE}/api/business/${id}/${slug}`;
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

export async function generateMetadata({
  params,
}: BusinessPageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const businessData = await getBusinessData(id, slug);

  if (!businessData || businessData.redirect) {
    return {
      title: "Business Not Found",
      description: "The requested business could not be found.",
    };
  }

  const business = businessData;
  const siteName = CLIENT_CONFIG.SITE_TITLE;

  return {
    title: `${business.name} - ${siteName}`,
    description:
      business.description ||
      `Learn more about ${business.name} in our community directory.`,
    openGraph: {
      title: `${business.name} - ${siteName}`,
      description:
        business.description ||
        `Learn more about ${business.name} in our community directory.`,
      type: "website",
      url: business.share_url,
      siteName: siteName,
      images: business.image_url
        ? [
            {
              url: business.image_url,
              width: 1200,
              height: 630,
              alt: `${business.name} logo`,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${business.name} - ${siteName}`,
      description:
        business.description ||
        `Learn more about ${business.name} in our community directory.`,
      images: business.image_url ? [business.image_url] : [],
    },
  };
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
