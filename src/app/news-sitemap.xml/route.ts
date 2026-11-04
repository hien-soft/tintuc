import { xmlEscape as esc } from "@/app/_public/xml";
import { SITE_NAME } from "@/lib/config";
import { getLatest } from "@/lib/repo/public";
import { absoluteUrl } from "@/lib/seo";
import { toIsoVN } from "@/lib/time";
import { articleUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

/** Google News sitemap: bài xuất bản trong 48 giờ gần nhất (tối đa 1000). */
export async function GET() {
  const since = new Date(Date.now() - 48 * 3600_000);
  const items = await getLatest(1000, { publishedAt: { gte: since }, type: { not: "EXTERNAL" } });
  const urls = items
    .map((a) => {
      const loc = absoluteUrl(articleUrl(a));
      const date = a.publishedAt ? toIsoVN(a.publishedAt) : "";
      return `<url><loc>${esc(loc)}</loc><news:news><news:publication><news:name>${esc(SITE_NAME)}</news:name><news:language>vi</news:language></news:publication><news:publication_date>${date}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
