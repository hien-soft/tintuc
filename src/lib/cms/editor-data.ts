import type { Media } from "@prisma/client";
import { db } from "@/lib/db";
import type { MediaDto } from "@/app/Admin/_actions/media";
import type { EditorArticle, Option } from "@/components/cms/editor/types";

const GROUP_LABELS = { NEWS: "Chủ đề", PHOTO: "Ảnh", FEED: "Tin thời sự" } as const;

export function toMediaDto(m: Media): MediaDto {
  return { id: m.id, key: m.key, caption: m.caption, alt: m.alt, photographer: m.photographer, width: m.width, height: m.height };
}

export async function loadEditorArticle(id: number) {
  return db.article.findUnique({
    where: { id },
    include: {
      cover: true,
      categories: true,
      tags: { include: { tag: true } },
      topics: true,
      photos: { include: { media: true }, orderBy: { order: "asc" } },
      author: { select: { fullName: true } },
      primaryCat: true,
      comments: { include: { author: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
      statusLogs: { include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export type LoadedArticle = NonNullable<Awaited<ReturnType<typeof loadEditorArticle>>>;

export function toEditorArticle(a: LoadedArticle): EditorArticle {
  return {
    id: a.id,
    type: a.type,
    status: a.status,
    version: a.version,
    title: a.title,
    sapo: a.sapo ?? "",
    contentHtml: a.contentHtml ?? "",
    primaryCatId: a.primaryCatId,
    categoryIds: a.categories.map((c) => c.categoryId),
    sourceId: a.sourceId,
    authorName: a.authorName ?? "",
    cover: a.cover ? toMediaDto(a.cover) : null,
    tags: a.tags.map((t) => t.tag.name),
    topicIds: a.topics.map((t) => t.topicId),
    slug: a.slug.startsWith("nhap-") ? "" : a.slug,
    seoTitle: a.seoTitle ?? "",
    seoDescription: a.seoDescription ?? "",
    isUrgent: a.isUrgent,
    externalUrl: a.externalUrl ?? "",
    photos: a.photos.map((p) => ({ media: toMediaDto(p.media), caption: p.caption, takenAt: p.takenAt?.toISOString() ?? null })),
    isPinned: a.isPinned,
    scheduledAt: a.scheduledAt?.toISOString() ?? null,
    correctionNote: a.correctionNote,
  };
}

export async function loadEditorOptions(): Promise<{ categories: Option[]; sources: Option[]; topics: Option[] }> {
  const [cats, sources, topics] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: [{ type: "asc" }, { order: "asc" }] }),
    db.source.findMany({ orderBy: { id: "asc" } }),
    db.topic.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
  ]);
  return {
    categories: cats.map((c) => ({ id: c.id, name: c.name, group: GROUP_LABELS[c.type] })),
    sources: sources.map((s) => ({ id: s.id, name: s.name })),
    topics: topics.map((t) => ({ id: t.id, name: t.name })),
  };
}
