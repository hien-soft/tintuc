import type { Metadata } from "next";
import { StatusMessage } from "@/components/public/StatusMessage";
import { asLocale, dict } from "@/lib/i18n";
import { pageTitle } from "@/lib/seo";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = dict(asLocale((await params).locale));
  return { title: { absolute: pageTitle(t.goneTitle) }, robots: { index: false, follow: true } };
}

/** Nội dung cho phản hồi 410 (bài đã gỡ). Mã 410 do route handler đặt. */
export default async function GonePage({ params }: Params) {
  const locale = asLocale((await params).locale);
  const t = dict(locale);
  return <StatusMessage code="410" title={t.goneTitle} text={t.goneText} homeHref={`/${locale}`} homeLabel={t.backHome} />;
}
