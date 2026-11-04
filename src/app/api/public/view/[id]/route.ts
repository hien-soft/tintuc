import { db } from "@/lib/db";
import { publishedWhere, recordView } from "@/lib/repo/public";

/** Beacon ghi lượt xem (gọi từ ViewBeacon phía client). Chỉ tính cho bài PUBLISHED. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 404 });
  const exists = await db.article.count({ where: publishedWhere({ id }) });
  if (!exists) return new Response(null, { status: 404 });
  await recordView(id);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
