import { TIME_ZONE } from "./config";

function parts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  if (out.hour === "24") out.hour = "00";
  return out;
}

/** dd/MM/yyyy HH:mm theo giờ Việt Nam. */
export function formatDateTime(date: Date): string {
  const p = parts(date);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatDate(date: Date): string {
  const p = parts(date);
  return `${p.day}/${p.month}/${p.year}`;
}

/** Dưới 24 giờ: tương đối; từ 24 giờ trở lên: dd/MM/yyyy HH:mm. */
export function formatRelative(date: Date, now: Date = new Date(), locale: "vi" | "en" = "vi"): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0 || diffMs >= 24 * 3600 * 1000) return formatDateTime(date);
  const minutes = Math.floor(diffMs / 60000);
  if (locale === "en") {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const h = Math.floor(minutes / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  return `${Math.floor(minutes / 60)} giờ trước`;
}

/** Đồng hồ thanh trên cùng: dd/MM/yyyy - HH:mm’ (GMT +7). */
export function formatClock(date: Date): string {
  const p = parts(date);
  return `${p.day}/${p.month}/${p.year} - ${p.hour}:${p.minute}’ (GMT +7)`;
}

/** ISO 8601 với offset +07:00 (cho Open Graph / JSON-LD). */
export function toIsoVN(date: Date): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+07:00`;
}

/** Ngày (00:00 UTC) tương ứng với ngày lịch ở Việt Nam — dùng làm khóa thống kê. */
export function vnDay(date: Date = new Date()): Date {
  const p = parts(date);
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00.000Z`);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}
