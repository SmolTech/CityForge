import { loadAppConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadAppConfig();

  const manifest = {
    name: config.site.fullName,
    short_name: config.site.shortName,
    description: config.site.description,
    start_url: "/",
    display: "standalone",
    background_color: config.site.backgroundColor,
    theme_color: config.site.themeColor,
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
