import type { Role } from "@prisma/client";

/** Các quyền theo ma trận mục 5.2. */
export const ACTIONS = [
  "article.create",
  "article.editOwnDraft",
  "article.submitOwn",
  "article.withdrawOwn",
  "review.l1.view",
  "review.l1.act",
  "review.l1.edit",
  "review.l2.view",
  "review.l2.act",
  "article.unpublish",
  "article.correct",
  "article.pin",
  "home.layout",
  "media.manageOwn",
  "media.manageAll",
  "taxonomy.manage",
  "ads.manage",
  "user.manage",
  "audit.viewArticle",
  "audit.viewAll",
] as const;

export type Action = (typeof ACTIONS)[number];

export const PERMISSIONS: Record<Role, readonly Action[]> = {
  REPORTER: ["article.create", "article.editOwnDraft", "article.submitOwn", "article.withdrawOwn", "media.manageOwn"],
  EDITOR_L1: [
    "article.create",
    "article.editOwnDraft",
    "article.submitOwn",
    "review.l1.view",
    "review.l1.act",
    "review.l1.edit",
    "media.manageOwn",
    "media.manageAll",
  ],
  EDITOR_L2: [
    "article.create",
    "article.editOwnDraft",
    "article.submitOwn",
    "review.l1.view",
    "review.l2.view",
    "review.l2.act",
    "article.unpublish",
    "article.correct",
    "article.pin",
    "home.layout",
    "media.manageOwn",
    "media.manageAll",
    "taxonomy.manage",
    "ads.manage",
    "audit.viewArticle",
  ],
  ADMIN: ["media.manageOwn", "media.manageAll", "taxonomy.manage", "ads.manage", "user.manage", "audit.viewArticle", "audit.viewAll"],
};

/** Quyền phụ thuộc phạm vi danh mục (chỉ áp dụng với EDITOR_L1). */
const SCOPED_ACTIONS: readonly Action[] = ["review.l1.view", "review.l1.act", "review.l1.edit"];

export const ROLE_LABELS: Record<Role, string> = {
  REPORTER: "Phóng viên / CTV",
  EDITOR_L1: "Biên tập viên – Duyệt cấp 1",
  EDITOR_L2: "Thư ký tòa soạn / TBT – Duyệt cấp 2",
  ADMIN: "Quản trị hệ thống",
};

/** Vai trò bắt buộc bật 2FA. */
export const ROLES_REQUIRING_2FA: readonly Role[] = ["EDITOR_L1", "EDITOR_L2", "ADMIN"];

export interface RbacUser {
  id: string;
  roles: Role[];
  /** ID nội bộ các danh mục được phân công (EDITOR_L1). */
  categoryScopes: number[];
}

export interface RbacResource {
  categoryId?: number;
  ownerId?: string;
}

function roleGrants(role: Role, action: Action, user: RbacUser, resource?: RbacResource): boolean {
  if (!PERMISSIONS[role].includes(action)) return false;
  if (role === "EDITOR_L1" && SCOPED_ACTIONS.includes(action) && resource?.categoryId !== undefined) {
    return user.categoryScopes.includes(resource.categoryId);
  }
  if ((action === "article.editOwnDraft" || action === "article.submitOwn" || action === "article.withdrawOwn") && resource?.ownerId) {
    return resource.ownerId === user.id;
  }
  return true;
}

/**
 * Kiểm tra quyền theo vai trò và phạm vi danh mục.
 * Người giữ nhiều vai trò được cấp quyền nếu bất kỳ vai trò nào cho phép.
 */
export function can(user: RbacUser, action: Action, resource?: RbacResource): boolean {
  return user.roles.some((role) => roleGrants(role, action, user, resource));
}

export function requiresTwoFactor(roles: Role[]): boolean {
  return roles.some((r) => ROLES_REQUIRING_2FA.includes(r));
}
