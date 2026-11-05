import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumb } from "@/components/public/ui";
import { db } from "@/lib/db";
import { asLocale, dict } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

const loadPage = cache((slug: string) => (/^[a-z0-9-]{1,100}$/.test(slug) ? db.staticPage.findUnique({ where: { slug } }) : null));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const page = await loadPage(slug);
  if (!page) return {};
  const locale = asLocale(l);
  return buildMetadata({ title: [page.title], path: `/${locale}/trang/${page.slug}`, locale });
}

/** Trang tĩnh (Điều khoản sử dụng, Liên hệ, Giới thiệu...). Nội dung HTML do CMS quản lý và đã sanitize. */
export default async function StaticPageView({ params }: Props) {
  const { locale: l, slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();
  const locale = asLocale(l);
  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: dict(locale).home, href: `/${locale}` }, { label: page.title }]} />
      <h1 className="mb-5 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{page.title}</h1>
      <div className="article-body" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
    </article>
  );
}
