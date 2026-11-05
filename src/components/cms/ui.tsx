import Link from "next/link";
import type { ArticleStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/workflow/machine";

// Ô nhập chuẩn của design system (Jobie Field): cao 44px, bo 12px, viền #CFD8EA, focus #0061FC + vòng 4px (globals.css)
export const inputCls =
  "w-full min-h-11 rounded-md border border-[#CFD8EA] bg-white px-3.5 py-2.5 text-sm font-medium text-[#0B1745] focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";
export const labelCls = "mb-1.5 block text-[13px] font-semibold text-[#2A3560]";
// Nút viên thuốc của design system (.ds-btn trong globals.css)
export const btnCls = {
  primary: "ds-btn",
  default: "ds-btn ds-btn--outline",
  danger: "ds-btn ds-btn--danger",
  accent: "ds-btn ds-btn--accent",
  ghost: "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand disabled:opacity-50",
};

export function Card({ title, actions, children, className = "" }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`ds-card--dash ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_L1: "bg-[#FFF5DF] text-[#9A6400]",
  IN_REVIEW_L1: "bg-accent-50 text-accent-strong",
  PENDING_L2: "bg-[#E6F5FF] text-[#0784E5]",
  IN_REVIEW_L2: "bg-brand-50 text-brand-700",
  RETURNED: "bg-rose-100 text-rose-800",
  SCHEDULED: "bg-[#F1EDFE] text-[#6D4AE0]",
  PUBLISHED: "bg-[#E8F7F1] text-[#12966A]",
  UNPUBLISHED: "bg-zinc-200 text-zinc-700",
  REJECTED: "bg-[#FDEDEE] text-[#DC3D43]",
  ARCHIVED: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warning"; children: React.ReactNode }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  }[kind];
  return <div className={`rounded-md border px-4 py-3 text-sm ${cls}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-end gap-2 text-sm" aria-label="Phân trang">
      {page > 1 && <Link className={`${btnCls.default} ds-btn--sm`} href={hrefFor(page - 1)}>← Trước</Link>}
      <span className="px-2 text-gray-600 tabular-nums">Trang {page}/{pages}</span>
      {page < pages && <Link className={`${btnCls.default} ds-btn--sm`} href={hrefFor(page + 1)}>Sau →</Link>}
    </nav>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-canvas/60 p-10 text-center text-sm text-gray-500">{children}</div>;
}
