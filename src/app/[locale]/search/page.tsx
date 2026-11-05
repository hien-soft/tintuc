import type { Metadata } from "next";
import { ArticleCard } from "@/components/public/ArticleCard";
import { MostViewed } from "@/components/public/MostViewed";
import { Breadcrumb, EmptyState, Pagination, parsePage } from "@/components/public/ui";
import { db } from "@/lib/db";
import { asLocale, dict } from "@/lib/i18n";
import { getMenuCategories, searchArticles } from "@/lib/repo/public";
import { buildMetadata } from "@/lib/seo";

type SP = { q?: string | string[]; source?: string | string[]; category?: string | string[]; from?: string | string[]; to?: string | string[]; page?: string | string[] };
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SP> };

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** `yyyy-mm-dd` theo giờ Việt Nam → Date (đầu hoặc cuối ngày). */
function parseDay(value: string, end: boolean): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const q = one((await searchParams).q).slice(0, 200);
  const t = dict(locale);
  return buildMetadata({ title: [q ? `${t.search}: ${q}` : t.search], path: `/${locale}/search`, locale, noindex: true });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  const t = dict(locale);
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 200);
  const source = one(sp.source).slice(0, 100);
  const categoryParam = one(sp.category);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = parsePage(sp.page);

  const [categories, sources] = await Promise.all([getMenuCategories(), db.source.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } })]);
  const category = categories.find((c) => String(c.publicId) === categoryParam);
  const hasQuery = !!(q || source || category || from || to);
  const result = hasQuery
    ? await searchArticles({ q: q || undefined, source: source || undefined, category: category?.id, from: parseDay(from, false), to: parseDay(to, true), page })
    : null;

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (source) query.set("source", source);
  if (category) query.set("category", String(category.publicId));
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const base = `/${locale}/search${query.size ? `?${query.toString()}` : ""}`;
  const sourceName = sources.find((s) => s.slug === source)?.name;
  const input = "h-11 w-full rounded-md border border-[#CFD8EA] bg-white px-3.5 text-sm";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <Breadcrumb items={[{ label: t.home, href: `/${locale}` }, { label: t.search }]} />
        <h1 className="mb-4 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{t.search}</h1>
        <form action={`/${locale}/search`} method="get" className="mb-8 grid gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <label className="sm:col-span-2 lg:col-span-4">
            <span className="sr-only">{t.search}</span>
            <input name="q" type="search" defaultValue={q} placeholder={t.searchPlaceholder} className={`${input} h-[52px] rounded-full px-5 text-base`} />
          </label>
          <label className="text-[13px] font-semibold text-[#2A3560]">
            {t.category}
            <select name="category" defaultValue={category ? String(category.publicId) : ""} className={`${input} mt-1.5`}>
              <option value="">{t.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.publicId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-semibold text-[#2A3560]">
            {t.source}
            <select name="source" defaultValue={source} className={`${input} mt-1.5`}>
              <option value="">{t.allSources}</option>
              {sources.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-semibold text-[#2A3560]">
            {t.from}
            <input name="from" type="date" defaultValue={from} className={`${input} mt-1.5`} />
          </label>
          <label className="text-[13px] font-semibold text-[#2A3560]">
            {t.to}
            <input name="to" type="date" defaultValue={to} className={`${input} mt-1.5`} />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="ds-btn">
              {t.submit}
            </button>
          </div>
        </form>

        {result && (
          <>
            <p className="mb-4 text-sm text-ink-soft">
              <strong className="text-ink">{result.total}</strong> {t.results}
              {q && (
                <>
                  {" "}
                  — “<strong className="text-ink">{q}</strong>”
                </>
              )}
              {sourceName && (
                <>
                  {" "}
                  · {t.source}: <strong className="text-ink">{sourceName}</strong>
                </>
              )}
            </p>
            {result.items.length === 0 ? (
              <EmptyState text={t.noResults} />
            ) : (
              <ul className="divide-y divide-gray-100">
                {result.items.map((a) => (
                  <li key={a.id} className="py-4 first:pt-0">
                    <ArticleCard article={a} locale={locale} variant="row" />
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              page={result.page}
              pages={result.pages}
              buildHref={(p) => (p <= 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${p}`)}
              labels={{ prev: t.prev, next: t.next, page: t.page }}
            />
          </>
        )}
      </div>
      <aside className="space-y-8">
        <MostViewed locale={locale} />
      </aside>
    </div>
  );
}
