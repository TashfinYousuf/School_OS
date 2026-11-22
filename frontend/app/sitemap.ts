import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://educationos.app";
  const now = new Date();

  const publicRoutes = [
    "",
    "/about",
    "/mission",
    "/solutions",
    "/solutions/schools",
    "/solutions/colleges",
    "/solutions/academies",
    "/features",
    "/pricing",
    "/security",
    "/technology",
    "/docs",
    "/help",
    "/contact",
    "/support",
    "/legal/privacy",
    "/legal/terms",
    "/legal/refund",
    "/legal/cancellation",
    "/login",
    "/onboard",
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/pricing" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : route === "/pricing" || route === "/onboard" ? 0.9 : 0.7,
  }));
}

