import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/public/ui";
import { asLocale, dict } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return buildMetadata({ title: [dict(locale).video], path: `/${locale}/video`, locale });
}

export default async function VideoPage({ params }: Props) {
  const locale = asLocale((await params).locale);
  const t = dict(locale);
  return (
    <div>
      <Breadcrumb items={[{ label: t.home, href: `/${locale}` }, { label: t.video }]} />
      <h1 className="mb-5 border-b-2 border-brand pb-2 text-2xl font-bold text-brand sm:text-3xl">{t.video}</h1>
      <div className="flex flex-col items-center gap-4 rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-16 text-center">
        <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="#b3121b" />
          <path d="M10 8l6 4-6 4z" fill="#fff" />
        </svg>
        <p className="text-ink-soft">{t.updating}</p>
        <Link href={`/${locale}/anh`} className="text-sm font-semibold text-brand hover:underline">
          {t.photo} ›
        </Link>
      </div>
    </div>
  );
}
