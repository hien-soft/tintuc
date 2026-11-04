import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCategoryArticles, getLatest } from "@/lib/repo/public";
import { parseSlugId } from "@/lib/slug";
import { intParam, json, serializeCard } from "../_serialize";

/** `?category={slug}-{publicId}&page=` — danh sách bài theo danh mục (hoặc mới nhất nếu không có danh mục). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = intParam(sp.get("page"), 1, 1000);
  const catParam = sp.get("category");
  if (!catParam) {
    const items = await getLatest(20, {}, (page - 1) * 20);
    return json({ page, items: items.map(serializeCard) });
  }
  const parsed = parseSlugId(catParam);
  const cat = parsed ? await db.category.findFirst({ where: { slug: parsed.slug, publicId: parsed.id, isActive: true, locale: "vi" } }) : null;
  if (!cat) return Response.json({ error: "NOT_FOUND", message: "Không tìm thấy danh mục" }, { status: 404 });
  const { items, total, pages } = await getCategoryArticles(cat.id, page, 20);
  return json({ category: { name: cat.name, slug: cat.slug, id: cat.publicId }, page, pages, total, items: items.map(serializeCard) });
}
