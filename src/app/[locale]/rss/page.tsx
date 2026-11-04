import type { Metadata } from "next";
import { Breadcrumb } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { getCategoriesOfType } from "@/lib/repo/public";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return buildMetadata({ title: [dict(locale).rssFeeds], description: "Danh sách kênh RSS theo chuyên mục.", path: `/${locale}/rss`, locale });
}

export default async function RssListPage({ params }: Props) {
  const locale = asLocale((await params).locale);
  const t = dict(locale);
  const [news, feeds, photos] = await Promise.all([getCategoriesOfType("NEWS"), getCategoriesOfType("FEED"), getCategoriesOfType("PHOTO")]);
  const rows = [{ name: t.latest, path: "/rss/tin-moi-nhat" }, ...[...news, ...feeds, ...photos].map((c) => ({ name: c.name, path: `/rss/${c.slug}-${c.publicId}` }))];

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: t.home, href: `/${locale}` }, { label: t.rss }]} />
      <h1 className="mb-3 border-b-2 border-brand pb-2 text-2xl font-bold text-brand sm:text-3xl">{t.rssFeeds}</h1>
      <p className="mb-5 text-sm text-ink-soft">{t.rssIntro}</p>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200">
        {rows.map((r) => (
          <li key={r.path} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">{r.name}</span>
            <a href={r.path} className="inline-flex items-center gap-2 break-all text-sm text-brand hover:underline">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                <rect width="24" height="24" rx="4" fill="#f26522" />
                <circle cx="6.5" cy="17.5" r="2" fill="#fff" />
                <path d="M4.5 10.5a9 9 0 0 1 9 9M4.5 4.5a15 15 0 0 1 15 15" stroke="#fff" strokeWidth="2.5" fill="none" />
              </svg>
              {absoluteUrl(r.path)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
