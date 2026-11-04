"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ArticleType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { requireActionUser, type CmsUser } from "@/lib/auth/session";
import { requestMeta } from "@/lib/auth/misc";
import { can } from "@/lib/rbac/permissions";
import { writeAudit } from "@/lib/audit";
import { createRevision, type ArticleSnapshot } from "@/lib/revisions";
import { sanitizeContent } from "@/lib/content/sanitize";
import { slugify } from "@/lib/slug";
import { canViewArticle, editMode } from "@/lib/cms/queries";
import { applyTransition, runEffects, transitionArticle } from "@/lib/workflow/transition";
import { MIN_REASON_LENGTH, type WorkflowAction } from "@/lib/workflow/machine";
import { acquireLock, getLock, heartbeatLock, releaseLock, type EditLock } from "@/lib/workflow/lock";
import { notifyUsers } from "@/lib/notify";

const ARTICLE_TYPES = ["NEWS", "PHOTO_STORY", "GRAPHIC", "MEGASTORY", "EXTERNAL"] as const;

const saveSchema = z.object({
  type: z.enum(ARTICLE_TYPES),
  title: z.string().trim().max(150, "Tiêu đề không quá 150 ký tự."),
  sapo: z.string().trim().max(300, "Sapo không quá 300 ký tự.").default(""),
  contentHtml: z.string().max(2_000_000).default(""),
  contentJson: z.string().max(4_000_000).optional(),
  primaryCatId: z.number().int().positive(),
  categoryIds: z.array(z.number().int().positive()).max(20).default([]),
  sourceId: z.number().int().positive(),
  authorName: z.string().trim().max(120).default(""),
  coverMediaId: z.string().max(40).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  topicIds: z.array(z.number().int()).max(10).default([]),
  slug: z.string().trim().max(160).default(""),
  seoTitle: z.string().trim().max(200).default(""),
  seoDescription: z.string().trim().max(300).default(""),
  isUrgent: z.boolean().default(false),
  externalUrl: z.string().trim().max(1000).default(""),
  photos: z.array(z.object({ mediaId: z.string().max(40), caption: z.string().trim().max(500), takenAt: z.string().nullable().optional() })).max(200).default([]),
  correctionNote: z.string().trim().max(1000).optional(),
});

export type SaveArticleInput = z.input<typeof saveSchema>;

function lockOwner(user: CmsUser): EditLock {
  return { userId: user.id, name: user.fullName };
}

async function loadArticleFor(user: CmsUser, id: number) {
  const article = await db.article.findUnique({ where: { id } });
  if (!article || !canViewArticle(user, article)) throw new AppError("NOT_FOUND");
  return article;
}

async function assertNotLockedByOther(user: CmsUser, id: number) {
  const lock = await getLock(id);
  if (lock && lock.userId !== user.id) throw new AppError("LOCKED", `Bài đang được ${lock.name} chỉnh sửa.`);
}

/** externalUrl phải là https và thuộc domain của một Nguồn (chống open redirect). */
async function validateExternalUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Đường dẫn nguồn ngoài không hợp lệ.");
  }
  if (parsed.protocol !== "https:") throw new AppError("VALIDATION_ERROR", "Đường dẫn nguồn ngoài phải bắt đầu bằng https://");
  const sources = await db.source.findMany({ where: { homepage: { not: null } }, select: { homepage: true } });
  const hosts = sources.map((s) => new URL(s.homepage as string).hostname.replace(/^www\./, ""));
  const host = parsed.hostname.replace(/^www\./, "");
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new AppError("VALIDATION_ERROR", "Domain của đường dẫn không nằm trong danh sách Nguồn.");
  }
}

function parseVnDateTime(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  return new Date(`${value}:00+07:00`);
}

export async function createArticleAction(formData: FormData): Promise<void> {
  const user = await requireActionUser();
  if (!can(user, "article.create")) throw new AppError("FORBIDDEN");
  const type = (ARTICLE_TYPES as readonly string[]).includes(String(formData.get("type"))) ? (String(formData.get("type")) as ArticleType) : "NEWS";
  const meta = await requestMeta();

  const preferred = user.categoryScopes[0];
  const category = type === "PHOTO_STORY"
    ? await db.category.findFirst({ where: { type: "PHOTO", isActive: true }, orderBy: { order: "asc" } })
    : await db.category.findFirst({ where: { type: "NEWS", isActive: true, ...(preferred ? { id: preferred } : {}) }, orderBy: { order: "asc" } });
  const source = await db.source.findFirst({ orderBy: { id: "asc" } });
  if (!category || !source) throw new AppError("VALIDATION_ERROR", "Chưa có danh mục hoặc nguồn.");

  const article = await db.$transaction(async (tx) => {
    const a = await tx.article.create({
      data: {
        type,
        title: "",
        slug: `nhap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        primaryCatId: category.id,
        sourceId: source.id,
        authorId: user.id,
        authorName: user.fullName,
      },
    });
    await createRevision(tx, { article: a, editorId: user.id, statusAtSave: "DRAFT", note: "Tạo bài" });
    await writeAudit({ actorId: user.id, action: "ARTICLE_CREATE", entityType: "Article", entityId: a.id, metadata: { type }, ...meta }, tx);
    return a;
  });
  redirect(`/Admin/articles/${article.id}`);
}

export async function saveArticleAction(id: number, input: SaveArticleInput, expectedVersion: number): Promise<ActionResult<{ version: number; slug: string }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const meta = await requestMeta();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0].message);
    const data = parsed.data;

    const article = await loadArticleFor(user, id);
    const mode = editMode(user, article);
    if (mode === "readonly") throw new AppError("FORBIDDEN", "Bạn không được sửa bài ở trạng thái hiện tại.");
    if (mode === "correct" && (data.correctionNote ?? "").length < MIN_REASON_LENGTH) {
      throw new AppError("VALIDATION_ERROR", `Vui lòng nhập ghi chú đính chính (tối thiểu ${MIN_REASON_LENGTH} ký tự).`);
    }
    await assertNotLockedByOther(user, id);
    if (article.version !== expectedVersion) throw new AppError("CONFLICT");
    if (data.type === "EXTERNAL" && data.externalUrl) await validateExternalUrl(data.externalUrl);
    // Giữ nguyên loại bài sau khi tạo để tránh lệch dữ liệu bộ ảnh.
    data.type = article.type;

    const category = await db.category.findUnique({ where: { id: data.primaryCatId } });
    if (!category) throw new AppError("VALIDATION_ERROR", "Danh mục không tồn tại.");

    let slug = slugify(data.slug || data.title || `bai-viet-${id}`) || `bai-viet-${id}`;
    const dup = await db.article.findFirst({ where: { slug, locale: article.locale, id: { not: id } }, select: { id: true } });
    if (dup) slug = `${slug}-${id}`;

    const contentHtml = data.contentHtml ? sanitizeContent(data.contentHtml) : null;
    const tagRows = await Promise.all(
      [...new Set(data.tags)].map((name) => db.tag.upsert({ where: { name }, create: { name, slug: slugify(name) || `tag-${Date.now()}` }, update: {} })),
    );

    const result = await db.$transaction(async (tx) => {
      const res = await tx.article.updateMany({
        where: { id, version: expectedVersion },
        data: {
          title: data.title,
          sapo: data.sapo || null,
          contentHtml,
          contentJson: data.contentJson ? (JSON.parse(data.contentJson) as Prisma.InputJsonValue) : undefined,
          primaryCatId: data.primaryCatId,
          sourceId: data.sourceId,
          authorName: data.authorName || null,
          coverMediaId: data.coverMediaId,
          slug,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          isUrgent: data.isUrgent,
          externalUrl: data.externalUrl || null,
          version: { increment: 1 },
        },
      });
      if (res.count !== 1) throw new AppError("CONFLICT");

      await tx.articleCategory.deleteMany({ where: { articleId: id } });
      const extraCats = [...new Set(data.categoryIds)].filter((c) => c !== data.primaryCatId);
      if (extraCats.length) await tx.articleCategory.createMany({ data: extraCats.map((categoryId) => ({ articleId: id, categoryId })) });
      await tx.articleTag.deleteMany({ where: { articleId: id } });
      if (tagRows.length) await tx.articleTag.createMany({ data: tagRows.map((t) => ({ articleId: id, tagId: t.id })) });
      await tx.articleTopic.deleteMany({ where: { articleId: id } });
      if (data.topicIds.length) await tx.articleTopic.createMany({ data: [...new Set(data.topicIds)].map((topicId) => ({ articleId: id, topicId })) });
      if (article.type === "PHOTO_STORY") {
        await tx.articlePhoto.deleteMany({ where: { articleId: id } });
        if (data.photos.length) {
          await tx.articlePhoto.createMany({
            data: data.photos.map((p, i) => ({ articleId: id, mediaId: p.mediaId, caption: p.caption, order: i, takenAt: p.takenAt ? new Date(p.takenAt) : null })),
          });
        }
      }

      const updated = await tx.article.findUniqueOrThrow({ where: { id } });
      await createRevision(tx, {
        article: updated,
        editorId: user.id,
        statusAtSave: updated.status,
        note: mode === "correct" ? "Sửa nội dung để đính chính" : "Lưu nội dung",
        extra: { categoryIds: extraCats, tagNames: tagRows.map((t) => t.name), topicIds: data.topicIds, photos: data.photos.map((p, i) => ({ mediaId: p.mediaId, caption: p.caption, order: i })) },
      });
      await writeAudit({ actorId: user.id, action: "ARTICLE_UPDATE", entityType: "Article", entityId: id, metadata: { version: updated.version, status: updated.status }, ...meta }, tx);

      if (mode === "correct") {
        return applyTransition(tx, { articleId: id, action: "CORRECT", actor: user, reason: data.correctionNote, expectedVersion: updated.version, meta });
      }
      return { article: updated, effects: null };
    });
    if (result.effects) await runEffects(result.effects);
    return { version: result.article.version, slug: result.article.slug };
  });
}

export async function transitionAction(input: { id: number; action: WorkflowAction; expectedVersion: number; reason?: string; scheduledAt?: string }): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const meta = await requestMeta();
    await loadArticleFor(user, input.id);
    const scheduledAt = input.scheduledAt ? parseVnDateTime(input.scheduledAt) : undefined;
    if (input.action === "SCHEDULE" && !scheduledAt) throw new AppError("VALIDATION_ERROR", "Vui lòng chọn giờ hẹn đăng.");
    if (input.action.startsWith("CLAIM")) await assertNotLockedByOther(user, input.id);
    const article = await transitionArticle({
      articleId: input.id,
      action: input.action,
      actor: user,
      reason: input.reason,
      scheduledAt,
      expectedVersion: input.expectedVersion,
      meta,
    });
    revalidatePath(`/Admin/articles/${input.id}`);
    return { version: article.version };
  });
}

/** Chuyển trạng thái từ form (hàng đợi duyệt: nút "Nhận duyệt"). */
export async function claimFromQueueAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  const res = await transitionAction({ id, action: String(formData.get("action")) as WorkflowAction, expectedVersion: Number(formData.get("version")) });
  if (!res.ok) redirect(`${String(formData.get("back") ?? "/Admin")}?error=${encodeURIComponent(res.message)}`);
  redirect(`/Admin/articles/${id}`);
}

/** Chiếm khóa nếu được sửa; trả về tên người khác đang giữ khóa (nếu có). */
export async function acquireLockAction(id: number): Promise<ActionResult<{ heldByOther: string | null }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const article = await loadArticleFor(user, id);
    const lock = editMode(user, article) === "readonly" ? await getLock(id) : await acquireLock(id, lockOwner(user));
    return { heldByOther: lock && lock.userId !== user.id ? lock.name : null };
  });
}

export async function heartbeatLockAction(id: number): Promise<ActionResult<boolean>> {
  return runAction(async () => {
    const user = await requireActionUser();
    return heartbeatLock(id, lockOwner(user));
  });
}

export async function releaseLockAction(id: number): Promise<void> {
  const user = await requireActionUser();
  await releaseLock(id, user.id);
}

export async function addCommentAction(id: number, body: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const article = await loadArticleFor(user, id);
    const text = body.trim();
    if (text.length < 1 || text.length > 2000) throw new AppError("VALIDATION_ERROR", "Bình luận từ 1 đến 2000 ký tự.");
    await db.$transaction(async (tx) => {
      await tx.articleComment.create({ data: { articleId: id, authorId: user.id, body: text } });
      const participants = await tx.articleComment.findMany({ where: { articleId: id }, select: { authorId: true }, distinct: ["authorId"] });
      const ids = [article.authorId, article.l1ReviewerId, article.l2ReviewerId, article.holderId, ...participants.map((p) => p.authorId)].filter(
        (x): x is string => !!x && x !== user.id,
      );
      await notifyUsers(tx, ids, { type: "COMMENT", title: `${user.fullName} bình luận trong bài "${article.title || "(chưa có tiêu đề)"}"`, link: `/Admin/articles/${id}` });
    });
    revalidatePath(`/Admin/articles/${id}`);
    return null;
  });
}

export async function restoreRevisionAction(id: number, version: number): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const meta = await requestMeta();
    const article = await loadArticleFor(user, id);
    if (editMode(user, article) !== "edit") throw new AppError("FORBIDDEN", "Chỉ khôi phục được khi bài ở trạng thái cho phép sửa.");
    await assertNotLockedByOther(user, id);
    const rev = await db.articleRevision.findUnique({ where: { articleId_version: { articleId: id, version } } });
    if (!rev) throw new AppError("NOT_FOUND");
    const s = rev.snapshot as unknown as Partial<ArticleSnapshot>;
    const updated = await db.$transaction(async (tx) => {
      const res = await tx.article.updateMany({
        where: { id, version: article.version },
        data: {
          title: s.title ?? article.title,
          sapo: s.sapo ?? null,
          contentHtml: s.contentHtml ?? null,
          ...(s.coverMediaId !== undefined ? { coverMediaId: s.coverMediaId } : {}),
          ...(s.primaryCatId ? { primaryCatId: s.primaryCatId } : {}),
          ...(s.authorName !== undefined ? { authorName: s.authorName } : {}),
          version: { increment: 1 },
        },
      });
      if (res.count !== 1) throw new AppError("CONFLICT");
      const a = await tx.article.findUniqueOrThrow({ where: { id } });
      await createRevision(tx, { article: a, editorId: user.id, statusAtSave: a.status, note: `Khôi phục từ phiên bản ${version}` });
      await writeAudit({ actorId: user.id, action: "ARTICLE_RESTORE_REVISION", entityType: "Article", entityId: id, metadata: { fromVersion: version }, ...meta }, tx);
      return a;
    });
    revalidatePath(`/Admin/articles/${id}`);
    return { version: updated.version };
  });
}

export async function togglePinAction(formData: FormData): Promise<void> {
  const user = await requireActionUser();
  if (!can(user, "article.pin")) throw new AppError("FORBIDDEN");
  const id = Number(formData.get("id"));
  const meta = await requestMeta();
  const a = await db.article.findUniqueOrThrow({ where: { id } });
  await db.article.update({ where: { id }, data: { isPinned: !a.isPinned } });
  await writeAudit({ actorId: user.id, action: a.isPinned ? "ARTICLE_UNPIN" : "ARTICLE_PIN", entityType: "Article", entityId: id, ...meta });
  revalidatePath("/", "layout");
}
