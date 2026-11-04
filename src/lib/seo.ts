/** Tiện ích SEO cho trang công khai: title, canonical, hreflang, Open Graph, JSON-LD (mục 3.6). */
import type { Metadata } from "next";
import { SITE_NAME, SITE_SHORT, SITE_URL } from "@/lib/config";
import { swapLocale } from "@/lib/i18n";
import type { ArticleDetail } from "@/lib/repo/public";
import { mediaUrl } from "@/lib/storage";
import { toIsoVN } from "@/lib/time";
import type { PublicLocale } from "@/lib/urls";

export const SITE_TITLE = `${SITE_NAME} (${SITE_SHORT})`;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** `{Tiêu đề} - {Danh mục} - Tin Tức Việt Nam (TTVN)`; bỏ qua phần rỗng. */
export function pageTitle(...parts: (string | null | undefined)[]): string {
  return [...parts.filter((p): p is string => !!p), SITE_TITLE].join(" - ");
}

export interface PageMetaInput {
  /** Các phần tiêu đề trước tên site, VD [tiêu đề bài, tên danh mục]. */
  title: (string | null | undefined)[];
  description?: string | null;
  /** Đường dẫn canonical (có tiền tố locale), không kèm domain. */
  path: string;
  locale: PublicLocale;
  image?: string | null;
  type?: "website" | "article";
  publishedAt?: Date | null;
  modifiedAt?: Date | null;
  section?: string;
  tags?: string[];
  noindex?: boolean;
}

export function buildMetadata(input: PageMetaInput): Metadata {
  const title = pageTitle(...input.title);
  const url = absoluteUrl(input.path);
  const description = input.description ?? undefined;
  const images = input.image ? [{ url: absoluteUrl(input.image) }] : undefined;
  const hasLocale = /^\/(vi|en)(\/|$)/.test(input.path);
  const openGraph: Metadata["openGraph"] =
    input.type === "article"
      ? {
          type: "article",
          title,
          description,
          url,
          siteName: SITE_TITLE,
          locale: input.locale === "en" ? "en_US" : "vi_VN",
          images,
          publishedTime: input.publishedAt ? toIsoVN(input.publishedAt) : undefined,
          modifiedTime: input.modifiedAt ? toIsoVN(input.modifiedAt) : undefined,
          section: input.section,
          tags: input.tags,
        }
      : { type: "website", title, description, url, siteName: SITE_TITLE, locale: input.locale === "en" ? "en_US" : "vi_VN", images };
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: hasLocale
        ? { vi: absoluteUrl(swapLocale(input.path, "vi")), en: absoluteUrl(swapLocale(input.path, "en")), "x-default": absoluteUrl(swapLocale(input.path, "vi")) }
        : undefined,
      types: { "application/rss+xml": [{ url: "/rss/tin-moi-nhat", title: SITE_TITLE }] },
    },
    openGraph,
    twitter: { card: images ? "summary_large_image" : "summary", title, description },
    robots: input.noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

const publisher = {
  "@type": "NewsMediaOrganization",
  name: SITE_NAME,
  alternateName: SITE_SHORT,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") },
};

/** JSON-LD NewsArticle cho bài viết. */
export function newsArticleJsonLd(article: ArticleDetail, path: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
    headline: article.title,
    description: article.sapo ?? undefined,
    image: article.cover ? [absoluteUrl(mediaUrl(article.cover.key, "large"))] : undefined,
    datePublished: article.publishedAt ? toIsoVN(article.publishedAt) : undefined,
    dateModified: toIsoVN(article.correctedAt ?? article.updatedAt),
    articleSection: article.primaryCat.name,
    keywords: article.tags.map((t) => t.tag.name).join(", ") || undefined,
    author: article.authorName ? [{ "@type": "Person", name: article.authorName }] : [{ "@type": "Organization", name: SITE_NAME }],
    publisher,
  };
}

/** JSON-LD ImageGallery cho bộ ảnh. */
export function imageGalleryJsonLd(article: ArticleDetail, path: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: article.title,
    description: article.sapo ?? undefined,
    url: absoluteUrl(path),
    datePublished: article.publishedAt ? toIsoVN(article.publishedAt) : undefined,
    author: article.authorName ? { "@type": "Person", name: article.authorName } : undefined,
    publisher,
    image: article.photos.map((p) => ({
      "@type": "ImageObject",
      contentUrl: absoluteUrl(mediaUrl(p.media.key, "large")),
      caption: p.caption,
      dateCreated: p.takenAt ? toIsoVN(p.takenAt) : undefined,
      width: p.media.width || undefined,
      height: p.media.height || undefined,
    })),
  };
}

/** Chuỗi JSON an toàn để nhúng vào thẻ <script type="application/ld+json">. */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
