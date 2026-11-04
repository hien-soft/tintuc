import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getFeaturedTopics, getLatest } from "@/lib/repo/public";
import { absoluteUrl } from "@/lib/seo";
import { articleUrl, categoryUrl, topicUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

/** sitemap.xml: trang chính, danh mục, chuyên đề và 5.000 bài PUBLISHED mới nhất. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, topics, articles] = await Promise.all([
    db.category.findMany({ where: { isActive: true, locale: "vi" }, select: { slug: true, publicId: true, type: true } }),
    getFeaturedTopics(),
    getLatest(5000, { type: { not: "EXTERNAL" } }),
  ]);
  const now = new Date();
  const statics = ["/vi", "/en", "/vi/anh", "/vi/tin-anh", "/vi/tin-the-gioi", "/vi/graphic", "/vi/megastory", "/vi/video", "/vi/rss"].map((p) => ({
    url: absoluteUrl(p),
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: p === "/vi" ? 1 : 0.6,
  }));
  return [
    ...statics,
    ...categories.map((c) => ({ url: absoluteUrl(categoryUrl(c)), lastModified: now, changeFrequency: "hourly" as const, priority: 0.7 })),
    ...topics.map((t) => ({ url: absoluteUrl(topicUrl(t)), lastModified: now, changeFrequency: "daily" as const, priority: 0.5 })),
    ...articles.map((a) => ({ url: absoluteUrl(articleUrl(a)), lastModified: a.publishedAt ?? now, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
