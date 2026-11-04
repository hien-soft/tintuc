import { hash, verify, type Algorithm } from "@node-rs/argon2";
import { z } from "zod";

// 2 = Algorithm.Argon2id (const enum không dùng được với isolatedModules)
const OPTIONS = { algorithm: 2 as Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

export const passwordSchema = z
  .string()
  .min(10, "Mật khẩu tối thiểu 10 ký tự.")
  .regex(/[A-Z]/, "Mật khẩu phải có chữ hoa.")
  .regex(/[a-z]/, "Mật khẩu phải có chữ thường.")
  .regex(/[0-9]/, "Mật khẩu phải có chữ số.");
