import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLatest, publishedWhere } from "@/lib/repo/public";

/** Danh sách bài PUBLISHED theo điều kiện bổ sung, có phân trang. */
export async function listArticles(extra: Prisma.ArticleWhereInput, page: number, perPage = 20) {
  const [items, total] = await Promise.all([getLatest(perPage, extra, (page - 1) * perPage), db.article.count({ where: publishedWhere(extra) })]);
  return { items, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** "Tin - Ảnh": bộ ảnh + tin có ảnh đại diện. */
export const NEWS_PHOTO_WHERE: Prisma.ArticleWhereInput = {
  OR: [{ type: "PHOTO_STORY" }, { type: "NEWS", coverMediaId: { not: null } }],
};
