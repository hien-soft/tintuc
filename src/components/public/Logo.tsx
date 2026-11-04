import { SITE_DOMAIN, SITE_NAME } from "@/lib/config";

/** Biểu tượng chữ "TT" trong ô đỏ. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <rect width="48" height="48" rx="8" fill="#b3121b" />
      <path d="M8 13h17v5h-5.8v18h-5.4V18H8z" fill="#fff" />
      <path d="M23 21h17v5h-5.8v13h-5.4V26H23z" fill="#fff" opacity=".85" />
      <circle cx="40" cy="12" r="3" fill="#ffd34d" />
    </svg>
  );
}

/** Logo đầy đủ: biểu tượng + tên site + domain. */
export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  if (size === "sm") {
    return (
      <span className="inline-flex items-center gap-2">
        <LogoMark size={22} />
        <span className="font-bold text-brand">{SITE_NAME}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark size={52} />
      <span className="flex flex-col leading-tight">
        <span className="text-2xl font-bold uppercase tracking-tight text-brand sm:text-3xl">{SITE_NAME}</span>
        <span className="text-xs tracking-[0.2em] text-ink-soft">{SITE_DOMAIN.toUpperCase()}</span>
      </span>
    </span>
  );
}
