import type { ArticleStatus } from "@prisma/client";
import { can, type Action, type RbacUser } from "@/lib/rbac/permissions";
import type { ErrorCode } from "@/lib/errors";

export type WorkflowAction =
  | "SUBMIT"
  | "WITHDRAW"
  | "CLAIM_L1"
  | "RELEASE_L1"
  | "APPROVE_L1"
  | "RETURN_L1"
  | "REJECT_L1"
  | "CLAIM_L2"
  | "RELEASE_L2"
  | "PUBLISH"
  | "SCHEDULE"
  | "RETURN_L2"
  | "SEND_BACK_L1"
  | "REJECT_L2"
  | "RESUBMIT"
  | "AUTO_PUBLISH"
  | "CANCEL_SCHEDULE"
  | "UNPUBLISH"
  | "CORRECT"
  | "REQUEUE"
  | "ARCHIVE";

type Actor = "owner" | "holder" | "reviewer" | "system";

export interface Transition {
  from: ArticleStatus;
  to: ArticleStatus;
  action: WorkflowAction;
  /** null = chỉ hệ thống (job) được thực hiện. */
  requiredPermission: Action | null;
  requiresReason: boolean;
  /** owner: chỉ tác giả; holder: chỉ người đang nhận duyệt; reviewer: người có quyền. */
  actor: Actor;
  /** Cấp duyệt — dùng cho quy tắc tách biệt người duyệt. */
  level?: 1 | 2;
  label: string;
  /** Kiểu nút trên UI. */
  tone: "primary" | "default" | "danger";
}

export const TRANSITIONS: readonly Transition[] = [
  { from: "DRAFT", to: "PENDING_L1", action: "SUBMIT", requiredPermission: "article.submitOwn", requiresReason: false, actor: "owner", label: "Gửi duyệt", tone: "primary" },
  { from: "PENDING_L1", to: "DRAFT", action: "WITHDRAW", requiredPermission: "article.withdrawOwn", requiresReason: false, actor: "owner", label: "Rút bài", tone: "default" },
  { from: "PENDING_L1", to: "IN_REVIEW_L1", action: "CLAIM_L1", requiredPermission: "review.l1.act", requiresReason: false, actor: "reviewer", level: 1, label: "Nhận duyệt", tone: "primary" },
  { from: "IN_REVIEW_L1", to: "PENDING_L1", action: "RELEASE_L1", requiredPermission: "review.l1.act", requiresReason: false, actor: "holder", level: 1, label: "Nhả bài", tone: "default" },
  { from: "IN_REVIEW_L1", to: "PENDING_L2", action: "APPROVE_L1", requiredPermission: "review.l1.act", requiresReason: false, actor: "holder", level: 1, label: "Duyệt cấp 1", tone: "primary" },
  { from: "IN_REVIEW_L1", to: "RETURNED", action: "RETURN_L1", requiredPermission: "review.l1.act", requiresReason: true, actor: "holder", level: 1, label: "Trả lại", tone: "default" },
  { from: "IN_REVIEW_L1", to: "REJECTED", action: "REJECT_L1", requiredPermission: "review.l1.act", requiresReason: true, actor: "holder", level: 1, label: "Từ chối", tone: "danger" },
  { from: "PENDING_L2", to: "IN_REVIEW_L2", action: "CLAIM_L2", requiredPermission: "review.l2.act", requiresReason: false, actor: "reviewer", level: 2, label: "Nhận duyệt", tone: "primary" },
  { from: "IN_REVIEW_L2", to: "PENDING_L2", action: "RELEASE_L2", requiredPermission: "review.l2.act", requiresReason: false, actor: "holder", level: 2, label: "Nhả bài", tone: "default" },
  { from: "IN_REVIEW_L2", to: "PUBLISHED", action: "PUBLISH", requiredPermission: "review.l2.act", requiresReason: false, actor: "holder", level: 2, label: "Duyệt & xuất bản", tone: "primary" },
  { from: "IN_REVIEW_L2", to: "SCHEDULED", action: "SCHEDULE", requiredPermission: "review.l2.act", requiresReason: false, actor: "holder", level: 2, label: "Duyệt & hẹn giờ", tone: "default" },
  { from: "IN_REVIEW_L2", to: "RETURNED", action: "RETURN_L2", requiredPermission: "review.l2.act", requiresReason: true, actor: "holder", level: 2, label: "Trả lại tác giả", tone: "default" },
  { from: "IN_REVIEW_L2", to: "PENDING_L1", action: "SEND_BACK_L1", requiredPermission: "review.l2.act", requiresReason: true, actor: "holder", level: 2, label: "Trả về cấp 1", tone: "default" },
  { from: "IN_REVIEW_L2", to: "REJECTED", action: "REJECT_L2", requiredPermission: "review.l2.act", requiresReason: true, actor: "holder", level: 2, label: "Từ chối", tone: "danger" },
  { from: "RETURNED", to: "PENDING_L1", action: "RESUBMIT", requiredPermission: "article.submitOwn", requiresReason: false, actor: "owner", label: "Gửi lại", tone: "primary" },
  { from: "SCHEDULED", to: "PUBLISHED", action: "AUTO_PUBLISH", requiredPermission: null, requiresReason: false, actor: "system", label: "Đến giờ đăng", tone: "default" },
  { from: "SCHEDULED", to: "PENDING_L2", action: "CANCEL_SCHEDULE", requiredPermission: "review.l2.act", requiresReason: false, actor: "reviewer", label: "Hủy hẹn giờ", tone: "default" },
  { from: "PUBLISHED", to: "UNPUBLISHED", action: "UNPUBLISH", requiredPermission: "article.unpublish", requiresReason: true, actor: "reviewer", label: "Gỡ bài", tone: "danger" },
  { from: "PUBLISHED", to: "PUBLISHED", action: "CORRECT", requiredPermission: "article.correct", requiresReason: true, actor: "reviewer", label: "Đính chính", tone: "default" },
  { from: "UNPUBLISHED", to: "PENDING_L2", action: "REQUEUE", requiredPermission: "review.l2.act", requiresReason: false, actor: "reviewer", label: "Đưa lại vào duyệt", tone: "default" },
  { from: "REJECTED", to: "ARCHIVED", action: "ARCHIVE", requiredPermission: "review.l2.act", requiresReason: false, actor: "reviewer", label: "Lưu trữ", tone: "default" },
  { from: "UNPUBLISHED", to: "ARCHIVED", action: "ARCHIVE", requiredPermission: "review.l2.act", requiresReason: false, actor: "reviewer", label: "Lưu trữ", tone: "default" },
];

export const MIN_REASON_LENGTH = 10;

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING_L1: "Chờ duyệt cấp 1",
  IN_REVIEW_L1: "Đang duyệt cấp 1",
  PENDING_L2: "Chờ duyệt cấp 2",
  IN_REVIEW_L2: "Đang duyệt cấp 2",
  RETURNED: "Trả lại để sửa",
  SCHEDULED: "Hẹn giờ đăng",
  PUBLISHED: "Đã xuất bản",
  UNPUBLISHED: "Đã gỡ",
  REJECTED: "Từ chối",
  ARCHIVED: "Lưu trữ",
};

/** Trạng thái tác giả được phép sửa nội dung. */
export const AUTHOR_EDITABLE: readonly ArticleStatus[] = ["DRAFT", "RETURNED"];

export interface WorkflowArticle {
  status: ArticleStatus;
  authorId: string;
  primaryCatId: number;
  l1ReviewerId: string | null;
  holderId: string | null;
}

export interface TransitionInput {
  article: WorkflowArticle;
  action: WorkflowAction;
  /** null khi hệ thống (job) thực hiện. */
  actor: RbacUser | null;
  reason?: string;
  scheduledAt?: Date;
  now?: Date;
}

export type TransitionCheck = { ok: true; transition: Transition } | { ok: false; code: ErrorCode; message?: string };

export function findTransition(from: ArticleStatus, action: WorkflowAction): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.action === action);
}

/** Kiểm tra một chuyển trạng thái — hàm thuần, không đụng DB. */
export function checkTransition(input: TransitionInput): TransitionCheck {
  const { article, action, actor } = input;
  const t = findTransition(article.status, action);
  if (!t) return { ok: false, code: "INVALID_TRANSITION" };

  if (t.actor === "system") {
    return actor === null ? { ok: true, transition: t } : { ok: false, code: "FORBIDDEN" };
  }
  if (!actor) return { ok: false, code: "UNAUTHORIZED" };

  const isAuthor = article.authorId === actor.id;

  // Tác giả không được thực hiện bất kỳ hành động duyệt nào trên bài của mình.
  if (t.level !== undefined && isAuthor) return { ok: false, code: "SELF_REVIEW_NOT_ALLOWED" };
  // Người đã duyệt cấp 1 không được duyệt cấp 2 cùng bài.
  if (t.level === 2 && article.l1ReviewerId === actor.id) return { ok: false, code: "SELF_REVIEW_NOT_ALLOWED" };

  if (t.actor === "owner" && !isAuthor) return { ok: false, code: "FORBIDDEN" };
  if (t.actor === "holder" && article.holderId !== actor.id) {
    return { ok: false, code: "LOCKED", message: "Bài đang do người khác nhận duyệt." };
  }

  if (t.requiredPermission) {
    const resource = { categoryId: article.primaryCatId, ownerId: article.authorId };
    if (!can(actor, t.requiredPermission, resource)) return { ok: false, code: "FORBIDDEN" };
  }

  if (t.requiresReason && (input.reason ?? "").trim().length < MIN_REASON_LENGTH) {
    return { ok: false, code: "VALIDATION_ERROR", message: `Vui lòng nhập lý do (tối thiểu ${MIN_REASON_LENGTH} ký tự).` };
  }

  if (action === "SCHEDULE") {
    const now = input.now ?? new Date();
    if (!input.scheduledAt || input.scheduledAt.getTime() <= now.getTime()) {
      return { ok: false, code: "VALIDATION_ERROR", message: "Giờ hẹn đăng phải ở tương lai." };
    }
  }

  return { ok: true, transition: t };
}

/** Các hành động hợp lệ mà người dùng có thể thực hiện — để hiển thị nút trên UI. */
export function availableActions(article: WorkflowArticle, actor: RbacUser): Transition[] {
  return TRANSITIONS.filter((t) => {
    if (t.from !== article.status || t.actor === "system") return false;
    // bỏ qua kiểm tra lý do / giờ hẹn khi liệt kê nút
    const res = checkTransition({ article, action: t.action, actor, reason: "x".repeat(MIN_REASON_LENGTH), scheduledAt: new Date(Date.now() + 3600_000) });
    return res.ok;
  });
}
