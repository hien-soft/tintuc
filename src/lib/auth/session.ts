import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requiresTwoFactor, type RbacUser } from "@/lib/rbac/permissions";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "ttvn_session";
const SESSION_MAX_AGE_MS = 8 * 3600 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const PENDING_2FA_MAX_AGE_MS = 10 * 60 * 1000;

export interface CmsUser extends RbacUser {
  email: string;
  fullName: string;
  roles: Role[];
  mustChangePassword: boolean;
  totpEnabled: boolean;
  require2fa: boolean;
}

export async function createSession(userId: string, opts: { pending2fa: boolean; ip?: string; userAgent?: string }): Promise<void> {
  const token = randomToken();
  const maxAge = opts.pending2fa ? PENDING_2FA_MAX_AGE_MS : SESSION_MAX_AGE_MS;
  await db.session.create({
    data: {
      sessionToken: sha256(token),
      userId,
      expires: new Date(Date.now() + maxAge),
      pending2fa: opts.pending2fa,
      ip: opts.ip,
      userAgent: opts.userAgent?.slice(0, 500),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(maxAge / 1000),
  });
}

async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Đọc phiên hiện tại; trả về null nếu không có/hết hạn/quá thời gian không thao tác. */
export async function getSession() {
  const token = await currentToken();
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { sessionToken: sha256(token) },
    include: { user: { include: { categoryScopes: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  const idle = now - session.lastActiveAt.getTime() > SESSION_IDLE_MS;
  if (session.expires.getTime() < now || idle || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastActiveAt.getTime() > 60_000) {
    await db.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
  }
  const u = session.user;
  const user: CmsUser = {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    roles: u.roles,
    categoryScopes: u.categoryScopes.map((s) => s.categoryId),
    mustChangePassword: u.mustChangePassword,
    totpEnabled: u.totpEnabled,
    require2fa: u.require2fa || requiresTwoFactor(u.roles),
  };
  return { id: session.id, pending2fa: session.pending2fa, user };
}

/**
 * Dùng trong trang CMS: chuyển hướng nếu chưa đăng nhập / chưa qua 2FA / phải đổi mật khẩu / phải thiết lập 2FA.
 * `allow` cho phép các trang trung gian (đổi mật khẩu, thiết lập 2FA) tự gọi.
 */
export async function requireUser(allow: { changePassword?: boolean; setup2fa?: boolean } = {}): Promise<CmsUser> {
  const s = await getSession();
  if (!s) redirect("/Admin/login");
  if (s.pending2fa) redirect("/Admin/login/2fa");
  if (s.user.mustChangePassword && !allow.changePassword) redirect("/Admin/change-password");
  if (s.user.require2fa && !s.user.totpEnabled && !allow.setup2fa && !allow.changePassword) redirect("/Admin/setup-2fa");
  return s.user;
}

/** Dùng trong server action: ném lỗi thay vì chuyển hướng. */
export async function requireActionUser(): Promise<CmsUser> {
  const s = await getSession();
  if (!s || s.pending2fa) throw new AppError("UNAUTHORIZED");
  if (s.user.mustChangePassword || (s.user.require2fa && !s.user.totpEnabled)) throw new AppError("FORBIDDEN");
  return s.user;
}

export async function getPending2faSession() {
  const token = await currentToken();
  if (!token) return null;
  const session = await db.session.findUnique({ where: { sessionToken: sha256(token) }, include: { user: true } });
  if (!session || !session.pending2fa || session.expires.getTime() < Date.now()) return null;
  return session;
}

/** Nâng phiên chờ 2FA thành phiên đầy đủ (đổi token để tránh session fixation). */
export async function promoteSession(sessionId: string, userId: string, meta: { ip?: string; userAgent?: string }): Promise<void> {
  await db.session.delete({ where: { id: sessionId } });
  await createSession(userId, { pending2fa: false, ...meta });
}

export async function destroySession(): Promise<void> {
  const token = await currentToken();
  if (token) await db.session.deleteMany({ where: { sessionToken: sha256(token) } });
  (await cookies()).delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
