import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listArticles, NEWS_PHOTO_WHERE } from "@/app/_public/listing-data";
import { pageHref, Listing } from "@/components/public/listing/Listing";
import { parsePage } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  return buildMetadata({ title: [page > 1 ? `${t.newsPhoto} - ${t.page} ${page}` : t.newsPhoto], description: "Tin tức kèm ảnh và bộ ảnh mới nhất.", path: pageHref(`/${locale}/tin-anh`, page), locale });
}

/** Tin - Ảnh: bộ ảnh và tin có ảnh đại diện, hiển thị dạng lưới. */
export default async function NewsPhotoPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  const { items, pages } = await listArticles(NEWS_PHOTO_WHERE, page, 24);
  if (page > pages) notFound();
  return (
    <Listing
      locale={locale}
      title={t.newsPhoto}
      crumbs={[{ label: t.home, href: `/${locale}` }, { label: t.newsPhoto }]}
      items={items}
      page={page}
      pages={pages}
      basePath={`/${locale}/tin-anh`}
      grid
    />
  );
}
