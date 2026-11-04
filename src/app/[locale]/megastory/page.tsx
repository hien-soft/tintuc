import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listArticles } from "@/app/_public/listing-data";
import { ArticleCard } from "@/components/public/ArticleCard";
import { pageHref } from "@/components/public/listing/Listing";
import { Breadcrumb, EmptyState, Pagination, parsePage } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  return buildMetadata({ title: [page > 1 ? `${t.megastory} - ${t.page} ${page}` : t.megastory], description: "Mega Story: những câu chuyện chuyên sâu, đa phương tiện.", path: pageHref(`/${locale}/megastory`, page), locale });
}

export default async function MegaStoryListPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  const { items, pages } = await listArticles({ type: "MEGASTORY" }, page, 12);
  if (page > pages) notFound();
  return (
    <div>
      <Breadcrumb items={[{ label: t.home, href: `/${locale}` }, { label: t.megastory }]} />
      <h1 className="mb-5 border-b-2 border-brand pb-2 text-2xl font-bold text-brand sm:text-3xl">{t.megastory}</h1>
      {items.length === 0 ? (
        <EmptyState text={t.noArticles} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((a, i) => (
            <ArticleCard key={a.id} article={a} locale={locale} variant="lead" showSapo eager={i < 2} />
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} buildHref={(p) => pageHref(`/${locale}/megastory`, p)} labels={{ prev: t.prev, next: t.next, page: t.page }} />
    </div>
  );
}
