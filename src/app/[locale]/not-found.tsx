import type { Metadata } from "next";
import { headers } from "next/headers";
import { StatusMessage } from "@/components/public/StatusMessage";
import { asLocale, dict } from "@/lib/i18n";
import { pageTitle } from "@/lib/seo";

export const metadata: Metadata = { title: { absolute: pageTitle("404") }, robots: { index: false, follow: true } };

export default async function LocaleNotFound() {
  const locale = asLocale((await headers()).get("x-locale") ?? "vi");
  const t = dict(locale);
  return <StatusMessage code="404" title={t.notFoundTitle} text={t.notFoundText} homeHref={`/${locale}`} homeLabel={t.backHome} />;
}
