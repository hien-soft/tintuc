import type { Prisma } from "@prisma/client";
import type { CmsUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";

export interface AuditFilters {
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
}

/** EDITOR_L2 chỉ xem nhật ký bài viết; ADMIN xem toàn bộ. */
export function auditWhere(user: CmsUser, f: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (!can(user, "audit.viewAll")) and.push({ entityType: "Article" });
  if (f.actor) and.push({ actorId: f.actor });
  if (f.action) and.push({ action: { contains: f.action, mode: "insensitive" } });
  if (f.entityType) and.push({ entityType: f.entityType });
  if (f.entityId) and.push({ entityId: f.entityId });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+07:00`) } });
  if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59+07:00`) } });
  return { AND: and };
}
