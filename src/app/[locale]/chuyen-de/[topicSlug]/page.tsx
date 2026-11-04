import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { listArticles } from "@/app/_public/listing-data";
import { pageHref, Listing } from "@/components/public/listing/Listing";
import { TopicBanner } from "@/components/public/TopicBanner";
import { parsePage } from "@/components/public/ui";
import { db } from "@/lib/db";
import { asLocale, dict } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { parseSlugId } from "@/lib/slug";
import { topicUrl } from "@/lib/urls";

type Props = { params: Promise<{ locale: string; topicSlug: string }>; searchParams: Promise<{ page?: string | string[] }> };

const loadTopic = cache(async (segment: string) => {
  const parsed = parseSlugId(segment);
  if (!parsed) return null;
  const topic = await db.topic.findFirst({ where: { id: parsed.id, isActive: true } });
  return topic ? { topic, slugMatches: topic.slug === parsed.slug } : null;
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: l, topicSlug } = await params;
  const found = await loadTopic(topicSlug);
  if (!found) return {};
  const locale = asLocale(l);
  const page = parsePage((await searchParams).page);
  const t = dict(locale);
  return buildMetadata({
    title: [page > 1 ? `${found.topic.name} - ${t.page} ${page}` : found.topic.name, t.topics],
    description: `Chuyên đề ${found.topic.name} trên Tin Tức Việt Nam.`,
    path: pageHref(topicUrl(found.topic, locale), page),
    locale,
    image: found.topic.bannerUrl,
  });
}

export default async function TopicPage({ params, searchParams }: Props) {
  const { locale: l, topicSlug } = await params;
  const locale = asLocale(l);
  const found = await loadTopic(topicSlug);
  if (!found) notFound();
  const { topic } = found;
  const base = topicUrl(topic, locale);
  if (!found.slugMatches) permanentRedirect(base);
  const page = parsePage((await searchParams).page);
  const { items, pages } = await listArticles({ topics: { some: { topicId: topic.id } } }, page, 20);
  if (page > pages) notFound();
  const t = dict(locale);
  return (
    <Listing
      locale={locale}
      title={topic.name}
      crumbs={[{ label: t.home, href: `/${locale}` }, { label: t.topics }, { label: topic.name }]}
      items={items}
      page={page}
      pages={pages}
      basePath={base}
      featured={false}
      intro={
        <div className="mb-5">
          <TopicBanner topic={topic} locale={locale} />
        </div>
      }
    />
  );
}
