import type { ArticleCard as Card } from "@/lib/repo/public";
import type { PublicLocale } from "@/lib/urls";
import { ArticleCard } from "../ArticleCard";

/** Băng tin chạy 5 tin mới nhất; dừng khi hover (CSS `.ticker`). */
export function Ticker({ items, locale, label }: { items: Card[]; locale: PublicLocale; label: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={label} className="ticker mb-6 flex items-center gap-2 overflow-hidden rounded-full border border-gray-200 bg-white p-1.5 text-sm">
      <h2 className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-50 px-3.5 text-xs font-bold text-accent-strong">
        <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        {label}
      </h2>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="ticker-track flex w-max items-center whitespace-nowrap py-2">
          {/* Nhân đôi danh sách để chạy liền mạch; bản thứ hai ẩn với trình đọc màn hình. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center" aria-hidden={copy === 1 ? true : undefined}>
              {items.map((a) => (
                <ArticleCard key={`${copy}-${a.id}`} article={a} locale={locale} variant="ticker" className="px-6" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
