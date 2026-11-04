import { authenticator } from "otplib";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "./password";
import { SITE_NAME } from "@/lib/config";

authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(secret: string, token: string): boolean {
  return authenticator.check(token.replace(/\s/g, ""), secret);
}

export async function totpQrDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(authenticator.keyuri(email, `${SITE_NAME} CMS`, secret));
}

export function generateBackupCodes(n = 8): string[] {
  return Array.from({ length: n }, () => randomBytes(5).toString("hex").toUpperCase());
}

export function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => hashPassword(c)));
}

/** Trả về chỉ số mã dự phòng khớp, hoặc -1. */
export async function matchBackupCode(hashes: string[], code: string): Promise<number> {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await verifyPassword(hashes[i], normalized)) return i;
  }
  return -1;
}
