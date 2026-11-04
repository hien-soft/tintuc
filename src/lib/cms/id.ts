import { randomBytes } from "crypto";

/** ID ngắn, sắp xếp được theo thời gian (dùng cho Media). */
export function createId(): string {
  return `m${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
}
