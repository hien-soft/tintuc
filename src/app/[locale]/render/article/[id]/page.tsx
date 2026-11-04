import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isInternalRequest } from "@/app/_public/internal-render";
import { ArticleView } from "@/components/public/article/ArticleView";
import { MostViewed } from "@/components/public/MostViewed";
import { PhotoStoryView } from "@/components/public/photo/PhotoStoryView";
import { JsonLd } from "@/components/public/ui";
import { ViewBeacon } from "@/components/public/ViewBeacon";
import { asLocale } from "@/lib/i18n";
import { getLatest, getPublicArticle, getRelated } from "@/lib/repo/public";
import { buildMetadata, imageGalleryJsonLd, newsArticleJsonLd } from "@/lib/seo";
import { mediaUrl } from "@/lib/storage";
import { articleUrl } from "@/lib/urls";

type Params = { params: Promise<{ locale: string; id: string }> };

const load = cache(async (id: string) => {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  const result = await getPublicArticle(n);
  return result && "article" in result ? result.article : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: l, id } = await params;
  if (!(await isInternalRequest())) return {};
  const article = await load(id);
  if (!article) return {};
  const locale = asLocale(l);
  return buildMetadata({
    title: [article.seoTitle ?? article.title, article.primaryCat.name],
    description: article.seoDescription ?? article.sapo,
    path: articleUrl(article, locale),
    locale,
    type: "article",
    image: article.cover ? mediaUrl(article.cover.key, "large") : article.photos[0] ? mediaUrl(article.photos[0].media.key, "large") : null,
    publishedAt: article.publishedAt,
    modifiedAt: article.correctedAt ?? article.updatedAt,
    section: article.primaryCat.name,
    tags: article.tags.map((t) => t.tag.name),
  });
}

export default async function InternalArticlePage({ params }: Params) {
  const { locale: l, id } = await params;
  const article = await load(id);
  if (!article) notFound();
  const locale = asLocale(l);
  const path = articleUrl(article, locale);

  if (article.type === "PHOTO_STORY") {
    const related = await getLatest(8, { type: "PHOTO_STORY", id: { not: article.id } });
    return (
      <>
        <JsonLd data={imageGalleryJsonLd(article, path)} />
        <ViewBeacon id={article.id} />
        <PhotoStoryView article={article} locale={locale} related={related} />
      </>
    );
  }

  const tagIds = article.tags.map((t) => t.tagId);
  const [byTag, sameCat] = await Promise.all([
    tagIds.length ? getLatest(5, { id: { not: article.id }, type: { not: "PHOTO_STORY" }, tags: { some: { tagId: { in: tagIds } } } }) : Promise.resolve([]),
    getRelated(article, 9),
  ]);
  const relatedIds = new Set(byTag.map((a) => a.id));
  const sameCategory = sameCat.filter((a) => !relatedIds.has(a.id)).slice(0, 8);

  return (
    <>
      <JsonLd data={newsArticleJsonLd(article, path)} />
      <ViewBeacon id={article.id} />
      <ArticleView article={article} locale={locale} related={byTag} sameCategory={sameCategory} sidebar={<MostViewed locale={locale} />} />
    </>
  );
}
