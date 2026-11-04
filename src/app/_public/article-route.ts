import type { NextRequest } from "next/server";
import { relativeRedirect } from "@/lib/http";
import { isLocale } from "@/lib/i18n";
import { getPublicArticle } from "@/lib/repo/public";
import { parseSlugId } from "@/lib/slug";
import { articleUrl } from "@/lib/urls";
import { proxyRender } from "./internal-render";

/**
 * Xử lý chung cho URL chi tiết bài (`tin-tuc/.../x-1.html`, `anh/.../x-1.html`, `megastory/x-1.html`):
 * - không tồn tại / chưa xuất bản → 404
 * - đã gỡ (UNPUBLISHED / ARCHIVED) → 410
 * - URL không chuẩn (sai slug, sai danh mục) → 308 về URL canonical
 * - còn lại → HTML của trang nội bộ.
 */
export async function serveArticle(req: NextRequest, localeParam: string, fileSegment: string): Promise<Response> {
  const locale = isLocale(localeParam) ? localeParam : "vi";
  const missing = () => proxyRender(req, `/${locale}/render/missing`, 404);
  if (!isLocale(localeParam) || !fileSegment.endsWith(".html")) return missing();
  const parsed = parseSlugId(fileSegment);
  if (!parsed || !Number.isSafeInteger(parsed.id)) return missing();

  const result = await getPublicArticle(parsed.id);
  if (!result) return missing();
  if ("gone" in result) return proxyRender(req, `/${locale}/render/gone`, 410);

  const canonical = articleUrl(result.article, locale);
  if (decodeURIComponent(req.nextUrl.pathname) !== canonical) {
    return relativeRedirect(canonical + req.nextUrl.search, 308);
  }
  return proxyRender(req, `/${locale}/render/article/${parsed.id}`);
}
