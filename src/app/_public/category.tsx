import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { pageHref, Listing } from "@/components/public/listing/Listing";
import { parsePage, type Crumb } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { getCategoryArticles, getCategoryByPublicId } from "@/lib/repo/public";
import { buildMetadata } from "@/lib/seo";
import { parseSlugId } from "@/lib/slug";
import { categoryUrl } from "@/lib/urls";

type CatType = "NEWS" | "PHOTO" | "FEED";

export interface CategoryRouteProps {
  params: Promise<{ locale: string; catSlug?: string; feedSlug?: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

const loadCategory = cache(async (type: CatType, segment: string) => {
  const parsed = parseSlugId(segment);
  if (!parsed) return null;
  const cat = await getCategoryByPublicId(type, parsed.id);
  return cat ? { cat, slugMatches: cat.slug === parsed.slug } : null;
});

export async function categoryMetadata(type: CatType, segment: string, props: CategoryRouteProps): Promise<Metadata> {
  const [{ locale: l }, sp] = await Promise.all([props.params, props.searchParams]);
  const found = await loadCategory(type, segment);
  if (!found) return {};
  const locale = asLocale(l);
  const page = parsePage(sp.page);
  const t = dict(locale);
  return buildMetadata({
    title: [page > 1 ? `${found.cat.name} - ${t.page} ${page}` : found.cat.name],
    description: `${found.cat.name}: tin tức, ảnh, video mới nhất cập nhật liên tục trên Tin Tức Việt Nam.`,
    path: pageHref(categoryUrl(found.cat, locale), page),
    locale,
  });
}

/** Trang danh mục dùng chung cho NEWS (`tin-tuc`), FEED (`tin`), PHOTO (`anh`). */
export async function CategoryPage({ type, segment, props, parent }: { type: CatType; segment: string; props: CategoryRouteProps; parent?: Crumb }) {
  const [{ locale: l }, sp] = await Promise.all([props.params, props.searchParams]);
  const locale = asLocale(l);
  const found = await loadCategory(type, segment);
  if (!found) notFound();
  const { cat } = found;
  const base = categoryUrl(cat, locale);
  if (!found.slugMatches) permanentRedirect(base);

  const page = parsePage(sp.page);
  const { items, pages } = await getCategoryArticles(cat.id, page, 20);
  if (page > pages) notFound();
  const t = dict(locale);
  const crumbs: Crumb[] = [{ label: t.home, href: `/${locale}` }, ...(parent ? [parent] : []), { label: cat.name }];

  return <Listing locale={locale} title={cat.name} crumbs={crumbs} items={items} page={page} pages={pages} basePath={base} grid={type === "PHOTO"} />;
}
