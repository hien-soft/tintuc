import Link from "next/link";
import { SITE_NAME } from "@/lib/config";
import { dict } from "@/lib/i18n";
import { getMenuCategories, getPartners } from "@/lib/repo/public";
import { categoryUrl, type PublicLocale } from "@/lib/urls";
import { BackToTop } from "./BackToTop";
import { Logo } from "./Logo";

export async function SiteFooter({ locale }: { locale: PublicLocale }) {
  const t = dict(locale);
  const [partners, categories] = await Promise.all([getPartners(), getMenuCategories()]);
  const columns = [1, 2, 3, 4].map((col) => categories.filter((c) => c.footerCol === col)).filter((col) => col.length > 0);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10">
      {partners.length > 0 && (
        <section aria-label={t.partners} className="border-t border-gray-200 bg-gray-50">
          <ul className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-3 px-4 py-4">
            {partners.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer sponsored" title={p.name} className="block rounded border border-gray-200 bg-white p-1 opacity-80 transition hover:opacity-100">
                  <img src={p.logoUrl} alt={p.name} loading="lazy" className="h-10 w-auto max-w-[140px] object-contain" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t-4 border-brand bg-[#1b1d21] text-gray-300">
        {columns.length > 0 && (
          <nav aria-label={t.menu} className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-4 px-4 py-8 sm:grid-cols-4">
            {columns.map((col, i) => (
              <ul key={i} className="space-y-2 text-sm">
                {col.map((c) => (
                  <li key={c.id}>
                    <Link href={categoryUrl(c, locale)} className="hover:text-white">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </nav>
        )}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2 text-xs leading-relaxed text-gray-400">
              <div className="rounded bg-white px-3 py-2 sm:inline-block">
                <Logo />
              </div>
              <p>
                © {year} {SITE_NAME}. {t.copyright}
              </p>
              <p>{t.address}</p>
              <p>{t.license}</p>
            </div>
            <ul className="flex shrink-0 flex-wrap items-center gap-x-2 text-sm">
              <li>
                <Link href={`/${locale}`} className="hover:text-white">
                  {t.home}
                </Link>
              </li>
              <li aria-hidden="true">|</li>
              <li>
                <Link href={`/${locale}/trang/dieu-khoan-su-dung`} className="hover:text-white">
                  {t.terms}
                </Link>
              </li>
              <li aria-hidden="true">|</li>
              <li>
                <Link href={`/${locale}/trang/lien-he`} className="hover:text-white">
                  {t.contact}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <BackToTop label={t.backToTop} />
    </footer>
  );
}
