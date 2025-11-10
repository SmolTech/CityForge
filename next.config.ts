import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  // Selective API proxy - only forward non-migrated endpoints to Flask backend
  async rewrites() {
    const backendUrl =
      process.env["BACKEND_API_URL"] || "http://localhost:5000";

    return [
      // Proxy non-migrated endpoints to Flask backend
      // Cards API, Tags API, Site Config API, Resources API, Submissions API, Search API, and Upload API have been migrated to Next.js
      {
        source: "/api/forums/:path*",
        destination: `${backendUrl}/api/forums/:path*`,
      },
      {
        source: "/api/help-wanted/:path*",
        destination: `${backendUrl}/api/help-wanted/:path*`,
      },
      {
        source: "/api/support-tickets/:path*",
        destination: `${backendUrl}/api/support-tickets/:path*`,
      },
      // Admin endpoints that haven't been migrated yet
      {
        source: "/api/admin/cards/:path*",
        destination: `${backendUrl}/api/admin/cards/:path*`,
      },
      {
        source: "/api/admin/resources/:path*",
        destination: `${backendUrl}/api/admin/resources/:path*`,
      },
      {
        source: "/api/admin/forums/:path*",
        destination: `${backendUrl}/api/admin/forums/:path*`,
      },
    ];
  },
};

export default nextConfig;
