import Link from "next/link";
import { jsonLdString } from "@/lib/seo";

/** Vạch nhấn dọc 2 màu logo (cam trên · xanh dưới) đứng trước tiêu đề khối. */
export function DuoBar() {
  return <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,#FF8A3D_0%,#FF8A3D_50%,#1A5FE6_50%,#1A5FE6_100%)]" />;
}

/** Lớp chữ của tiêu đề khối (dùng chung cho SectionTitle và tiêu đề trong Tabs). */
export const sectionHeadingCls = "flex items-center gap-2.5 text-lg font-bold leading-tight text-ink sm:text-[22px]";

export function SectionTitle({ title, href, more, as: Tag = "h2" }: { title: string; href?: string; more?: string; as?: "h1" | "h2" }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {/* Tiêu đề khối: không viết HOA, vạch nhấn 2 màu logo bên trái */}
      <Tag className={sectionHeadingCls}>
        <DuoBar />
        {href ? (
          <Link href={href} className="transition-colors hover:text-brand">
            {title}
          </Link>
        ) : (
          title
        )}
      </Tag>
      {href && more && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-50">
          {more} →
        </Link>
      )}
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="text-gray-300">/</span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-brand">
                {c.label}
              </Link>
            ) : (
              <span className="font-semibold text-ink" aria-current="page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Phân trang `?page=`; `buildHref` nhận số trang và trả URL. */
export function Pagination({ page, pages, buildHref, labels }: { page: number; pages: number; buildHref: (p: number) => string; labels: { prev: string; next: string; page: string } }) {
  if (pages <= 1) return null;
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const cls = "flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold tabular-nums transition-colors";
  return (
    <nav aria-label={labels.page} className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className={`${cls} border-gray-300 hover:border-brand hover:text-brand`} rel="prev">
          ← {labels.prev}
        </Link>
      )}
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-ink-soft">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={buildHref(n)}
            aria-current={n === page ? "page" : undefined}
            aria-label={`${labels.page} ${n}`}
            className={`${cls} ${n === page ? "border-transparent bg-grad-primary text-white shadow-brand" : "border-gray-300 hover:border-brand hover:text-brand"}`}
          >
            {n}
          </Link>
        ),
      )}
      {page < pages && (
        <Link href={buildHref(page + 1)} className={`${cls} border-gray-300 hover:border-brand hover:text-brand`} rel="next">
          {labels.next} →
        </Link>
      )}
    </nav>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-container px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-ink-muted">{text}</p>;
}

/** Đọc số trang từ query, mặc định 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 1000) : 1;
}
