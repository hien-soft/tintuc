import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/public/ArticleCard";
import { Ticker } from "@/components/public/home/Ticker";
import { MostViewedList } from "@/components/public/MostViewed";
import { Tabs, type TabPanel } from "@/components/public/Tabs";
import { TopicBanner } from "@/components/public/TopicBanner";
import { SectionTitle } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import {
  getByType,
  getCategoriesOfType,
  getCategoryArticles,
  getCategoryBlock,
  getFeaturedTopics,
  getHomeSlot,
  getLatest,
  getMenuCategories,
  getMostViewed,
  getTopicArticles,
  type ArticleCard as Card,
} from "@/lib/repo/public";
import { buildMetadata } from "@/lib/seo";
import { mediaUrl } from "@/lib/storage";
import { articleUrl, categoryUrl, topicUrl, type PublicLocale } from "@/lib/urls";

export const revalidate = 60;

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return buildMetadata({
    title: [],
    description:
      locale === "en"
        ? "Tin Tuc Viet Nam — latest news, photos, graphics and in-depth stories from Vietnam and the world."
        : "Tin Tức Việt Nam — tin tức mới nhất, ảnh, đồ họa và chuyên đề chuyên sâu về Việt Nam và thế giới.",
    path: `/${locale}`,
    locale,
  });
}

/** Kênh mạng xã hội cho khối "Hoạt động của TTVN" (cấu hình qua biến môi trường). */
const SOCIAL_CHANNELS = [
  { name: "Facebook", url: process.env.SOCIAL_FACEBOOK_URL },
  { name: "YouTube", url: process.env.SOCIAL_YOUTUBE_URL },
  { name: "TikTok", url: process.env.SOCIAL_TIKTOK_URL },
  { name: "Zalo", url: process.env.SOCIAL_ZALO_URL },
].filter((c): c is { name: string; url: string } => !!c.url && c.url.startsWith("https://"));

export default async function HomePage({ params }: Params) {
  const locale = asLocale((await params).locale);
  const t = dict(locale);

  const [ticker, heroSlot, topics, feeds, menu, otherNews, mostViewed, mediaAll, mediaPhoto, mediaGraphic, mediaNewsPhoto, megas, ttvnNews, asia, bw] =
    await Promise.all([
      getLatest(5),
      getHomeSlot("HOME_PHOTO_HERO"),
      getFeaturedTopics(),
      getCategoriesOfType("FEED"),
      getMenuCategories(),
      getLatest(10, { type: "NEWS" }, 5),
      getMostViewed(10, 3),
      getLatest(8, { type: { in: ["PHOTO_STORY", "GRAPHIC"] } }),
      getByType("PHOTO_STORY", 8),
      getByType("GRAPHIC", 8),
      getLatest(8, { type: "NEWS", coverMediaId: { not: null } }),
      getByType("MEGASTORY", 3),
      getLatest(4, { source: { slug: "ttvn" } }),
      getTopicArticles(19, 6),
      getTopicArticles(20, 6),
    ]);

  const photoFocus = heroSlot.length >= 6 ? heroSlot.slice(0, 6) : [...heroSlot, ...(await getByType("PHOTO_STORY", 12)).filter((a) => !heroSlot.some((h) => h.id === a.id))].slice(0, 6);
  const [feedBlocks, catBlocks, topicLatest] = await Promise.all([
    Promise.all(feeds.map(async (f) => ({ feed: f, items: (await getCategoryArticles(f.id, 1, 7)).items }))),
    Promise.all(menu.map(async (c) => ({ cat: c, items: await getCategoryBlock(c.id, 3) }))),
    Promise.all(topics.map((tp) => getTopicArticles(tp.id, 1))),
  ]);
  const topic19 = topics.find((x) => x.id === 19);
  const topic20 = topics.find((x) => x.id === 20);

  const feedPanels: TabPanel[] = feedBlocks
    .filter((b) => b.items.length > 0)
    .map(({ feed, items }) => ({
      key: String(feed.id),
      label: feed.name,
      content: (
        <div className="grid gap-5 md:grid-cols-2">
          <ArticleCard article={items[0]} locale={locale} variant="lead" showSapo />
          <div>
            <ul className="divide-y divide-gray-100">
              {items.slice(1).map((a) => (
                <li key={a.id} className="py-2 first:pt-0">
                  <ArticleCard article={a} locale={locale} variant="list" />
                </li>
              ))}
            </ul>
            <Link href={categoryUrl(feed, locale)} className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">
              {t.viewAll} ›
            </Link>
          </div>
        </div>
      ),
    }));

  const tileGrid = (items: Card[]) => (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((a) => (
        <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
      ))}
    </div>
  );
  const mediaPanels: TabPanel[] = [
    { key: "all", label: t.all, items: mediaAll },
    { key: "photo", label: t.photo, items: mediaPhoto },
    { key: "graphic", label: t.graphic, items: mediaGraphic },
    { key: "news-photo", label: t.newsPhoto, items: mediaNewsPhoto },
  ]
    .filter((p) => p.items.length > 0)
    .map((p) => ({ key: p.key, label: p.label, content: tileGrid(p.items) }));

  return (
    <div className="space-y-8">
      {/* 1. Tin mới nhất */}
      <Ticker items={ticker} locale={locale} label={t.latest} />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* 2. Tiêu điểm ảnh */}
        {photoFocus.length > 0 && (
          <section className={topics.length > 0 ? "lg:col-span-8" : "lg:col-span-12"}>
            <SectionTitle title={t.photoFocus} href={`/${locale}/anh`} more={t.viewAll} />
            <PhotoFocus items={photoFocus} locale={locale} />
          </section>
        )}
        {/* 3. Chuyên đề */}
        {topics.length > 0 && (
          <section className={photoFocus.length > 0 ? "lg:col-span-4" : "lg:col-span-12"}>
            <SectionTitle title={t.topics} />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] lg:flex-col lg:overflow-visible">
              {topics.map((tp, i) => (
                <div key={tp.id} className="w-[85%] shrink-0 snap-start sm:w-[48%] lg:w-full">
                  <TopicBanner topic={tp} locale={locale} index={i} subtitle={topicLatest[i]?.[0]?.title} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 4. Tin thời sự */}
      {feedPanels.length > 0 && <Tabs panels={feedPanels} title={<h2 className="-mb-0.5 py-1.5 pr-2 text-base font-bold uppercase text-brand">{t.currentNews}</h2>} />}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* 5. Lưới 13 danh mục */}
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
          {catBlocks
            .filter((b) => b.items.length > 0)
            .map(({ cat, items }) => (
              <section key={cat.id} className="min-w-0">
                <SectionTitle title={cat.name} href={categoryUrl(cat, locale)} />
                <ArticleCard article={items[0]} locale={locale} variant="lead" className="[&_h3]:text-base" />
                <ul className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
                  {items.slice(1).map((a) => (
                    <li key={a.id} className="py-2">
                      <ArticleCard article={a} locale={locale} variant="list" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
        <aside className="space-y-8 lg:col-span-4">
          {/* 6. Tin tức khác */}
          {otherNews.length > 0 && (
            <section>
              <SectionTitle title={t.otherNews} />
              <ul className="space-y-3">
                {otherNews.map((a) => (
                  <li key={a.id}>
                    <ArticleCard article={a} locale={locale} variant="thumb" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* 7. Tin xem nhiều */}
          {mostViewed.length > 0 && (
            <section>
              <SectionTitle title={t.mostViewed} />
              <MostViewedList items={mostViewed} locale={locale} />
            </section>
          )}
        </aside>
      </div>

      {/* 8. Media */}
      {mediaPanels.length > 0 && (
        <section className="bg-gray-50 p-4 sm:p-5">
          <Tabs panels={mediaPanels} title={<h2 className="-mb-0.5 py-1.5 pr-2 text-base font-bold uppercase text-brand">{t.media}</h2>} />
        </section>
      )}

      {/* 9. Mega Story */}
      {megas.length > 0 && (
        <section>
          <SectionTitle title={t.megastory} href={`/${locale}/megastory`} more={t.viewAll} />
          <MegaStoryStrip items={megas} locale={locale} />
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* 10. Hoạt động của TTVN */}
        <section>
          <SectionTitle title={t.activities} />
          <div className="rounded border border-gray-200 p-4">
            <p className="text-sm text-ink-soft">{t.activitiesNote}</p>
            {SOCIAL_CHANNELS.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {SOCIAL_CHANNELS.map((c) => (
                  <li key={c.name}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand-dark">
                      {c.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {ttvnNews.length > 0 && (
              <ul className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                {ttvnNews.map((a) => (
                  <li key={a.id}>
                    <ArticleCard article={a} locale={locale} variant="thumb" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        {/* 11. Tin vắn kinh tế châu Á */}
        {asia.length > 0 && <TopicList title={topic19?.name ?? "Tin vắn kinh tế châu Á"} href={topicUrl(topic19 ?? { id: 19, slug: "tin-van-kinh-te-chau-a" }, locale)} items={asia} locale={locale} more={t.viewAll} />}
        {/* 12. Business Wire */}
        {bw.length > 0 && <TopicList title={topic20?.name ?? "Business Wire"} href={topicUrl(topic20 ?? { id: 20, slug: "business-wire" }, locale)} items={bw} locale={locale} more={t.viewAll} />}
      </div>
    </div>
  );
}

function PhotoFocus({ items, locale }: { items: Card[]; locale: PublicLocale }) {
  const [lead, ...rest] = items;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <article className="group self-start overflow-hidden lg:col-span-3">
        <a href={articleUrl(lead, locale)} className="relative block">
          {lead.cover ? (
            <img src={mediaUrl(lead.cover.key, "stand")} alt={lead.cover.alt ?? lead.title} fetchPriority="high" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <div className="aspect-[4/3] w-full bg-gray-200" />
          )}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-16 text-white">
            <span className="mb-1 inline-block rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase">Ảnh</span>
            <span className="block text-xl font-bold leading-snug">{lead.title}</span>
          </span>
        </a>
      </article>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-2">
        {rest.slice(0, 5).map((a) => (
          <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
        ))}
      </div>
    </div>
  );
}

function MegaStoryStrip({ items, locale }: { items: Card[]; locale: PublicLocale }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((a, i) => (
        <article key={a.id} className={`group relative overflow-hidden bg-black ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}>
          <a href={articleUrl(a, locale)} className="block h-full">
            {a.cover && <img src={mediaUrl(a.cover.key, i === 0 ? "large" : "stand")} alt={a.cover.alt ?? a.title} loading="lazy" className="aspect-video h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12 text-white">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#ffd34d]">Mega Story</span>
              <span className={`block font-bold leading-snug ${i === 0 ? "text-2xl" : "text-base"}`}>{a.title}</span>
            </span>
          </a>
        </article>
      ))}
    </div>
  );
}

function TopicList({ title, href, items, locale, more }: { title: string; href: string; items: Card[]; locale: PublicLocale; more: string }) {
  return (
    <section>
      <SectionTitle title={title} href={href} more={more} />
      <ul className="divide-y divide-gray-100">
        {items.map((a) => (
          <li key={a.id} className="py-2 first:pt-0">
            <ArticleCard article={a} locale={locale} variant="list" />
          </li>
        ))}
      </ul>
    </section>
  );
}
