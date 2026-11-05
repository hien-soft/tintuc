import { dict } from "@/lib/i18n";
import { getMostViewed, type ArticleCard as Card } from "@/lib/repo/public";
import type { PublicLocale } from "@/lib/urls";
import { ArticleCard } from "./ArticleCard";
import { SectionTitle } from "./ui";

/** Danh sách đánh số "Tin xem nhiều" (top 10 trong 3 ngày). */
export function MostViewedList({ items, locale }: { items: Card[]; locale: PublicLocale }) {
  return (
    <ol className="divide-y divide-gray-100">
      {items.map((a, i) => (
        <li key={a.id} className="flex items-start gap-3 py-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${i < 3 ? "bg-grad-primary text-white shadow-brand" : "bg-gray-100 text-gray-500"}`}>{i + 1}</span>
          <ArticleCard article={a} locale={locale} variant="list" />
        </li>
      ))}
    </ol>
  );
}

export async function MostViewed({ locale }: { locale: PublicLocale }) {
  const items = await getMostViewed(10, 3);
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle title={dict(locale).mostViewed} />
      <MostViewedList items={items} locale={locale} />
    </section>
  );
}
