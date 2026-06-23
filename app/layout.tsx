import type { Metadata } from "next";
import { Exo_2, Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
const exo2 = Exo_2({ subsets: ["latin"], variable: "--font-exo2" });

const siteUrl = "https://clutchprintshop.com";
const homepageTitle = "Clutch Print Shop | Print Smarter. Track Everything.";
const homepageDescription =
  "Custom business cards, flyers, yard signs, postcards, banners, and business kits powered by Clutch QR™. Turn printed marketing into trackable marketing with scan analytics and measurable results.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: homepageTitle,
  description: homepageDescription,
  icons: {
    icon: "/clutch-logo.png",
    shortcut: "/clutch-logo.png",
    apple: "/clutch-logo.png",
  },
  openGraph: {
    title: homepageTitle,
    description: homepageDescription,
    url: siteUrl,
    siteName: "Clutch Print Shop",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: homepageTitle,
    description: homepageDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Clutch Print Shop",
    url: siteUrl,
    logo: `${siteUrl}/clutch-logo.png`,
    description: homepageDescription,
  };

  return (
    <html lang="en" className={`${montserrat.variable} ${exo2.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
