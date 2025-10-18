import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300; // Revalidate every 5 minutes

export async function GET() {
  try {
    // Fetch site configuration from backend API
    // Use BACKEND_API_URL for server-side requests to backend container
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:5000";

    console.log(`Fetching site config from: ${backendUrl}/api/site-config`);

    const response = await fetch(`${backendUrl}/api/site-config`, {
      next: { revalidate: 300 }, // Cache backend response for 5 minutes
    });

    if (!response.ok) {
      console.error(`Backend API returned ${response.status}`);
      throw new Error(`Backend API returned ${response.status}`);
    }

    const config = await response.json();
    console.log("Site config loaded successfully:", config.site?.title);

    // Return the site configuration with caching headers
    return NextResponse.json(
      {
        site: config.site,
        pagination: config.pagination || { defaultLimit: 20 },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load site config:", error);

    // Fallback configuration with shorter cache
    return NextResponse.json(
      {
        site: {
          title: "Community Website",
          description:
            "Helping connect people to the resources available to them.",
          tagline: "Community Directory",
          directoryDescription:
            "Discover local resources and community information.",
          copyright: "2025",
          copyrightHolder: "Community",
          copyrightUrl: "#",
          domain: "community.local",
          shortName: "Community",
          fullName: "Community Website",
        },
        pagination: {
          defaultLimit: 20,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  }
}
