import { z } from "zod";
import type { AdFrequency, AdPosition } from "@prisma/client";
import { toIsoVN } from "./time";

/**
 * Quảng cáo: banner 2 bên (trái/phải) và popup. File này không truy cập DB để dùng được ở cả server và client.
 * Phía công khai tránh chữ "ad"/"banner" trong URL và class (trình chặn quảng cáo sẽ ẩn chúng).
 */

export const AD_POSITIONS = ["LEFT", "RIGHT", "POPUP"] as const satisfies readonly AdPosition[];
export const AD_FREQUENCIES = ["SESSION", "DAILY", "EVERY_PAGE"] as const satisfies readonly AdFrequency[];

export const POSITION_LABELS: Record<AdPosition, string> = {
  LEFT: "Banner bên trái",
  RIGHT: "Banner bên phải",
  POPUP: "Popup",
};

/** Kích thước gợi ý khi thiết kế ảnh. */
export const POSITION_SIZE_HINT: Record<AdPosition, string> = {
  LEFT: "rộng 160px (ví dụ 160×600), hiện ở màn hình rộng từ 1560px",
  RIGHT: "rộng 160px (ví dụ 160×600), hiện ở màn hình rộng từ 1560px",
  POPUP: "khoảng 600×500, hiện giữa màn hình",
};

export const FREQUENCY_LABELS: Record<AdFrequency, string> = {
  SESSION: "Một lần mỗi phiên truy cập",
  DAILY: "Một lần mỗi ngày",
  EVERY_PAGE: "Mỗi lần mở trang",
};

export type AdStatus = "OFF" | "SCHEDULED" | "RUNNING" | "EXPIRED";

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  OFF: "Đang tắt",
  SCHEDULED: "Chờ đến lịch",
  RUNNING: "Đang chạy",
  EXPIRED: "Hết hạn",
};

interface Schedulable {
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
}

export function adStatus(ad: Schedulable, now: Date = new Date()): AdStatus {
  if (!ad.isActive) return "OFF";
  if (ad.startAt && ad.startAt > now) return "SCHEDULED";
  if (ad.endAt && ad.endAt <= now) return "EXPIRED";
  return "RUNNING";
}

/** Liên kết đích: https/http tuyệt đối hoặc đường dẫn nội bộ bắt đầu bằng "/" (không phải "//"). */
export function isSafeAdLink(url: string): boolean {
  if (/^\/(?!\/)/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Giá trị ô datetime-local (giờ Việt Nam) ↔ Date. */
export function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toLocalInput(date: Date | null | undefined): string {
  return date ? toIsoVN(date).slice(0, 16) : "";
}

const localDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = fromLocalInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Thời gian không hợp lệ." });
    return d;
  });

export const adInputSchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên quảng cáo.").max(120, "Tên tối đa 120 ký tự."),
    position: z.enum(AD_POSITIONS),
    mediaId: z.string().min(1, "Chọn ảnh quảng cáo."),
    linkUrl: z
      .string()
      .trim()
      .max(1000)
      .refine((v) => !v || isSafeAdLink(v), "Liên kết phải bắt đầu bằng https://, http:// hoặc /")
      .transform((v) => v || null),
    openNewTab: z.boolean(),
    homeOnly: z.boolean(),
    frequency: z.enum(AD_FREQUENCIES),
    startAt: localDate,
    endAt: localDate,
    isActive: z.boolean(),
  })
  .refine((v) => !v.startAt || !v.endAt || v.endAt > v.startAt, { message: "Thời gian kết thúc phải sau thời gian bắt đầu.", path: ["endAt"] });

export type AdInput = z.input<typeof adInputSchema>;

/** Dữ liệu gửi xuống trang công khai. */
export interface PublicAd {
  id: number;
  position: AdPosition;
  name: string;
  /** Ảnh 960px (popup) và 320px (banner 2 bên). */
  image: string;
  thumb: string;
  width: number;
  height: number;
  /** Đường dẫn đếm lượt bấm rồi chuyển tiếp; null nếu không có liên kết. */
  href: string | null;
  newTab: boolean;
  homeOnly: boolean;
  frequency: AdFrequency;
  startAt: string | null;
  endAt: string | null;
}

export function isPublicAdLive(ad: Pick<PublicAd, "startAt" | "endAt">, now: Date = new Date()): boolean {
  return adStatus({ isActive: true, startAt: ad.startAt ? new Date(ad.startAt) : null, endAt: ad.endAt ? new Date(ad.endAt) : null }, now) === "RUNNING";
}

/**
 * Popup có được hiện không, theo tần suất và lần hiện trước.
 * `lastShownAt`: thời điểm đã hiện (lưu ở localStorage cho DAILY); `shownThisSession`: cờ sessionStorage.
 */
export function shouldShowPopup(frequency: AdFrequency, state: { lastShownAt: Date | null; shownThisSession: boolean }, now: Date = new Date()): boolean {
  if (frequency === "EVERY_PAGE") return true;
  if (frequency === "SESSION") return !state.shownThisSession;
  return !state.lastShownAt || toIsoVN(state.lastShownAt).slice(0, 10) !== toIsoVN(now).slice(0, 10);
}
