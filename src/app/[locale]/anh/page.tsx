import type { Metadata } from "next";
import { ArticleCard } from "@/components/public/ArticleCard";
import { Breadcrumb, EmptyState, SectionTitle } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { getByType, getCategoriesOfType, getCategoryArticles } from "@/lib/repo/public";
import { buildMetadata } from "@/lib/seo";
import { mediaUrl } from "@/lib/storage";
import { articleUrl, categoryUrl } from "@/lib/urls";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return buildMetadata({ title: [dict(locale).photo], description: "Ảnh thời sự trong nước, quốc tế, văn hóa - xã hội.", path: `/${locale}/anh`, locale });
}

/** Trang tổng hợp ảnh: bộ ảnh mới nhất + từng danh mục ảnh. */
export default async function PhotoHubPage({ params }: Props) {
  const locale = asLocale((await params).locale);
  const t = dict(locale);
  const [latest, cats] = await Promise.all([getByType("PHOTO_STORY", 5), getCategoriesOfType("PHOTO")]);
  const blocks = await Promise.all(cats.map(async (c) => ({ cat: c, items: (await getCategoryArticles(c.id, 1, 4)).items })));
  const [hero, ...side] = latest;

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb items={[{ label: t.home, href: `/${locale}` }, { label: t.photo }]} />
        <h1 className="border-b-2 border-brand pb-2 text-2xl font-bold text-brand sm:text-3xl">{t.photo}</h1>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          {cats.map((c) => (
            <a key={c.id} href={categoryUrl(c, locale)} className="rounded-full border border-gray-300 px-3 py-1 hover:border-brand hover:text-brand">
              {c.name}
            </a>
          ))}
        </nav>
      </div>

      {!hero && <EmptyState text={t.noArticles} />}
      {hero && (
        <section className="grid gap-4 lg:grid-cols-3">
          <article className="group self-start overflow-hidden bg-black lg:col-span-2">
            <a href={articleUrl(hero, locale)} className="relative block">
              {hero.cover && <img src={mediaUrl(hero.cover.key, "large")} alt={hero.cover.alt ?? hero.title} fetchPriority="high" className="aspect-video w-full object-cover opacity-90 transition group-hover:opacity-100" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5 pt-16 text-white">
                <span className="block text-2xl font-bold leading-snug">{hero.title}</span>
                {hero.sapo && <span className="mt-1 line-clamp-2 hidden text-sm text-gray-200 sm:block">{hero.sapo}</span>}
              </span>
            </a>
          </article>
          <div className="grid grid-cols-2 gap-4">
            {side.map((a) => (
              <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
            ))}
          </div>
        </section>
      )}

      {blocks
        .filter((b) => b.items.length > 0)
        .map(({ cat, items }) => (
          <section key={cat.id}>
            <SectionTitle title={cat.name} href={categoryUrl(cat, locale)} more={t.viewAll} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {items.map((a) => (
                <ArticleCard key={a.id} article={a} locale={locale} variant="tile" />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
