import Link from "next/link";
import type { ArticleStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/workflow/machine";

export const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-gray-100";
export const labelCls = "mb-1 block text-sm font-medium text-gray-700";
export const btnCls = {
  primary: "inline-flex items-center justify-center gap-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50",
  default: "inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-1 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50",
  ghost: "inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100",
};

export function Card({ title, actions, children, className = "" }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_COLORS: Record<ArticleStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_L1: "bg-amber-100 text-amber-800",
  IN_REVIEW_L1: "bg-orange-100 text-orange-800",
  PENDING_L2: "bg-sky-100 text-sky-800",
  IN_REVIEW_L2: "bg-indigo-100 text-indigo-800",
  RETURNED: "bg-rose-100 text-rose-800",
  SCHEDULED: "bg-violet-100 text-violet-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  UNPUBLISHED: "bg-zinc-200 text-zinc-700",
  REJECTED: "bg-red-100 text-red-800",
  ARCHIVED: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warning"; children: React.ReactNode }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  }[kind];
  return <div className={`rounded-md border px-3 py-2 text-sm ${cls}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-end gap-2 text-sm" aria-label="Phân trang">
      {page > 1 && <Link className={btnCls.default} href={hrefFor(page - 1)}>‹ Trước</Link>}
      <span className="text-gray-600">Trang {page}/{pages}</span>
      {page < pages && <Link className={btnCls.default} href={hrefFor(page + 1)}>Sau ›</Link>}
    </nav>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">{children}</div>;
}
