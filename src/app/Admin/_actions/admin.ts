"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActionUser, destroyAllSessions, type CmsUser } from "@/lib/auth/session";
import { requestMeta } from "@/lib/auth/misc";
import { can, type Action } from "@/lib/rbac/permissions";
import { writeAudit } from "@/lib/audit";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { slugify } from "@/lib/slug";
import { randomToken } from "@/lib/auth/crypto";
import { sendMail } from "@/lib/notify";

async function guard(action: Action): Promise<CmsUser> {
  const user = await requireActionUser();
  if (!can(user, action)) throw new AppError("FORBIDDEN");
  return user;
}

async function audit(user: CmsUser, action: string, entityType: string, entityId: string | number, metadata?: Record<string, unknown>) {
  await writeAudit({ actorId: user.id, action, entityType, entityId, metadata: metadata as never, ...(await requestMeta()) });
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on";

// ---------- Danh mục ----------
export async function saveCategoryAction(fd: FormData): Promise<void> {
  const user = await guard("taxonomy.manage");
  const data = z
    .object({
      id: z.coerce.number().int().optional(),
      name: z.string().min(1).max(100),
      slug: z.string().max(100),
      publicId: z.coerce.number().int().positive(),
      type: z.enum(["NEWS", "PHOTO", "FEED"]),
      footerCol: z.coerce.number().int().min(0).max(4),
    })
    .parse({ id: str(fd, "id") || undefined, name: str(fd, "name"), slug: str(fd, "slug"), publicId: str(fd, "publicId"), type: str(fd, "type"), footerCol: str(fd, "footerCol") || 0 });
  const payload = {
    name: data.name,
    slug: slugify(data.slug || data.name),
    publicId: data.publicId,
    type: data.type,
    footerCol: data.footerCol || null,
    isActive: bool(fd, "isActive"),
    showInMenu: bool(fd, "showInMenu"),
  };
  const row = data.id
    ? await db.category.update({ where: { id: data.id }, data: payload })
    : await db.category.create({ data: { ...payload, order: (await db.category.count()) + 1 } });
  await audit(user, data.id ? "CATEGORY_UPDATE" : "CATEGORY_CREATE", "Category", row.id, payload);
  revalidatePath("/Admin/categories");
  revalidatePath("/", "layout");
}

/** Sắp xếp: nhận danh sách id theo thứ tự mới (từ kéo-thả). */
export async function reorderAction(kind: "category" | "topic" | "partner" | "ad", ids: number[]): Promise<void> {
  const user = await guard(kind === "ad" ? "ads.manage" : "taxonomy.manage");
  const list = z.array(z.number().int()).max(500).parse(ids);
  await db.$transaction(
    list.map((id, order) =>
      kind === "category"
        ? db.category.update({ where: { id }, data: { order } })
        : kind === "topic"
          ? db.topic.update({ where: { id }, data: { order } })
          : kind === "partner"
            ? db.partner.update({ where: { id }, data: { order } })
            : db.ad.update({ where: { id }, data: { order } }),
    ),
  );
  if (kind === "ad") revalidatePath("/Admin/ads");
  await audit(user, `${kind.toUpperCase()}_REORDER`, kind, list.join(","));
  revalidatePath("/", "layout");
}

// ---------- Chuyên đề ----------
export async function saveTopicAction(fd: FormData): Promise<void> {
  const user = await guard("taxonomy.manage");
  const id = Number(str(fd, "id"));
  const name = str(fd, "name");
  if (!id || !name) throw new AppError("VALIDATION_ERROR", "Thiếu ID hoặc tên chuyên đề.");
  const payload = { name, slug: slugify(str(fd, "slug") || name), bannerUrl: str(fd, "bannerUrl") || null, isFeatured: bool(fd, "isFeatured"), isActive: bool(fd, "isActive") };
  const exists = await db.topic.findUnique({ where: { id } });
  if (exists && fd.get("mode") === "create") throw new AppError("VALIDATION_ERROR", "ID chuyên đề đã tồn tại.");
  await db.topic.upsert({ where: { id }, create: { id, ...payload, order: id }, update: payload });
  await audit(user, exists ? "TOPIC_UPDATE" : "TOPIC_CREATE", "Topic", id, payload);
  revalidatePath("/Admin/topics");
  revalidatePath("/", "layout");
}

// ---------- Nguồn ----------
export async function saveSourceAction(fd: FormData): Promise<void> {
  const user = await guard("taxonomy.manage");
  const id = Number(str(fd, "id")) || undefined;
  const name = str(fd, "name");
  const homepage = str(fd, "homepage");
  if (!name) throw new AppError("VALIDATION_ERROR", "Thiếu tên nguồn.");
  if (homepage && !homepage.startsWith("https://")) throw new AppError("VALIDATION_ERROR", "Trang chủ nguồn phải bắt đầu bằng https://");
  const payload = { name, slug: slugify(str(fd, "slug") || name), homepage: homepage || null };
  const row = id ? await db.source.update({ where: { id }, data: payload }) : await db.source.create({ data: payload });
  await audit(user, id ? "SOURCE_UPDATE" : "SOURCE_CREATE", "Source", row.id, payload);
  revalidatePath("/Admin/sources");
}

// ---------- Đối tác ----------
export async function savePartnerAction(fd: FormData): Promise<void> {
  const user = await guard("taxonomy.manage");
  const id = Number(str(fd, "id")) || undefined;
  const url = str(fd, "url");
  if (!/^https?:\/\//.test(url)) throw new AppError("VALIDATION_ERROR", "Đường dẫn đối tác không hợp lệ.");
  const payload = { name: str(fd, "name"), logoUrl: str(fd, "logoUrl"), url, isActive: bool(fd, "isActive") };
  const row = id ? await db.partner.update({ where: { id }, data: payload }) : await db.partner.create({ data: { ...payload, order: (await db.partner.count()) + 1 } });
  await audit(user, id ? "PARTNER_UPDATE" : "PARTNER_CREATE", "Partner", row.id, payload);
  revalidatePath("/Admin/sources");
  revalidatePath("/", "layout");
}

// ---------- Bố cục trang chủ ----------
export async function setHomeSlotAction(fd: FormData): Promise<void> {
  const user = await guard("home.layout");
  const key = str(fd, "key");
  if (!/^[A-Z0-9_]{3,40}$/.test(key)) throw new AppError("VALIDATION_ERROR");
  const ids = str(fd, "articleIds").split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12);
  const valid = await db.article.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: { id: true } });
  const articleIds = ids.filter((id) => valid.some((v) => v.id === id));
  await db.homeSlot.upsert({ where: { key }, create: { key, articleIds, updatedById: user.id }, update: { articleIds, updatedById: user.id } });
  await audit(user, "HOME_SLOT_UPDATE", "HomeSlot", key, { articleIds });
  revalidatePath("/Admin/home-layout");
  revalidatePath("/", "layout");
}

export async function toggleTopicFeaturedAction(fd: FormData): Promise<void> {
  const user = await guard("home.layout");
  const id = Number(str(fd, "id"));
  const t = await db.topic.findUniqueOrThrow({ where: { id } });
  await db.topic.update({ where: { id }, data: { isFeatured: !t.isFeatured } });
  await audit(user, "TOPIC_FEATURE_TOGGLE", "Topic", id, { isFeatured: !t.isFeatured });
  revalidatePath("/Admin/home-layout");
  revalidatePath("/", "layout");
}

// ---------- Người dùng ----------
const ROLES = ["REPORTER", "EDITOR_L1", "EDITOR_L2", "ADMIN"] as const;

export async function createUserAction(fd: FormData): Promise<void> {
  const user = await guard("user.manage");
  const data = z
    .object({ email: z.string().trim().toLowerCase().email(), fullName: z.string().trim().min(2).max(100), password: passwordSchema })
    .parse({ email: str(fd, "email"), fullName: str(fd, "fullName"), password: str(fd, "password") });
  const roles = ROLES.filter((r) => fd.getAll("roles").includes(r));
  if (roles.length === 0) throw new AppError("VALIDATION_ERROR", "Chọn ít nhất một vai trò.");
  const created = await db.user.create({
    data: { email: data.email, fullName: data.fullName, passwordHash: await hashPassword(data.password), roles: [...roles], mustChangePassword: true, require2fa: bool(fd, "require2fa") },
  });
  await audit(user, "USER_CREATE", "User", created.id, { email: data.email, roles });
  revalidatePath("/Admin/users");
}

export async function updateUserAction(fd: FormData): Promise<void> {
  const actor = await guard("user.manage");
  const id = str(fd, "id");
  const target = await db.user.findUniqueOrThrow({ where: { id }, include: { categoryScopes: true } });
  const roles = ROLES.filter((r) => fd.getAll("roles").includes(r)) as Role[];
  if (roles.length === 0) throw new AppError("VALIDATION_ERROR", "Chọn ít nhất một vai trò.");
  if (id === actor.id && !roles.includes("ADMIN")) throw new AppError("VALIDATION_ERROR", "Không thể tự bỏ quyền quản trị của chính mình.");
  const scopes = fd.getAll("scopes").map(Number).filter(Number.isInteger);
  const require2fa = bool(fd, "require2fa");
  await db.$transaction([
    db.user.update({ where: { id }, data: { roles, fullName: str(fd, "fullName") || target.fullName, require2fa } }),
    db.userCategoryScope.deleteMany({ where: { userId: id } }),
    db.userCategoryScope.createMany({ data: roles.includes("EDITOR_L1") ? scopes.map((categoryId) => ({ userId: id, categoryId })) : [] }),
  ]);
  if (target.roles.join() !== roles.join()) await audit(actor, "USER_ROLE_CHANGE", "User", id, { from: target.roles, to: roles });
  const before = target.categoryScopes.map((s) => s.categoryId).sort().join();
  if (before !== [...scopes].sort().join()) await audit(actor, "USER_SCOPE_CHANGE", "User", id, { scopes });
  if (target.require2fa !== require2fa) await audit(actor, "USER_REQUIRE_2FA", "User", id, { require2fa });
  revalidatePath("/Admin/users");
}

export async function toggleUserLockAction(fd: FormData): Promise<void> {
  const actor = await guard("user.manage");
  const id = str(fd, "id");
  if (id === actor.id) throw new AppError("VALIDATION_ERROR", "Không thể tự khóa tài khoản của mình.");
  const target = await db.user.findUniqueOrThrow({ where: { id } });
  const isActive = !target.isActive || (target.lockedUntil !== null && target.lockedUntil > new Date());
  await db.user.update({ where: { id }, data: { isActive, lockedUntil: null, failedLoginCount: 0 } });
  if (!isActive) await destroyAllSessions(id);
  await audit(actor, isActive ? "USER_UNLOCK" : "USER_LOCK", "User", id);
  revalidatePath("/Admin/users");
}

export async function resetUserPasswordAction(fd: FormData): Promise<void> {
  const actor = await guard("user.manage");
  const id = str(fd, "id");
  const target = await db.user.findUniqueOrThrow({ where: { id } });
  const temp = `Tm${randomToken(6)}9`;
  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } });
  await destroyAllSessions(id);
  await sendMail(target.email, "Mật khẩu CMS đã được đặt lại", `Quản trị viên đã đặt lại mật khẩu của bạn.\nMật khẩu tạm: ${temp}\nBạn sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu.`);
  await audit(actor, "USER_PASSWORD_RESET", "User", id);
  revalidatePath("/Admin/users");
}

export async function forceLogoutAction(fd: FormData): Promise<void> {
  const actor = await guard("user.manage");
  const id = str(fd, "id");
  await destroyAllSessions(id);
  await audit(actor, "USER_FORCE_LOGOUT", "User", id);
  revalidatePath("/Admin/users");
}
