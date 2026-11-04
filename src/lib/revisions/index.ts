import type { Article, ArticleStatus, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Các trường nội dung lưu trong snapshot của revision. */
export interface ArticleSnapshot {
  title: string;
  sapo: string | null;
  contentHtml: string | null;
  contentJson: Prisma.JsonValue | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  primaryCatId: number;
  sourceId: number;
  authorName: string | null;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  isUrgent: boolean;
  correctionNote: string | null;
  type: Article["type"];
  categoryIds?: number[];
  tagNames?: string[];
  topicIds?: number[];
  photos?: { mediaId: string; caption: string; order: number }[];
}

export function snapshotOf(a: Article, extra: Pick<ArticleSnapshot, "categoryIds" | "tagNames" | "topicIds" | "photos"> = {}): ArticleSnapshot {
  return {
    title: a.title,
    sapo: a.sapo,
    contentHtml: a.contentHtml,
    contentJson: a.contentJson,
    externalUrl: a.externalUrl,
    coverMediaId: a.coverMediaId,
    primaryCatId: a.primaryCatId,
    sourceId: a.sourceId,
    authorName: a.authorName,
    slug: a.slug,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    isUrgent: a.isUrgent,
    correctionNote: a.correctionNote,
    type: a.type,
    ...extra,
  };
}

export async function createRevision(
  tx: Tx,
  input: { article: Article; editorId: string; statusAtSave: ArticleStatus; note?: string; extra?: Parameters<typeof snapshotOf>[1] },
): Promise<void> {
  await tx.articleRevision.create({
    data: {
      articleId: input.article.id,
      version: input.article.version,
      snapshot: snapshotOf(input.article, input.extra) as unknown as Prisma.InputJsonValue,
      editorId: input.editorId,
      statusAtSave: input.statusAtSave,
      note: input.note,
    },
  });
}
