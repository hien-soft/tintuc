import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Hàng đợi duyệt: tin khẩn trước, sau đó theo thời gian gửi tăng dần. */
export async function loadQueue(where: Prisma.ArticleWhereInput, level: 1 | 2) {
  const rows = await db.article.findMany({
    where,
    include: { author: { select: { fullName: true } }, primaryCat: { select: { name: true } } },
    orderBy: [{ isUrgent: "desc" }, level === 1 ? { submittedAt: "asc" } : { l1ApprovedAt: "asc" }],
  });
  const holderIds = [...new Set(rows.map((r) => r.holderId).filter((x): x is string => !!x))];
  const holders = new Map((await db.user.findMany({ where: { id: { in: holderIds } }, select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({ ...r, holder: r.holderId ? holders.get(r.holderId) ?? null : null }));
}
