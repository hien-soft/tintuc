import { xmlEscape as esc } from "@/app/_public/xml";
import { SITE_NAME } from "@/lib/config";
import { db } from "@/lib/db";
import { getCategoryArticles, getLatest, type ArticleCard } from "@/lib/repo/public";
import { absoluteUrl, SITE_TITLE } from "@/lib/seo";
import { parseSlugId } from "@/lib/slug";
import { mediaUrl } from "@/lib/storage";
import { articleUrl, categoryUrl } from "@/lib/urls";

function item(a: ArticleCard): string {
  const link = absoluteUrl(articleUrl(a));
  const parts = [
    `<title>${esc(a.title)}</title>`,
    `<link>${esc(link)}</link>`,
    `<guid isPermaLink="true">${esc(link)}</guid>`,
    a.sapo ? `<description>${esc(a.sapo)}</description>` : "",
    a.publishedAt ? `<pubDate>${a.publishedAt.toUTCString()}</pubDate>` : "",
    `<category>${esc(a.primaryCat.name)}</category>`,
    a.cover ? `<enclosure url="${esc(absoluteUrl(mediaUrl(a.cover.key, "stand")))}" type="image/webp" length="0"/>` : "",
  ];
  return `<item>${parts.join("")}</item>`;
}

/** RSS 2.0 theo danh mục (`chinh-tri-11`) hoặc `tin-moi-nhat`. */
export async function GET(_req: Request, { params }: { params: Promise<{ catSlug: string }> }) {
  const { catSlug } = await params;
  let title = `${SITE_TITLE} - Tin mới nhất`;
  let link = absoluteUrl("/vi");
  let items: ArticleCard[];

  if (catSlug === "tin-moi-nhat") {
    items = await getLatest(50);
  } else {
    const parsed = parseSlugId(catSlug);
    const cat = parsed ? await db.category.findFirst({ where: { slug: parsed.slug, publicId: parsed.id, isActive: true, locale: "vi" } }) : null;
    if (!cat) return new Response("Not found", { status: 404 });
    title = `${SITE_TITLE} - ${cat.name}`;
    link = absoluteUrl(categoryUrl(cat));
    items = (await getCategoryArticles(cat.id, 1, 50)).items;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(title)}</title>
<link>${esc(link)}</link>
<description>${esc(`${SITE_NAME} - ${title}`)}</description>
<language>vi</language>
<atom:link href="${esc(absoluteUrl(`/rss/${catSlug}`))}" rel="self" type="application/rss+xml"/>
<lastBuildDate>${(items[0]?.publishedAt ?? new Date()).toUTCString()}</lastBuildDate>
${items.map(item).join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
