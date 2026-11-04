import Link from "next/link";
import { SITE_NAME } from "@/lib/config";
import { dict } from "@/lib/i18n";
import { getCategoriesOfType, getMenuCategories } from "@/lib/repo/public";
import { categoryUrl, type PublicLocale } from "@/lib/urls";
import { Clock } from "./Clock";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { mainNav, quickLinks } from "./nav";

export async function SiteHeader({ locale }: { locale: PublicLocale }) {
  const t = dict(locale);
  const [categories, photoCats] = await Promise.all([getMenuCategories(), getCategoriesOfType("PHOTO")]);
  const menu = categories.filter((c) => c.showInMenu);
  const nav = mainNav(locale, t);
  const quick = quickLinks(locale, t);
  const searchAction = `/${locale}/search`;

  return (
    <header>
      {/* Thanh trên cùng */}
      <div className="border-b border-gray-200 bg-gray-50 text-xs text-ink-soft">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5">
          <Link href={`/${locale}`} className="hidden sm:inline-flex" aria-label={SITE_NAME}>
            <Logo size="sm" />
          </Link>
          <Clock />
          <LangSwitch locale={locale} />
        </div>
      </div>

      {/* Header: logo lớn + menu 13 chủ đề */}
      <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-4 py-4">
        <Link href={`/${locale}`} aria-label={SITE_NAME} className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label={t.menu} className="hidden flex-1 lg:block">
          <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[13px] font-semibold text-ink">
            {menu.map((c) => (
              <li key={c.id}>
                <Link href={categoryUrl(c, locale)} className="hover:text-brand">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Thanh điều hướng chính */}
      <div className="bg-brand text-white">
        <div className="mx-auto flex max-w-[1200px] items-center px-2 lg:px-4">
          <MobileMenu
            openLabel={t.openMenu}
            closeLabel={t.closeMenu}
            searchAction={searchAction}
            searchPlaceholder={t.searchPlaceholder}
            groups={[
              { title: t.home, links: nav.map(({ href, label }) => ({ href, label })) },
              { title: t.menu, links: menu.map((c) => ({ href: categoryUrl(c, locale), label: c.name })) },
              { title: t.photo, links: photoCats.map((c) => ({ href: categoryUrl(c, locale), label: c.name })) },
              {
                title: t.lookup,
                links: [
                  { href: `/${locale}/tin-anh`, label: t.newsPhoto },
                  { href: `/${locale}/rss`, label: t.rss },
                  { href: searchAction, label: t.search },
                ],
              },
            ]}
          />
          <nav aria-label={t.home} className="min-w-0 flex-1">
            <ul className="hidden items-center text-sm font-bold lg:flex">
              {nav.map((item, i) => (
                <li key={item.href + item.label}>
                  <Link href={item.href} className={`block px-3 py-2.5 hover:bg-brand-dark ${i === 0 ? "pl-0 hover:bg-transparent hover:underline" : ""}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/${locale}`} className="block py-2.5 text-sm font-bold lg:hidden">
              {SITE_NAME}
            </Link>
          </nav>
          <div className="flex items-center text-sm font-bold">
            <Link href={`/${locale}/rss`} className="hidden border-l border-white/30 px-3 py-2.5 hover:bg-brand-dark sm:block">
              {t.rss}
            </Link>
            <Link href={searchAction} className="flex items-center gap-1.5 border-l border-white/30 px-3 py-2.5 hover:bg-brand-dark" aria-label={t.search}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="hidden sm:inline">{t.search}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Liên kết nhanh */}
      <div className="border-b border-gray-200 bg-white">
        <ul className="mx-auto flex max-w-[1200px] gap-x-4 overflow-x-auto whitespace-nowrap px-4 py-2 text-xs text-ink-soft [scrollbar-width:none]">
          {quick.map((q) => (
            <li key={q.href + q.label}>
              {q.external ? (
                <a href={q.href} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                  {q.label}
                </a>
              ) : (
                <Link href={q.href} className="hover:text-brand">
                  {q.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
