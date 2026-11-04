import { db } from "@/lib/db";
import { publishedWhere, recordView } from "@/lib/repo/public";

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

const notFound = () => new Response("Not found", { status: 404 });

/** Bài nguồn ngoài: tăng lượt xem rồi 302 sang externalUrl (chỉ https + domain thuộc bảng Source). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return notFound();
  const article = await db.article.findFirst({ where: publishedWhere({ id, type: "EXTERNAL" }), select: { id: true, externalUrl: true } });
  if (!article?.externalUrl) return notFound();

  let target: URL;
  try {
    target = new URL(article.externalUrl);
  } catch {
    return notFound();
  }
  if (target.protocol !== "https:" || target.username || target.password) return notFound();

  const sources = await db.source.findMany({ where: { homepage: { not: null } }, select: { homepage: true } });
  const allowed = new Set(
    sources.flatMap((s) => {
      try {
        return [normalizeHost(new URL(s.homepage ?? "").hostname)];
      } catch {
        return [];
      }
    }),
  );
  if (!allowed.has(normalizeHost(target.hostname))) return notFound();

  await recordView(article.id);
  return new Response(null, { status: 302, headers: { Location: target.toString(), "Cache-Control": "no-store" } });
}
