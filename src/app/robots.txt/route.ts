import { loadAppConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadAppConfig();

  const robotsContent = `User-agent: *
Allow: /

Sitemap: https://${config.site.domain}/sitemap.xml`;

  return new Response(robotsContent, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
