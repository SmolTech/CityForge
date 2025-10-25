"use client";

import Script from "next/script";
import { useConfig } from "@/contexts/ConfigContext";

/**
 * Google Analytics component that loads GA4 tracking script
 * Only loads if googleAnalyticsId is configured in site settings
 */
export function GoogleAnalytics() {
  const config = useConfig();
  const gaId = config.site.googleAnalyticsId;

  // Don't render anything if GA ID is not configured
  if (!gaId || gaId.trim() === "") {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
