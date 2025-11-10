import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [],
  // Selective API proxy - only forward non-migrated endpoints to Flask backend
  async rewrites() {
    const backendUrl =
      process.env["BACKEND_API_URL"] || "http://localhost:5000";

    return [
      // Proxy non-migrated endpoints to Flask backend
      // Cards API has been migrated to Next.js, so no longer proxy those
      {
        source: "/api/resources/:path*",
        destination: `${backendUrl}/api/resources/:path*`,
      },
      {
        source: "/api/tags",
        destination: `${backendUrl}/api/tags`,
      },
      {
        source: "/api/submissions/:path*",
        destination: `${backendUrl}/api/submissions/:path*`,
      },
      {
        source: "/api/search/:path*",
        destination: `${backendUrl}/api/search/:path*`,
      },
      {
        source: "/api/config",
        destination: `${backendUrl}/api/site-config`,
      },
      {
        source: "/api/site-config",
        destination: `${backendUrl}/api/site-config`,
      },
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
      {
        source: "/api/upload",
        destination: `${backendUrl}/api/upload`,
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
