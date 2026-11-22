// frontend/lib/seo.ts
import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://educationos.app";
export const SITE_NAME = "EducationOS";
export const DEFAULT_TITLE = "EducationOS — Autonomous Operating System for Education";
export const DEFAULT_DESCRIPTION =
  "Comprehensive education technology platform for schools, colleges, and coaching academies. Biometric attendance, double-entry fee ledgers, NCTB grading, and AI lesson tools.";

interface MetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
}

export function constructMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  keywords = [
    "EducationOS",
    "School Management System",
    "Coaching Academy Software",
    "Bangladesh School Software",
    "NCTB Grading Software",
    "IPEMIS Compatible",
    "Student Attendance App",
    "Fee Collection Ledger",
  ],
  noIndex = false,
}: MetadataOptions = {}): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonicalUrl = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  return {
    title: fullTitle,
    description,
    keywords,
    authors: [{ name: "EducationOS Technologies" }],
    creator: "EducationOS Technologies",
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: "en_US",
      type: "website",
      images: [
        {
          url: `${SITE_URL}/icons/icon-512.png`,
          width: 512,
          height: 512,
          alt: "EducationOS Platform Preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [`${SITE_URL}/icons/icon-512.png`],
      creator: "@EducationOS",
    },
  };
}

export function generateSoftwareSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EducationOS",
    operatingSystem: "Web, iOS, Android (PWA)",
    applicationCategory: "EducationalApplication",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: "990",
      highPrice: "9990",
      offerCount: "5",
    },
    description: DEFAULT_DESCRIPTION,
  };
}

