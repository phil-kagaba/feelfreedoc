import type { MetadataRoute } from "next";
import { TOOLS } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const pages = ["", "/tools", "/about", "/contact", "/faq", "/privacy", "/terms", "/signup"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : 0.5 })),
    ...TOOLS.map((t) => ({ url: `${base}/${t.slug}`, changeFrequency: "monthly" as const, priority: t.popular ? 0.9 : 0.7 })),
  ];
}
