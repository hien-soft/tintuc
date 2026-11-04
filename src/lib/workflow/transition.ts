import type { Article, ArticleStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { createRevision } from "@/lib/revisions";
import { emailUsers, notifyUsers, type NotificationInput } from "@/lib/notify";
import type { CmsUser } from "@/lib/auth/session";
import { checkTransition, STATUS_LABELS, type WorkflowAction } from "./machine";
import { checkBeforePublish, checkBeforeSubmit } from "./checks";
import { releaseLock } from "./lock";

type Tx = Prisma.TransactionClient;

export interface TransitionArgs {
  articleId: number;
  action: WorkflowAction;
  /** null = hệ thống (job hẹn giờ). */
  actor: CmsUser | null;
  reason?: string;
  scheduledAt?: Date;
  expectedVersion: number;
  meta?: { ip?: string; userAgent?: string };
}

interface PendingEffects {
  notifications: { userIds: string[]; input: NotificationInput }[];
  revalidatePublic: boolean;
  releaseLockOf?: number;
  /** Khóa của chính người thao tác: nhả ở server, không trông vào client (có thể đã đăng xuất/đóng tab). */
  releaseActorLock?: { articleId: number; userId: string };
}

const COMMENT_KIND: Partial<Record<WorkflowAction, string>> = {
  RETURN_L1: "RETURN_REASON",
  RETURN_L2: "RETURN_REASON",
  SEND_BACK_L1: "RETURN_REASON",
  REJECT_L1: "REJECT_REASON",
  REJECT_L2: "REJECT_REASON",
  UNPUBLISH: "UNPUBLISH_REASON",
  CORRECT: "CORRECTION",
};

async function loadForChecks(tx: Tx, article: Article) {
  const [cover, photos] = await Promise.all([
    article.coverMediaId ? tx.media.findUnique({ where: { id: article.coverMediaId }, select: { caption: true } }) : null,
    tx.articlePhoto.findMany({ where: { articleId: article.id }, select: { caption: true } }),
  ]);
  return {
    ...article,
    cover,
    photoCount: photos.length,
    photosMissingCaption: photos.filter((p) => !p.caption.trim()).length,
  };
}

async function l1ReviewersFor(tx: Tx, categoryId: number): Promise<string[]> {
  const users = await tx.user.findMany({
    where: { isActive: true, roles: { has: "EDITOR_L1" }, categoryScopes: { some: { categoryId } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function l2Reviewers(tx: Tx): Promise<string[]> {
  const users = await tx.user.findMany({ where: { isActive: true, roles: { has: "EDITOR_L2" } }, select: { id: true } });
  return users.map((u) => u.id);
}

/** Cột cần cập nhật theo hành động. */
function fieldUpdates(args: TransitionArgs, article: Article, now: Date): Prisma.ArticleUncheckedUpdateInput {
  const actorId = args.actor?.id ?? null;
  switch (args.action) {
    case "SUBMIT":
    case "RESUBMIT":
      return { submittedAt: now, holderId: null, l1ReviewerId: null, l1ApprovedAt: null, l2ReviewerId: null, l2ApprovedAt: null };
    case "WITHDRAW":
      return { submittedAt: null };
    case "CLAIM_L1":
    case "CLAIM_L2":
      return { holderId: actorId };
    case "RELEASE_L1":
    case "RELEASE_L2":
    case "RETURN_L1":
    case "REJECT_L1":
    case "RETURN_L2":
    case "REJECT_L2":
      return { holderId: null };
    case "APPROVE_L1":
      return { holderId: null, l1ReviewerId: actorId, l1ApprovedAt: now };
    case "SEND_BACK_L1":
      return { holderId: null, submittedAt: now, l1ReviewerId: null, l1ApprovedAt: null };
    case "PUBLISH":
      return { holderId: null, l2ReviewerId: actorId, l2ApprovedAt: now, publishedAt: now, scheduledAt: null, unpublishedAt: null };
    case "SCHEDULE":
      return { holderId: null, l2ReviewerId: actorId, l2ApprovedAt: now, scheduledAt: args.scheduledAt };
    case "AUTO_PUBLISH":
      return { publishedAt: article.scheduledAt ?? now, unpublishedAt: null };
    case "CANCEL_SCHEDULE":
      return { scheduledAt: null, l2ReviewerId: null, l2ApprovedAt: null, l1ApprovedAt: now };
    case "UNPUBLISH":
      return { unpublishedAt: now, isPinned: false };
    case "CORRECT":
      return { correctionNote: args.reason?.trim(), correctedAt: now };
    case "REQUEUE":
      return { l2ReviewerId: null, l2ApprovedAt: null, l1ApprovedAt: now };
    case "ARCHIVE":
      return {};
  }
}

function notificationsFor(args: TransitionArgs, article: Article, toStatus: ArticleStatus, l1Ids: string[], l2Ids: string[]): PendingEffects["notifications"] {
  const link = `/Admin/articles/${article.id}`;
  const urgent = article.isUrgent ? "[KHẨN] " : "";
  const t = `${urgent}"${article.title}"`;
  const reason = args.reason ? ` Lý do: ${args.reason.trim()}` : "";
  const reviewerL1 = article.l1ReviewerId ? [article.l1ReviewerId] : [];
  switch (args.action) {
    case "SUBMIT":
    case "RESUBMIT":
    case "SEND_BACK_L1":
      return [{ userIds: l1Ids, input: { type: "REVIEW_L1_REQUEST", title: `${t} chờ duyệt cấp 1`, link } }];
    case "APPROVE_L1":
      return [
        { userIds: [article.authorId], input: { type: "APPROVED_L1", title: `${t} đã được duyệt cấp 1`, link } },
        { userIds: l2Ids, input: { type: "REVIEW_L2_REQUEST", title: `${t} chờ duyệt cấp 2`, link } },
      ];
    case "RETURN_L1":
    case "RETURN_L2":
      return [{ userIds: [article.authorId], input: { type: "RETURNED", title: `${t} bị trả lại.${reason}`, link } }];
    case "REJECT_L1":
    case "REJECT_L2":
      return [{ userIds: [article.authorId], input: { type: "REJECTED", title: `${t} bị từ chối.${reason}`, link } }];
    case "PUBLISH":
    case "AUTO_PUBLISH":
    case "SCHEDULE": {
      const what = toStatus === "SCHEDULED" ? "đã được hẹn giờ đăng" : "đã xuất bản";
      return [{ userIds: [article.authorId, ...reviewerL1], input: { type: toStatus, title: `${t} ${what}`, link } }];
    }
    case "UNPUBLISH":
      return [{ userIds: [article.authorId, ...reviewerL1], input: { type: "UNPUBLISHED", title: `${t} đã bị gỡ.${reason}`, link } }];
    case "CORRECT":
      return [{ userIds: [article.authorId, ...reviewerL1], input: { type: "CORRECTED", title: `${t} đã được đính chính.`, link } }];
    default:
      return [];
  }
}

/**
 * Thực hiện chuyển trạng thái bên trong transaction có sẵn.
 * Đây là nơi DUY NHẤT được phép cập nhật cột `status` của bài viết.
 */
export async function applyTransition(tx: Tx, args: TransitionArgs): Promise<{ article: Article; effects: PendingEffects }> {
  const article = await tx.article.findUnique({ where: { id: args.articleId } });
  if (!article) throw new AppError("NOT_FOUND");
  if (article.version !== args.expectedVersion) throw new AppError("CONFLICT");

  const check = checkTransition({
    article,
    action: args.action,
    actor: args.actor,
    reason: args.reason,
    scheduledAt: args.scheduledAt,
  });
  if (!check.ok) throw new AppError(check.code, check.message);
  const { transition } = check;

  if (["SUBMIT", "RESUBMIT"].includes(args.action)) {
    const errors = checkBeforeSubmit(await loadForChecks(tx, article));
    if (errors.length) throw new AppError("VALIDATION_ERROR", "Bài chưa đủ điều kiện gửi duyệt.", errors);
  }
  if (["PUBLISH", "SCHEDULE", "AUTO_PUBLISH"].includes(args.action)) {
    const errors = checkBeforePublish(await loadForChecks(tx, article));
    const dup = await tx.article.findFirst({ where: { slug: article.slug, locale: article.locale, id: { not: article.id } }, select: { id: true } });
    if (dup) errors.push("Slug đã được dùng cho bài khác.");
    if (errors.length) throw new AppError("VALIDATION_ERROR", "Bài chưa đủ điều kiện xuất bản.", errors);
  }

  const now = new Date();
  // Cập nhật có điều kiện theo version để chống ghi đè đồng thời.
  const res = await tx.article.updateMany({
    where: { id: article.id, version: article.version },
    data: { ...(fieldUpdates(args, article, now) as Prisma.ArticleUncheckedUpdateManyInput), status: transition.to, version: { increment: 1 } },
  });
  if (res.count !== 1) throw new AppError("CONFLICT");
  const updated = await tx.article.findUniqueOrThrow({ where: { id: article.id } });

  const actorId = args.actor?.id ?? null;
  const systemActorId = actorId ?? updated.l2ReviewerId ?? updated.authorId;

  await tx.articleStatusLog.create({
    data: {
      articleId: article.id,
      fromStatus: article.status,
      toStatus: transition.to,
      action: args.action,
      actorId: systemActorId,
      reason: args.reason?.trim() || null,
      version: updated.version,
    },
  });
  await createRevision(tx, { article: updated, editorId: systemActorId, statusAtSave: transition.to, note: `${transition.label}${args.reason ? `: ${args.reason.trim()}` : ""}` });

  const kind = COMMENT_KIND[args.action];
  if (kind && args.reason && actorId) {
    await tx.articleComment.create({ data: { articleId: article.id, authorId: actorId, body: args.reason.trim(), kind } });
  }

  await writeAudit(
    {
      actorId,
      action: `ARTICLE_${args.action}`,
      entityType: "Article",
      entityId: article.id,
      metadata: { from: article.status, to: transition.to, reason: args.reason ?? null, scheduledAt: args.scheduledAt?.toISOString() ?? null },
      ip: args.meta?.ip,
      userAgent: args.meta?.userAgent,
    },
    tx,
  );

  const needL1 = ["SUBMIT", "RESUBMIT", "SEND_BACK_L1"].includes(args.action);
  const l1Ids = needL1 ? await l1ReviewersFor(tx, article.primaryCatId) : [];
  const l2Ids = args.action === "APPROVE_L1" ? await l2Reviewers(tx) : [];
  const notifications = notificationsFor(args, updated, transition.to, l1Ids, l2Ids).map((n) => ({
    ...n,
    userIds: n.userIds.filter((id) => id !== actorId),
  }));
  for (const n of notifications) await notifyUsers(tx, n.userIds, n.input);

  const touchesPublic = article.status === "PUBLISHED" || transition.to === "PUBLISHED";
  const leavesReview = article.status.startsWith("IN_REVIEW") && !transition.to.startsWith("IN_REVIEW");
  return {
    article: updated,
    effects: {
      notifications,
      revalidatePublic: touchesPublic,
      releaseLockOf: leavesReview ? article.id : undefined,
      releaseActorLock: actorId ? { articleId: article.id, userId: actorId } : undefined,
    },
  };
}

/** Hiệu ứng sau commit: revalidate cache public, gửi email, nhả khóa biên tập. */
export async function runEffects(effects: PendingEffects): Promise<void> {
  if (effects.revalidatePublic) {
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/", "layout");
    } catch {
      // chạy ngoài Next.js (script) — bỏ qua
    }
  }
  if (effects.releaseLockOf) await releaseLock(effects.releaseLockOf);
  else if (effects.releaseActorLock) await releaseLock(effects.releaseActorLock.articleId, effects.releaseActorLock.userId);
  await Promise.all(effects.notifications.map((n) => emailUsers(n.userIds, n.input)));
}

export async function transitionArticle(args: TransitionArgs): Promise<Article> {
  const { article, effects } = await db.$transaction((tx) => applyTransition(tx, args));
  await runEffects(effects);
  return article;
}

/** Job hẹn giờ: chuyển SCHEDULED → PUBLISHED khi đến giờ. Idempotent — chạy lặp lại không gây hại. */
export async function publishScheduled(now = new Date()): Promise<number> {
  const due = await db.article.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, select: { id: true, version: true } });
  let count = 0;
  for (const a of due) {
    try {
      await transitionArticle({ articleId: a.id, action: "AUTO_PUBLISH", actor: null, expectedVersion: a.version });
      count++;
    } catch (e) {
      // bài đã được chuyển bởi tiến trình khác hoặc không còn hợp lệ
      if (!(e instanceof AppError)) throw e;
      console.warn(`[publish-scheduled] Bỏ qua bài ${a.id}: ${e.message}`);
    }
  }
  return count;
}

export { STATUS_LABELS };
