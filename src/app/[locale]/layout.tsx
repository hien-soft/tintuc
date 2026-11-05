import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";
import { HtmlLang } from "@/components/public/HtmlLang";
import { Promos } from "@/components/public/Promos";
import { dict, isLocale } from "@/lib/i18n";
import { getActiveAds } from "@/lib/repo/public";
import { SITE_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: `%s - ${SITE_TITLE}` },
  alternates: { types: { "application/rss+xml": [{ url: "/rss/tin-moi-nhat", title: SITE_TITLE }] } },
};

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dict(locale);
  const ads = await getActiveAds();
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <HtmlLang locale={locale} />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:p-2">
        {locale === "en" ? "Skip to content" : "Bỏ qua tới nội dung"}
      </a>
      <SiteHeader locale={locale} />
      <main id="main" className="mx-auto w-full max-w-container flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <SiteFooter locale={locale} />
      {ads.length > 0 && <Promos ads={ads} locale={locale} labels={{ advertisement: t.advertisement, close: t.close }} />}
    </div>
  );
}
