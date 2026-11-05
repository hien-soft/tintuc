import Link from "next/link";
import type { ArticleCard as Card } from "@/lib/repo/public";
import { mediaUrl } from "@/lib/storage";
import { formatRelative, toIsoVN } from "@/lib/time";
import { articleUrl, sourceSearchUrl, type PublicLocale } from "@/lib/urls";

export type CardVariant = "lead" | "list" | "ticker" | "row" | "thumb" | "tile";

interface Props {
  article: Card;
  variant?: CardVariant;
  locale: PublicLocale;
  /** Ảnh ưu tiên tải (khối đầu trang). */
  eager?: boolean;
  className?: string;
  showSapo?: boolean;
}

/**
 * Liên kết bài viết dùng thẻ <a> thường (không prefetch) vì URL chi tiết bài do route handler phục vụ
 * (để trả được 410 cho bài đã gỡ).
 */
function ArticleAnchor({ article, locale, className, children }: { article: Card; locale: PublicLocale; className?: string; children: React.ReactNode }) {
  const external = article.type === "EXTERNAL";
  return (
    <a href={articleUrl(article, locale)} className={className} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
      {children}
    </a>
  );
}

export function CardMeta({ article, locale, className = "" }: { article: Card; locale: PublicLocale; className?: string }) {
  return (
    <p className={`text-xs text-ink-muted ${className}`}>
      {article.publishedAt && <time dateTime={toIsoVN(article.publishedAt)}>{formatRelative(article.publishedAt, new Date(), locale)}</time>}
      {article.publishedAt && <span className="mx-1.5 text-gray-300" aria-hidden="true">•</span>}
      <Link href={sourceSearchUrl(article.source.slug, locale)} className="font-semibold text-brand hover:text-brand-dark">
        {article.source.name}
      </Link>
    </p>
  );
}

function TypeBadge({ article }: { article: Card }) {
  const label = article.type === "PHOTO_STORY" ? "Ảnh" : article.type === "GRAPHIC" ? "Đồ họa" : article.type === "MEGASTORY" ? "Mega" : null;
  if (!label) return null;
  return <span className="absolute left-2.5 top-2.5 inline-flex h-6 items-center rounded-full bg-white/95 px-2.5 text-[11px] font-bold text-brand shadow-xs backdrop-blur">{label}</span>;
}

function Cover({ article, size, eager, className }: { article: Card; size: "thumb" | "stand" | "large"; eager?: boolean; className: string }) {
  if (!article.cover) return <div className={`${className} bg-grad-soft`} aria-hidden="true" />;
  return (
    <img
      src={mediaUrl(article.cover.key, size)}
      alt={article.cover.alt ?? article.title}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className={`${className} object-cover`}
    />
  );
}

export function ArticleCard({ article, variant = "list", locale, eager, className = "", showSapo }: Props) {
  switch (variant) {
    case "lead":
      return (
        <article className={`group ${className}`}>
          <ArticleAnchor article={article} locale={locale} className="relative block overflow-hidden rounded-lg">
            <Cover article={article} size="stand" eager={eager} className="aspect-video w-full transition duration-300 ease-ds ease-ds group-hover:scale-[1.04]" />
            <TypeBadge article={article} />
          </ArticleAnchor>
          <h3 className="mt-3 text-lg font-bold leading-snug text-ink sm:text-[22px] sm:leading-tight">
            <ArticleAnchor article={article} locale={locale} className="hover:text-brand">
              {article.title}
            </ArticleAnchor>
          </h3>
          <CardMeta article={article} locale={locale} className="mt-1" />
          {showSapo && article.sapo && <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">{article.sapo}</p>}
        </article>
      );
    case "tile":
      return (
        <article className={`group ${className}`}>
          <ArticleAnchor article={article} locale={locale} className="relative block overflow-hidden rounded-md">
            <Cover article={article} size="thumb" eager={eager} className="aspect-video w-full transition duration-300 ease-ds group-hover:scale-[1.04]" />
            <TypeBadge article={article} />
          </ArticleAnchor>
          <h3 className="mt-2 line-clamp-3 text-sm font-bold leading-snug text-ink">
            <ArticleAnchor article={article} locale={locale} className="hover:text-brand">
              {article.title}
            </ArticleAnchor>
          </h3>
          <CardMeta article={article} locale={locale} className="mt-1" />
        </article>
      );
    case "row":
      return (
        <article className={`flex gap-3 sm:gap-4 ${className}`}>
          <ArticleAnchor article={article} locale={locale} className="relative block w-32 shrink-0 overflow-hidden rounded-md sm:w-56">
            <Cover article={article} size="thumb" className="aspect-video w-full" />
            <TypeBadge article={article} />
          </ArticleAnchor>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-ink sm:text-lg">
              <ArticleAnchor article={article} locale={locale} className="hover:text-brand">
                {article.title}
              </ArticleAnchor>
            </h3>
            <CardMeta article={article} locale={locale} className="mt-1" />
            {article.sapo && <p className="mt-1 line-clamp-2 hidden text-sm text-ink-soft sm:block">{article.sapo}</p>}
          </div>
        </article>
      );
    case "thumb":
      return (
        <article className={`flex gap-3 ${className}`}>
          <ArticleAnchor article={article} locale={locale} className="block w-24 shrink-0 overflow-hidden rounded-md">
            <Cover article={article} size="thumb" className="aspect-[4/3] w-full" />
          </ArticleAnchor>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-ink">
              <ArticleAnchor article={article} locale={locale} className="hover:text-brand">
                {article.title}
              </ArticleAnchor>
            </h3>
            <CardMeta article={article} locale={locale} className="mt-1" />
          </div>
        </article>
      );
    case "ticker":
      return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          <ArticleAnchor article={article} locale={locale} className="font-semibold hover:text-brand">
            {article.title}
          </ArticleAnchor>
          {article.publishedAt && <span className="text-xs text-ink-muted">({formatRelative(article.publishedAt, new Date(), locale)})</span>}
        </span>
      );
    default:
      return (
        <article className={className}>
          <h3 className="text-[15px] font-semibold leading-snug text-ink">
            <ArticleAnchor article={article} locale={locale} className="hover:text-brand">
              {article.title}
            </ArticleAnchor>
          </h3>
          <CardMeta article={article} locale={locale} className="mt-1" />
        </article>
      );
  }
}
