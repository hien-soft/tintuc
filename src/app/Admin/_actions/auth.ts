"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { createCaptcha, rateLimit, requestMeta, verifyCaptcha } from "@/lib/auth/misc";
import { decrypt, encrypt, randomToken, sha256 } from "@/lib/auth/crypto";
import { generateBackupCodes, generateTotpSecret, hashBackupCodes, matchBackupCode, verifyTotp } from "@/lib/auth/totp";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getPending2faSession,
  getSession,
  promoteSession,
  requireUser,
} from "@/lib/auth/session";
import { sendMail } from "@/lib/notify";
import { SITE_URL } from "@/lib/config";
import { kv } from "@/lib/kv";

export interface FormState {
  error?: string;
  success?: string;
  captcha?: { question: string; token: string };
  backupCodes?: string[];
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const CAPTCHA_AFTER = 3;
const GENERIC_LOGIN_ERROR = "Email hoặc mật khẩu không đúng.";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  captchaToken: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const meta = await requestMeta();
  if (!(await rateLimit(`login:ip:${meta.ip}`, 30, 15 * 60))) {
    return { error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút." };
  }
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, captchaToken, captchaAnswer } = parsed.data;

  const store = await kv();
  const ipFails = Number((await store.get(`loginfail:${meta.ip}`)) ?? 0);
  const user = await db.user.findUnique({ where: { email } });
  const needCaptcha = ipFails >= CAPTCHA_AFTER || (user?.failedLoginCount ?? 0) >= CAPTCHA_AFTER;

  if (needCaptcha && !verifyCaptcha(captchaToken, captchaAnswer)) {
    return { error: captchaToken ? "Mã xác nhận không đúng." : "Vui lòng nhập mã xác nhận.", captcha: createCaptcha() };
  }

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await writeAudit({ actorId: user.id, action: "LOGIN_BLOCKED_LOCKED", entityType: "User", entityId: user.id, ...meta });
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${mins} phút.`, captcha: createCaptcha() };
  }

  const ok = user && user.isActive && (await verifyPassword(user.passwordHash, password));
  if (!ok) {
    await store.incr(`loginfail:${meta.ip}`, 15 * 60);
    if (user) {
      const count = user.failedLoginCount + 1;
      const lock = count >= MAX_FAILED;
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: lock ? 0 : count, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : undefined },
      });
      await writeAudit({ actorId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id, metadata: { count }, ...meta });
      if (lock) {
        await writeAudit({ actorId: null, action: "ACCOUNT_LOCKED", entityType: "User", entityId: user.id, metadata: { minutes: LOCK_MINUTES }, ...meta });
        return { error: `Bạn đã nhập sai ${MAX_FAILED} lần. Tài khoản bị khóa ${LOCK_MINUTES} phút.`, captcha: createCaptcha() };
      }
    } else {
      await writeAudit({ action: "LOGIN_FAILED", entityType: "User", metadata: { email }, ...meta });
    }
    const showCaptcha = ipFails + 1 >= CAPTCHA_AFTER || (user?.failedLoginCount ?? 0) + 1 >= CAPTCHA_AFTER;
    return { error: GENERIC_LOGIN_ERROR, captcha: showCaptcha ? createCaptcha() : undefined };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await store.del(`loginfail:${meta.ip}`);

  if (user.totpEnabled) {
    await createSession(user.id, { pending2fa: true, ...meta });
    await writeAudit({ actorId: user.id, action: "LOGIN_PASSWORD_OK", entityType: "User", entityId: user.id, ...meta });
    redirect("/Admin/login/2fa");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, { pending2fa: false, ...meta });
  await writeAudit({ actorId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, ...meta });
  redirect("/Admin");
}

export async function verify2faAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const meta = await requestMeta();
  const session = await getPending2faSession();
  if (!session) redirect("/Admin/login");
  if (!(await rateLimit(`2fa:${session.id}`, 5, 10 * 60))) {
    await destroySession();
    await writeAudit({ actorId: session.userId, action: "LOGIN_2FA_TOO_MANY", entityType: "User", entityId: session.userId, ...meta });
    redirect("/Admin/login");
  }
  const code = String(formData.get("code") ?? "").trim();
  const user = session.user;
  let ok = false;
  let usedBackup = false;
  if (/^\d{6}$/.test(code.replace(/\s/g, "")) && user.totpSecret) {
    ok = verifyTotp(decrypt(user.totpSecret), code);
  } else if (code.length >= 8) {
    const idx = await matchBackupCode(user.backupCodes, code);
    if (idx >= 0) {
      ok = true;
      usedBackup = true;
      await db.user.update({ where: { id: user.id }, data: { backupCodes: user.backupCodes.filter((_, i) => i !== idx) } });
    }
  }
  if (!ok) {
    await writeAudit({ actorId: user.id, action: "LOGIN_2FA_FAILED", entityType: "User", entityId: user.id, ...meta });
    return { error: "Mã xác thực không đúng." };
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await promoteSession(session.id, user.id, meta);
  await writeAudit({ actorId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, metadata: { method: usedBackup ? "backup_code" : "totp" }, ...meta });
  redirect("/Admin");
}

export async function logoutAction(): Promise<void> {
  const s = await getSession();
  const meta = await requestMeta();
  await destroySession();
  if (s) await writeAudit({ actorId: s.user.id, action: "LOGOUT", entityType: "User", entityId: s.user.id, ...meta });
  redirect("/Admin/login");
}

export async function logoutAllAction(): Promise<void> {
  const s = await getSession();
  const meta = await requestMeta();
  if (s) {
    await destroyAllSessions(s.user.id);
    await writeAudit({ actorId: s.user.id, action: "LOGOUT_ALL", entityType: "User", entityId: s.user.id, ...meta });
  }
  await destroySession();
  redirect("/Admin/login");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const meta = await requestMeta();
  const success = "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút.";
  if (!(await rateLimit(`forgot:${meta.ip}`, 5, 15 * 60))) return { success };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user?.isActive) {
    const token = randomToken();
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
    await sendMail(user.email, "Đặt lại mật khẩu CMS", `Nhấn vào liên kết sau để đặt lại mật khẩu (hiệu lực 30 phút, dùng 1 lần):\n${SITE_URL}/Admin/reset-password/${token}`);
    await writeAudit({ actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id, ...meta });
  }
  return { success };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const meta = await requestMeta();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Mật khẩu nhập lại không khớp." };
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { error: pw.error.issues[0].message };
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "Liên kết không hợp lệ hoặc đã hết hạn." };
  await db.$transaction([
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  await writeAudit({ actorId: row.userId, action: "PASSWORD_RESET", entityType: "User", entityId: row.userId, ...meta });
  return { success: "Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ changePassword: true });
  const meta = await requestMeta();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Mật khẩu nhập lại không khớp." };
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { error: pw.error.issues[0].message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, current))) return { error: "Mật khẩu hiện tại không đúng." };
  if (current === password) return { error: "Mật khẩu mới phải khác mật khẩu hiện tại." };
  const wasForced = row.mustChangePassword;
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  await writeAudit({ actorId: user.id, action: "PASSWORD_CHANGE", entityType: "User", entityId: user.id, ...meta });
  if (wasForced) redirect("/Admin");
  return { success: "Đã đổi mật khẩu." };
}

/** Bắt đầu thiết lập 2FA: sinh secret mới (chưa bật cho tới khi xác nhận mã). */
export async function begin2faSetup(): Promise<string> {
  const user = await requireUser({ setup2fa: true });
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (row.totpEnabled) throw new Error("2FA đã được bật.");
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: encrypt(secret) } });
  return secret;
}

export async function confirm2faAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ setup2fa: true });
  const meta = await requestMeta();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.totpSecret) return { error: "Vui lòng tải lại trang để tạo mã mới." };
  if (!verifyTotp(decrypt(row.totpSecret), String(formData.get("code") ?? ""))) return { error: "Mã xác thực không đúng." };
  const codes = generateBackupCodes();
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true, backupCodes: await hashBackupCodes(codes) } });
  await writeAudit({ actorId: user.id, action: "TOTP_ENABLED", entityType: "User", entityId: user.id, ...meta });
  return { success: "Đã bật xác thực 2 lớp. Hãy lưu các mã dự phòng dưới đây — chúng chỉ hiển thị một lần.", backupCodes: codes };
}

export async function disable2faAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const meta = await requestMeta();
  if (user.require2fa) return { error: "Vai trò của bạn bắt buộc bật xác thực 2 lớp." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, String(formData.get("password") ?? "")))) return { error: "Mật khẩu không đúng." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null, backupCodes: [] } });
  await writeAudit({ actorId: user.id, action: "TOTP_DISABLED", entityType: "User", entityId: user.id, ...meta });
  return { success: "Đã tắt xác thực 2 lớp." };
}

export async function updateEmailNotifyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { emailNotify: formData.get("emailNotify") === "on" } });
}
