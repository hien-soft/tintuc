import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageHref, Listing } from "@/components/public/listing/Listing";
import { parsePage } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { getCategoriesOfType, getCategoryArticles } from "@/lib/repo/public";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };

/** Nhóm "Thế giới" (FEED publicId 3) và "Kinh tế Thế giới" (1000) — dùng nhóm Thế giới. */
async function worldFeed() {
  const feeds = await getCategoriesOfType("FEED");
  return feeds.find((f) => f.publicId === 3) ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  return buildMetadata({
    title: [page > 1 ? `${t.world} - ${t.page} ${page}` : t.world],
    description: "Tin thế giới mới nhất: chính trị, kinh tế, xã hội quốc tế.",
    path: pageHref(`/${locale}/tin-the-gioi`, page),
    locale,
  });
}

export default async function WorldPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  const feed = await worldFeed();
  if (!feed) notFound();
  const { items, pages } = await getCategoryArticles(feed.id, page, 20);
  if (page > pages) notFound();
  return (
    <Listing
      locale={locale}
      title={t.world}
      crumbs={[{ label: t.home, href: `/${locale}` }, { label: t.world }]}
      items={items}
      page={page}
      pages={pages}
      basePath={`/${locale}/tin-the-gioi`}
    />
  );
}
