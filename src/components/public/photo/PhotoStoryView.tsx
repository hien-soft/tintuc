import Link from "next/link";
import { dict } from "@/lib/i18n";
import type { ArticleCard as Card, ArticleDetail } from "@/lib/repo/public";
import { mediaUrl } from "@/lib/storage";
import { formatDateTime, toIsoVN } from "@/lib/time";
import { articleUrl, categoryUrl, sourceSearchUrl, type PublicLocale } from "@/lib/urls";
import { ArticleCard } from "../ArticleCard";
import { PreviewBanner } from "../article/ArticleView";
import { ShareLinks } from "../article/ShareLinks";
import { Breadcrumb, SectionTitle } from "../ui";
import { PhotoGallery, type GalleryPhoto } from "./PhotoGallery";

interface Props {
  article: ArticleDetail;
  locale: PublicLocale;
  preview?: boolean;
  related?: Card[];
}

/** Hiển thị bộ ảnh. Không phụ thuộc trạng thái xuất bản, không ghi lượt xem (dùng lại cho CMS xem trước). */
export function PhotoStoryView({ article, locale, preview = false, related = [] }: Props) {
  const t = dict(locale);
  const cats = [article.primaryCat, ...article.categories.map((c) => c.category).filter((c) => c.id !== article.primaryCatId && c.isActive)];
  const photos: GalleryPhoto[] = article.photos.map((p) => ({
    id: p.id,
    thumb: mediaUrl(p.media.key, "thumb"),
    stand: mediaUrl(p.media.key, "stand"),
    large: mediaUrl(p.media.key, "large"),
    caption: p.caption,
    alt: p.media.alt ?? p.caption,
    time: p.takenAt ? formatDateTime(p.takenAt) : undefined,
  }));

  return (
    <article>
      {preview && <PreviewBanner locale={locale} />}
      <Breadcrumb
        items={[
          { label: t.home, href: `/${locale}` },
          { label: t.photo, href: `/${locale}/anh` },
          { label: article.primaryCat.name, href: categoryUrl(article.primaryCat, locale) },
        ]}
      />
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{article.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
        {article.publishedAt ? <time dateTime={toIsoVN(article.publishedAt)}>{formatDateTime(article.publishedAt)}</time> : <span className="italic">{t.notPublished}</span>}
        <span className="text-gray-300">|</span>
        <span>
          {photos.length} {t.photoCount}
        </span>
        <span className="text-gray-300">|</span>
        <Link href={sourceSearchUrl(article.source.slug, locale)} className="font-semibold text-brand hover:underline">
          {article.source.name}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-ink-soft">{t.attachedCategories}:</span>
        {cats.map((c) => (
          <Link key={c.id} href={categoryUrl(c, locale)} className="rounded-full border border-gray-200 px-3 py-1 text-xs hover:border-brand hover:text-brand">
            {c.name}
          </Link>
        ))}
      </div>
      {article.sapo && <p className="mt-4 text-lg font-bold leading-relaxed">{article.sapo}</p>}

      <div className="mt-5">
        <PhotoGallery photos={photos} labels={{ close: t.close, prev: t.prevPhoto, next: t.nextPhoto }} />
      </div>

      {photos.length > 0 && (
        <section className="mt-8">
          <SectionTitle title={t.photoList} />
          <ol className="space-y-8">
            {article.photos.map((p, i) => (
              <li key={p.id} id={`anh-${i + 1}`}>
                <figure>
                  <img src={mediaUrl(p.media.key, "stand")} alt={p.media.alt ?? p.caption} loading="lazy" width={p.media.width || undefined} height={p.media.height || undefined} className="h-auto w-full" />
                  <figcaption className="mt-2 text-sm leading-relaxed text-ink">
                    <span className="mr-2 font-bold text-brand">
                      {i + 1}/{photos.length}
                    </span>
                    {p.caption}
                    {p.takenAt && (
                      <time dateTime={toIsoVN(p.takenAt)} className="mt-1 block text-xs text-ink-soft">
                        {formatDateTime(p.takenAt)}
                      </time>
                    )}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </section>
      )}

      {article.contentHtml && <div className="article-body mt-6" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />}
      {article.authorName && <p className="mt-4 text-right font-bold">{article.authorName}</p>}

      <div className="mt-6 border-t border-gray-200 pt-4">
        <ShareLinks path={articleUrl(article, locale)} title={article.title} label={t.share} />
      </div>

      {related.length > 0 && (
        <section className="mt-8">
          <SectionTitle title={t.relatedPhotos} href={`/${locale}/anh`} more={t.viewAll} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
