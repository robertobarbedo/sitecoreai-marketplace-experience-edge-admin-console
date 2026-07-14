import type { Metadata } from "next";
import { GoogleAnalytics } from "@/src/components/google-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Experience Edge Console",
  description: "SitecoreAI Marketplace console for the Experience Edge Admin API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans text-sm antialiased overflow-x-hidden">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
