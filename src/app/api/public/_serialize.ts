import type { ArticleCard } from "@/lib/repo/public";
import { absoluteUrl } from "@/lib/seo";
import { mediaUrl } from "@/lib/storage";
import { toIsoVN } from "@/lib/time";
import { articleUrl, categoryUrl } from "@/lib/urls";

/** Dạng JSON công khai của một thẻ tin. */
export function serializeCard(a: ArticleCard) {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    sapo: a.sapo,
    url: absoluteUrl(articleUrl(a)),
    publishedAt: a.publishedAt ? toIsoVN(a.publishedAt) : null,
    category: { name: a.primaryCat.name, url: absoluteUrl(categoryUrl(a.primaryCat)) },
    source: { name: a.source.name, slug: a.source.slug },
    image: a.cover ? absoluteUrl(mediaUrl(a.cover.key, "stand")) : null,
  };
}

export function json(data: unknown, maxAge = 60): Response {
  return Response.json(data, { headers: { "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 5}` } });
}

export function intParam(value: string | null, def: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
}
