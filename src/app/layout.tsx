import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/shared";
import { ErrorBoundary } from "@/components/shared";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { GoogleAnalytics } from "@/components/analytics";
import { resourceQueries } from "@/lib/db/queries";

// Force dynamic rendering to avoid database queries during build
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    // Get configuration directly from database
    const configDict = await resourceQueries.getSiteConfig();

    const title = configDict["site_title"] || "Community Website";
    const description =
      configDict["site_description"] ||
      "Helping connect people to the resources available to them.";

    return {
      title,
      description,
    };
  } catch (error) {
    console.error("Failed to fetch metadata config from database:", error);

    // Fallback to static defaults if database query fails
    return {
      title: "Community Website",
      description: "Helping connect people to the resources available to them.",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <ConfigProvider>
            <AuthProvider>
              <GoogleAnalytics />
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </ConfigProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
