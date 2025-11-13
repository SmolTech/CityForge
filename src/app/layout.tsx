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
  // Use static defaults during build time to avoid database dependency
  // Dynamic configuration will be handled by the ConfigProvider at runtime
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
