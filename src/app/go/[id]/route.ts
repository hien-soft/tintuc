import { db } from "@/lib/db";
import { isSafeAdLink } from "@/lib/ads";
import { relativeRedirect } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Bấm quảng cáo: tăng lượt bấm rồi chuyển tới liên kết đích.
 * Đích lấy từ DB (đã kiểm tra khi lưu), không nhận từ query string → không thành open redirect.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const ad = await db.ad.findUnique({ where: { id }, select: { linkUrl: true, isActive: true } });
  if (!ad?.linkUrl || !ad.isActive || !isSafeAdLink(ad.linkUrl)) return relativeRedirect("/", 302);

  await db.ad.update({ where: { id }, data: { clicks: { increment: 1 } } });
  if (ad.linkUrl.startsWith("/")) return relativeRedirect(ad.linkUrl, 302);
  return new Response(null, { status: 302, headers: { Location: new URL(ad.linkUrl).toString(), "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
