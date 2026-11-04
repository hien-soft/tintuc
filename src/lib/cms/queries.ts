import type { Article, ArticleStatus, Prisma } from "@prisma/client";
import { can } from "@/lib/rbac/permissions";
import type { CmsUser } from "@/lib/auth/session";
import { AUTHOR_EDITABLE } from "@/lib/workflow/machine";
import { REVIEW_SLA_L1_MINUTES, REVIEW_SLA_L2_MINUTES } from "@/lib/config";

const hasRole = (u: CmsUser, r: CmsUser["roles"][number]) => u.roles.includes(r);

/** Hàng đợi duyệt cấp 1: BTV cấp 1 chỉ thấy bài trong phạm vi danh mục được phân công. */
export function l1QueueWhere(user: CmsUser): Prisma.ArticleWhereInput {
  const base: Prisma.ArticleWhereInput = { status: { in: ["PENDING_L1", "IN_REVIEW_L1"] } };
  if (hasRole(user, "EDITOR_L2")) return base;
  return { ...base, primaryCatId: { in: user.categoryScopes } };
}

export function l2QueueWhere(): Prisma.ArticleWhereInput {
  return { status: { in: ["PENDING_L2", "IN_REVIEW_L2"] } };
}

/** Phạm vi bài viết người dùng được xem trong CMS. */
export function visibleArticlesWhere(user: CmsUser): Prisma.ArticleWhereInput {
  if (hasRole(user, "EDITOR_L2") || hasRole(user, "ADMIN")) return {};
  const or: Prisma.ArticleWhereInput[] = [{ authorId: user.id }];
  if (hasRole(user, "EDITOR_L1")) {
    or.push({ primaryCatId: { in: user.categoryScopes }, status: { notIn: ["DRAFT"] } });
    or.push({ l1ReviewerId: user.id });
  }
  return { OR: or };
}

export function canViewArticle(user: CmsUser, a: Pick<Article, "authorId" | "primaryCatId" | "status" | "l1ReviewerId">): boolean {
  if (hasRole(user, "EDITOR_L2") || hasRole(user, "ADMIN")) return true;
  if (a.authorId === user.id) return true;
  if (hasRole(user, "EDITOR_L1") && (a.l1ReviewerId === user.id || (a.status !== "DRAFT" && user.categoryScopes.includes(a.primaryCatId)))) return true;
  return false;
}

/**
 * Ai được sửa nội dung bài ở trạng thái hiện tại (mục 6.3.5):
 * tác giả khi DRAFT/RETURNED; người đang nhận duyệt khi IN_REVIEW_*; cấp 2 khi đính chính bài đã đăng.
 */
export function editMode(user: CmsUser, a: Pick<Article, "authorId" | "primaryCatId" | "status" | "holderId">): "edit" | "correct" | "readonly" {
  if (a.authorId === user.id && AUTHOR_EDITABLE.includes(a.status) && can(user, "article.editOwnDraft", { ownerId: a.authorId })) return "edit";
  if (a.status === "IN_REVIEW_L1" && a.holderId === user.id && can(user, "review.l1.edit", { categoryId: a.primaryCatId })) return "edit";
  if (a.status === "IN_REVIEW_L2" && a.holderId === user.id && can(user, "review.l2.act")) return "edit";
  if (a.status === "PUBLISHED" && can(user, "article.correct")) return "correct";
  return "readonly";
}

/** Bài chờ duyệt quá hạn (mục 6.3.10). */
export function overdueInfo(a: { status: ArticleStatus; submittedAt: Date | null; l1ApprovedAt: Date | null }, now = new Date()): { waitingMin: number; overdue: boolean } {
  const since = a.status === "PENDING_L2" || a.status === "IN_REVIEW_L2" ? a.l1ApprovedAt : a.submittedAt;
  if (!since) return { waitingMin: 0, overdue: false };
  const waitingMin = Math.floor((now.getTime() - since.getTime()) / 60000);
  const sla = a.status === "PENDING_L1" ? REVIEW_SLA_L1_MINUTES : a.status === "PENDING_L2" ? REVIEW_SLA_L2_MINUTES : Infinity;
  return { waitingMin, overdue: waitingMin > sla };
}

export function formatWaiting(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ ${min % 60} phút`;
  return `${Math.floor(h / 24)} ngày ${h % 24} giờ`;
}
