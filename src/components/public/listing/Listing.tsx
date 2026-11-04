import { dict } from "@/lib/i18n";
import type { ArticleCard as Card } from "@/lib/repo/public";
import type { PublicLocale } from "@/lib/urls";
import { ArticleCard } from "../ArticleCard";
import { MostViewed } from "../MostViewed";
import { Breadcrumb, EmptyState, Pagination, type Crumb } from "../ui";

interface Props {
  locale: PublicLocale;
  title: string;
  crumbs: Crumb[];
  items: Card[];
  page: number;
  pages: number;
  /** Đường dẫn gốc để dựng `?page=`; có thể kèm query sẵn. */
  basePath: string;
  /** Trang 1: 1 bài nổi bật + 4 bài lưới trước danh sách. */
  featured?: boolean;
  /** Hiển thị dạng lưới ảnh (bộ ảnh, đồ họa). */
  grid?: boolean;
  intro?: React.ReactNode;
  showSidebar?: boolean;
}

export function pageHref(basePath: string, p: number): string {
  if (p <= 1) return basePath;
  return `${basePath}${basePath.includes("?") ? "&" : "?"}page=${p}`;
}

/** Bố cục chung cho trang danh mục / danh sách bài. */
export function Listing({ locale, title, crumbs, items, page, pages, basePath, featured = true, grid = false, intro, showSidebar = true }: Props) {
  const t = dict(locale);
  const showFeatured = featured && page === 1 && items.length >= 5 && !grid;
  const lead = showFeatured ? items[0] : null;
  const tiles = showFeatured ? items.slice(1, 5) : [];
  const list = showFeatured ? items.slice(5) : items;

  return (
    <div className={showSidebar ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}>
      <div className="min-w-0">
        <Breadcrumb items={crumbs} />
        <h1 className="mb-4 border-b-2 border-brand pb-2 text-2xl font-bold text-brand sm:text-3xl">{title}</h1>
        {intro}
        {items.length === 0 && <EmptyState text={t.noArticles} />}

        {lead && (
          <div className="mb-6 grid gap-5 border-b border-gray-200 pb-6 md:grid-cols-2">
            <ArticleCard article={lead} locale={locale} variant="lead" eager showSapo className="[&_h3]:text-2xl" />
            <div className="grid grid-cols-2 gap-4">
              {tiles.map((a) => (
                <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
              ))}
            </div>
          </div>
        )}

        {grid ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">
            {list.map((a, i) => (
              <ArticleCard key={a.id} article={a} locale={locale} variant="tile" eager={i < 3 && page === 1} />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((a) => (
              <li key={a.id} className="py-4 first:pt-0">
                <ArticleCard article={a} locale={locale} variant="row" />
              </li>
            ))}
          </ul>
        )}

        <Pagination page={page} pages={pages} buildHref={(p) => pageHref(basePath, p)} labels={{ prev: t.prev, next: t.next, page: t.page }} />
      </div>
      {showSidebar && (
        <aside className="space-y-8">
          <MostViewed locale={locale} />
        </aside>
      )}
    </div>
  );
}
