import type { NextRequest } from "next/server";
import { serveArticle } from "@/app/_public/article-route";

/** Chi tiết bài viết: route handler để trả được 410 cho bài đã gỡ (xem `_public/internal-render.ts`). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string; catSlug: string; articleSlug: string }> }) {
  const { locale, articleSlug } = await params;
  return serveArticle(req, locale, articleSlug);
}
