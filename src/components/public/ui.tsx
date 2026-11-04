import Link from "next/link";
import { jsonLdString } from "@/lib/seo";

export function SectionTitle({ title, href, more, as: Tag = "h2" }: { title: string; href?: string; more?: string; as?: "h1" | "h2" }) {
  return (
    <div className="mb-3 flex items-end justify-between border-b-2 border-brand">
      <Tag className="-mb-0.5 border-b-2 border-brand bg-brand px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">
        {href ? <Link href={href}>{title}</Link> : title}
      </Tag>
      {href && more && (
        <Link href={href} className="pb-1 text-xs font-semibold text-ink-soft hover:text-brand">
          {more} ›
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
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-ink-soft">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">›</span>}
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
  const cls = "flex h-9 min-w-9 items-center justify-center rounded border px-2 text-sm";
  return (
    <nav aria-label={labels.page} className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className={`${cls} border-gray-300 hover:border-brand hover:text-brand`} rel="prev">
          ‹ {labels.prev}
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
            className={`${cls} ${n === page ? "border-brand bg-brand font-bold text-white" : "border-gray-300 hover:border-brand hover:text-brand"}`}
          >
            {n}
          </Link>
        ),
      )}
      {page < pages && (
        <Link href={buildHref(page + 1)} className={`${cls} border-gray-300 hover:border-brand hover:text-brand`} rel="next">
          {labels.next} ›
        </Link>
      )}
    </nav>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 ${className}`}>{children}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-ink-soft">{text}</p>;
}

/** Đọc số trang từ query, mặc định 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 1000) : 1;
}
