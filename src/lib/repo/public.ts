/**
 * Repository dùng cho mọi route public. MỌI truy vấn bài viết ở public phải đi qua `publishedWhere()`
 * để bảo đảm chỉ bài PUBLISHED được hiển thị (mục 10).
 */
import type { ArticleType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { vnDay } from "@/lib/time";
import { removeDiacritics } from "@/lib/slug";
import type { PublicAd } from "@/lib/ads";
import { mediaUrl } from "@/lib/storage";

export function publishedWhere(extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
  return { AND: [{ status: "PUBLISHED", publishedAt: { lte: new Date() } }, extra] };
}

/** Trường dùng cho thẻ tin. */
export const cardSelect = {
  id: true,
  type: true,
  title: true,
  slug: true,
  sapo: true,
  publishedAt: true,
  isPinned: true,
  externalUrl: true,
  primaryCat: { select: { slug: true, publicId: true, type: true, name: true } },
  source: { select: { name: true, slug: true } },
  cover: { select: { key: true, alt: true, caption: true } },
} satisfies Prisma.ArticleSelect;

export type ArticleCard = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;

const latestOrder: Prisma.ArticleOrderByWithRelationInput[] = [{ publishedAt: "desc" }, { id: "desc" }];

export function getLatest(take = 10, extra: Prisma.ArticleWhereInput = {}, skip = 0): Promise<ArticleCard[]> {
  return db.article.findMany({ where: publishedWhere(extra), select: cardSelect, orderBy: latestOrder, take, skip });
}

/** Điều kiện "bài thuộc danh mục": danh mục chính hoặc danh mục phụ. */
export function inCategory(categoryId: number): Prisma.ArticleWhereInput {
  return { OR: [{ primaryCatId: categoryId }, { categories: { some: { categoryId } } }] };
}

export async function getCategoryArticles(categoryId: number, page = 1, perPage = 20) {
  const where = publishedWhere(inCategory(categoryId));
  const [items, total] = await Promise.all([
    db.article.findMany({ where, select: cardSelect, orderBy: [{ isPinned: "desc" }, ...latestOrder], take: perPage, skip: (page - 1) * perPage }),
    db.article.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Tin chính + 2 tin phụ cho lưới danh mục trang chủ, ưu tiên bài ghim. */
export function getCategoryBlock(categoryId: number, take = 3): Promise<ArticleCard[]> {
  return db.article.findMany({
    where: publishedWhere({ ...inCategory(categoryId), type: { not: "PHOTO_STORY" } }),
    select: cardSelect,
    orderBy: [{ isPinned: "desc" }, ...latestOrder],
    take,
  });
}

export function getByType(type: ArticleType, take = 10, skip = 0): Promise<ArticleCard[]> {
  return getLatest(take, { type }, skip);
}

export function getTopicArticles(topicId: number, take = 10, skip = 0): Promise<ArticleCard[]> {
  return getLatest(take, { topics: { some: { topicId } } }, skip);
}

/** Top bài xem nhiều trong N ngày gần nhất. */
export async function getMostViewed(take = 10, days = 3): Promise<ArticleCard[]> {
  const since = new Date(vnDay().getTime() - (days - 1) * 86400_000);
  const grouped = await db.articleDailyView.groupBy({
    by: ["articleId"],
    where: { day: { gte: since }, article: publishedWhere() },
    _sum: { count: true },
    orderBy: { _sum: { count: "desc" } },
    take,
  });
  const ids = grouped.map((g) => g.articleId);
  const items = await db.article.findMany({ where: publishedWhere({ id: { in: ids } }), select: cardSelect });
  return ids.map((id) => items.find((a) => a.id === id)).filter((a): a is ArticleCard => !!a);
}

export const articleDetailInclude = {
  primaryCat: true,
  source: true,
  cover: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  topics: { include: { topic: true } },
  photos: { include: { media: true }, orderBy: { order: "asc" } },
} satisfies Prisma.ArticleInclude;

export type ArticleDetail = Prisma.ArticleGetPayload<{ include: typeof articleDetailInclude }>;

/**
 * Lấy bài để hiển thị ở public.
 * Trả về `{ gone: true }` nếu bài đã bị gỡ (route trả 410), null nếu không tồn tại / chưa xuất bản (404).
 */
export async function getPublicArticle(id: number): Promise<{ article: ArticleDetail } | { gone: true } | null> {
  const article = await db.article.findFirst({ where: publishedWhere({ id }), include: articleDetailInclude });
  if (article) return { article };
  const other = await db.article.findUnique({ where: { id }, select: { status: true } });
  if (other && (other.status === "UNPUBLISHED" || other.status === "ARCHIVED")) return { gone: true };
  return null;
}

export function getRelated(article: { id: number; primaryCatId: number }, take = 6): Promise<ArticleCard[]> {
  return getLatest(take, { primaryCatId: article.primaryCatId, id: { not: article.id } });
}

/** Tăng lượt xem (tổng + theo ngày). */
export async function recordView(articleId: number): Promise<void> {
  const day = vnDay();
  await db.$transaction([
    db.article.update({ where: { id: articleId }, data: { viewCount: { increment: 1 } } }),
    db.articleDailyView.upsert({
      where: { articleId_day: { articleId, day } },
      create: { articleId, day, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ]);
}

export function getMenuCategories() {
  return db.category.findMany({ where: { type: "NEWS", isActive: true, locale: "vi" }, orderBy: { order: "asc" } });
}

export function getCategoryByPublicId(type: "NEWS" | "PHOTO" | "FEED", publicId: number) {
  return db.category.findFirst({ where: { type, publicId, isActive: true, locale: "vi" } });
}

export function getCategoriesOfType(type: "NEWS" | "PHOTO" | "FEED") {
  return db.category.findMany({ where: { type, isActive: true, locale: "vi" }, orderBy: { order: "asc" } });
}

export function getPartners() {
  return db.partner.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
}

/**
 * Quảng cáo đang bật và chưa hết hạn (kể cả quảng cáo sắp đến lịch, để client tự bật đúng giờ dù trang được cache).
 * `href` trỏ tới /go/{id} để đếm lượt bấm.
 */
export async function getActiveAds(): Promise<PublicAd[]> {
  const rows = await db.ad.findMany({
    where: { isActive: true, OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: { media: { select: { key: true, width: true, height: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    position: a.position,
    name: a.name,
    image: mediaUrl(a.media.key, "stand"),
    thumb: mediaUrl(a.media.key, "thumb"),
    width: a.media.width,
    height: a.media.height,
    href: a.linkUrl ? `/go/${a.id}` : null,
    newTab: a.openNewTab,
    homeOnly: a.homeOnly,
    frequency: a.frequency,
    startAt: a.startAt?.toISOString() ?? null,
    endAt: a.endAt?.toISOString() ?? null,
  }));
}

export function getFeaturedTopics() {
  return db.topic.findMany({ where: { isFeatured: true, isActive: true }, orderBy: { order: "asc" } });
}

export async function getHomeSlot(key: string): Promise<ArticleCard[]> {
  const slot = await db.homeSlot.findUnique({ where: { key } });
  if (!slot || slot.articleIds.length === 0) return [];
  const items = await db.article.findMany({ where: publishedWhere({ id: { in: slot.articleIds } }), select: cardSelect });
  return slot.articleIds.map((id) => items.find((a) => a.id === id)).filter((a): a is ArticleCard => !!a);
}

export interface SearchParams {
  q?: string;
  source?: string;
  category?: number;
  from?: Date;
  to?: Date;
  page?: number;
}

/** Tìm kiếm không phân biệt dấu bằng tsvector + unaccent. */
export async function searchArticles(params: SearchParams, perPage = 20) {
  const page = Math.max(1, params.page ?? 1);
  const filters: Prisma.ArticleWhereInput[] = [];
  if (params.source) filters.push({ source: { slug: params.source } });
  if (params.category) filters.push(inCategory(params.category));
  if (params.from) filters.push({ publishedAt: { gte: params.from } });
  if (params.to) filters.push({ publishedAt: { lte: params.to } });

  const terms = removeDiacritics(params.q ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length) {
    const tsquery = terms.map((t) => `${t}:*`).join(" & ");
    const rows = await db.$queryRaw<{ id: number }[]>`
      SELECT "id" FROM "Article"
      WHERE "status" = 'PUBLISHED' AND "searchVector" @@ to_tsquery('simple', ${tsquery})
      ORDER BY ts_rank("searchVector", to_tsquery('simple', ${tsquery})) DESC, "publishedAt" DESC
      LIMIT 500`;
    filters.push({ id: { in: rows.map((r) => r.id) } });
  }
  const where = publishedWhere({ AND: filters });
  const [items, total] = await Promise.all([
    db.article.findMany({ where, select: cardSelect, orderBy: latestOrder, take: perPage, skip: (page - 1) * perPage }),
    db.article.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}
