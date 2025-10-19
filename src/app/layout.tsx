import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { loadAppConfig } from "@/lib/server-config";
import { ToastProvider } from "@/components/shared";
import { ErrorBoundary } from "@/components/shared";
import { ConfigProvider } from "@/contexts/ConfigContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await loadAppConfig();
  return {
    title: config.site.title,
    description: config.site.description,
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
            <ToastProvider>{children}</ToastProvider>
          </ConfigProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
