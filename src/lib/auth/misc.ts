import { headers } from "next/headers";
import { randomInt } from "crypto";
import { kv } from "@/lib/kv";
import { hmac, safeEqual } from "./crypto";

export async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}

/** Trả về true nếu vẫn trong giới hạn. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const store = await kv();
  const n = await store.incr(`rl:${key}`, windowSec);
  return n <= limit;
}

/** Captcha phép cộng đơn giản, ký HMAC — không cần dịch vụ ngoài. */
export function createCaptcha(): { question: string; token: string } {
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
  const exp = Date.now() + 10 * 60 * 1000;
  return { question: `${a} + ${b} = ?`, token: `${exp}.${hmac(`captcha:${a + b}:${exp}`)}` };
}

export function verifyCaptcha(token: string | undefined, answer: string | undefined): boolean {
  if (!token || !answer) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now() || !sig) return false;
  return safeEqual(sig, hmac(`captcha:${Number(answer.trim())}:${exp}`));
}

/** Kiểm tra danh sách IP được phép truy cập CMS (CMS_ALLOWED_IPS, phân tách bằng dấu phẩy). */
export function isIpAllowed(ip: string): boolean {
  const list = (process.env.CMS_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(ip);
}
