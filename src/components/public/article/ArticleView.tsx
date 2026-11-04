import Link from "next/link";
import { dict } from "@/lib/i18n";
import type { ArticleCard as Card, ArticleDetail } from "@/lib/repo/public";
import { mediaUrl } from "@/lib/storage";
import { formatDateTime, toIsoVN } from "@/lib/time";
import { articleUrl, categoryUrl, sourceSearchUrl, topicUrl, type PublicLocale } from "@/lib/urls";
import { ArticleCard } from "../ArticleCard";
import { Breadcrumb, SectionTitle, type Crumb } from "../ui";
import { ShareLinks } from "./ShareLinks";

interface Props {
  article: ArticleDetail;
  locale: PublicLocale;
  /** Hiển thị băng "Bản xem trước" (dùng cho CMS). */
  preview?: boolean;
  related?: Card[];
  sameCategory?: Card[];
  /** Nội dung cột phải (VD Tin xem nhiều). */
  sidebar?: React.ReactNode;
}

export function PreviewBanner({ locale }: { locale: PublicLocale }) {
  return (
    <div role="status" className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
      {dict(locale).preview}
    </div>
  );
}

/**
 * Hiển thị chi tiết bài viết (tin, đồ họa, Mega Story). Không phụ thuộc trạng thái xuất bản và không ghi lượt xem
 * để CMS dùng lại cho trang xem trước.
 */
export function ArticleView({ article, locale, preview = false, related = [], sameCategory = [], sidebar }: Props) {
  const t = dict(locale);
  const path = articleUrl(article, locale);
  const crumbs: Crumb[] = [{ label: t.home, href: `/${locale}` }];
  if (article.type === "MEGASTORY") crumbs.push({ label: t.megastory, href: `/${locale}/megastory` });
  else if (article.type === "GRAPHIC") crumbs.push({ label: t.graphic, href: `/${locale}/graphic` });
  crumbs.push({ label: article.primaryCat.name, href: categoryUrl(article.primaryCat, locale) });
  const time = article.publishedAt;
  const extraCats = article.categories.map((c) => c.category).filter((c) => c.id !== article.primaryCatId && c.isActive);
  const isMega = article.type === "MEGASTORY";

  return (
    <div className={sidebar && !isMega ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}>
      <article className={isMega ? "mx-auto max-w-3xl" : "min-w-0"}>
        {preview && <PreviewBanner locale={locale} />}
        <Breadcrumb items={crumbs} />
        <h1 className={`font-bold leading-tight text-ink ${isMega ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{article.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-200 pb-3 text-sm text-ink-soft">
          {time ? <time dateTime={toIsoVN(time)}>{formatDateTime(time)}</time> : <span className="italic">{t.notPublished}</span>}
          {article.authorName && (
            <>
              <span className="text-gray-300">|</span>
              <span>
                {t.author}: <strong className="text-ink">{article.authorName}</strong>
              </span>
            </>
          )}
          <span className="text-gray-300">|</span>
          <span>
            {t.source}:{" "}
            <Link href={sourceSearchUrl(article.source.slug, locale)} className="font-semibold text-brand hover:underline">
              {article.source.name}
            </Link>
          </span>
        </div>

        {article.sapo && <p className="mt-4 text-lg font-bold leading-relaxed text-ink">{article.sapo}</p>}

        {article.cover && (
          <figure className="my-5">
            <img
              src={mediaUrl(article.cover.key, "large")}
              alt={article.cover.alt ?? article.title}
              width={article.cover.width || undefined}
              height={article.cover.height || undefined}
              fetchPriority="high"
              className="h-auto w-full"
            />
            {article.cover.caption && <figcaption className="bg-gray-50 px-3 py-2 text-center text-sm italic text-ink-soft">{article.cover.caption}</figcaption>}
          </figure>
        )}

        {article.type === "EXTERNAL" && article.externalUrl && (
          <p className="my-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
            {t.external}:{" "}
            <a href={article.externalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">
              {t.readOriginal}
            </a>
          </p>
        )}

        {/* contentHtml đã được sanitize khi lưu (mục 10). */}
        {article.contentHtml && <div className="article-body mt-4" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />}

        {article.correctionNote && (
          <aside className="mt-6 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm">
            <p className="font-bold text-amber-900">
              {t.correction}
              {article.correctedAt && (
                <>
                  {" "}
                  (<time dateTime={toIsoVN(article.correctedAt)}>{formatDateTime(article.correctedAt)}</time>)
                </>
              )}
              :
            </p>
            <p className="mt-1 text-ink">{article.correctionNote}</p>
          </aside>
        )}

        {article.authorName && <p className="mt-4 text-right font-bold">{article.authorName}</p>}

        {(article.tags.length > 0 || extraCats.length > 0 || article.topics.length > 0) && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
            <span className="text-xs font-bold uppercase text-ink-soft">{t.tags}:</span>
            {article.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/${locale}/search?q=${encodeURIComponent(tag.name)}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs hover:bg-brand-light hover:text-brand">
                #{tag.name}
              </Link>
            ))}
            {article.topics.map(({ topic }) => (
              <Link key={`t${topic.id}`} href={topicUrl(topic, locale)} className="rounded-full bg-brand-light px-3 py-1 text-xs text-brand hover:underline">
                {topic.name}
              </Link>
            ))}
            {extraCats.map((c) => (
              <Link key={`c${c.id}`} href={categoryUrl(c, locale)} className="rounded-full border border-gray-200 px-3 py-1 text-xs hover:border-brand hover:text-brand">
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4">
          <ShareLinks path={path} title={article.title} label={t.share} />
        </div>

        {related.length > 0 && (
          <section className="mt-8">
            <SectionTitle title={t.related} />
            <ul className="space-y-3">
              {related.map((a) => (
                <li key={a.id}>
                  <ArticleCard article={a} locale={locale} variant="row" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {sameCategory.length > 0 && (
          <section className="mt-8">
            <SectionTitle title={`${t.sameCategory}: ${article.primaryCat.name}`} href={categoryUrl(article.primaryCat, locale)} more={t.viewAll} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {sameCategory.map((a) => (
                <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
              ))}
            </div>
          </section>
        )}
      </article>
      {sidebar && !isMega && <aside className="space-y-8">{sidebar}</aside>}
    </div>
  );
}
