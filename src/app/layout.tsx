import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/shared";
import { ErrorBoundary } from "@/components/shared";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { GoogleAnalytics } from "@/components/analytics";

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
    // Fetch configuration from our API endpoint
    const response = await fetch(
      `${process.env["NEXT_PUBLIC_SITE_URL"] || "http://localhost:3000"}/api/config`,
      {
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (response.ok) {
      const config = await response.json();
      return {
        title: config.site.title,
        description: config.site.description,
      };
    }
  } catch (error) {
    console.error("Failed to fetch metadata config:", error);
  }

  // Fallback to static defaults if API fetch fails
  return {
    title: "Community Website",
    description: "Helping connect people to the resources available to them.",
  };
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
