import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listArticles } from "@/app/_public/listing-data";
import { pageHref, Listing } from "@/components/public/listing/Listing";
import { parsePage } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  return buildMetadata({ title: [page > 1 ? `${t.graphic} - ${t.page} ${page}` : t.graphic], description: "Đồ họa, infographic tin tức.", path: pageHref(`/${locale}/graphic`, page), locale });
}

export default async function GraphicPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  const { items, pages } = await listArticles({ type: "GRAPHIC" }, page, 24);
  if (page > pages) notFound();
  return (
    <Listing
      locale={locale}
      title={t.graphic}
      crumbs={[{ label: t.home, href: `/${locale}` }, { label: t.graphic }]}
      items={items}
      page={page}
      pages={pages}
      basePath={`/${locale}/graphic`}
      grid
    />
  );
}
