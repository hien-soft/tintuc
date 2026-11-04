import type { ArticleType, CategoryType } from "@prisma/client";

export type PublicLocale = "vi" | "en";

export interface CategoryLink {
  slug: string;
  publicId: number;
  type: CategoryType;
}

export function categoryUrl(c: CategoryLink, locale: PublicLocale = "vi"): string {
  const seg = `${c.slug}-${c.publicId}`;
  if (c.type === "FEED") return `/${locale}/tin/${seg}`;
  if (c.type === "PHOTO") return `/${locale}/anh/${seg}`;
  return `/${locale}/tin-tuc/${seg}`;
}

export interface ArticleLink {
  id: number;
  slug: string;
  type: ArticleType;
  primaryCat: CategoryLink;
}

export function articleUrl(a: ArticleLink, locale: PublicLocale = "vi"): string {
  const file = `${a.slug}-${a.id}.html`;
  const cat = `${a.primaryCat.slug}-${a.primaryCat.publicId}`;
  switch (a.type) {
    case "EXTERNAL":
      return `/r/${a.id}`;
    case "PHOTO_STORY":
      return `/${locale}/anh/${cat}/${file}`;
    case "MEGASTORY":
      return `/${locale}/megastory/${file}`;
    default:
      return `/${locale}/tin-tuc/${cat}/${file}`;
  }
}

export function sourceSearchUrl(sourceSlug: string, locale: PublicLocale = "vi"): string {
  return `/${locale}/search?source=${encodeURIComponent(sourceSlug)}`;
}

export function topicUrl(t: { slug: string; id: number }, locale: PublicLocale = "vi"): string {
  return `/${locale}/chuyen-de/${t.slug}-${t.id}`;
}
