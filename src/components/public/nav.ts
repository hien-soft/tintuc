import type { Dict } from "@/lib/i18n";
import type { PublicLocale } from "@/lib/urls";

export interface NavItem {
  href: string;
  label: string;
  external?: boolean;
}

/** Thanh điều hướng chính (mục 3.2). */
export function mainNav(locale: PublicLocale, t: Dict): NavItem[] {
  const p = `/${locale}`;
  return [
    { href: p, label: t.home },
    { href: `${p}/tin-tuc/chinh-tri-11`, label: t.politics },
    { href: `${p}/tin-tuc/xa-hoi-14`, label: t.society },
    { href: `${p}/tin-tuc/kinh-te-4`, label: t.economy },
    { href: `${p}/tin-the-gioi`, label: t.world },
    { href: `${p}/anh`, label: t.photo },
    { href: `${p}/video`, label: t.video },
    { href: `${p}/graphic`, label: t.graphic },
    { href: `${p}/megastory`, label: t.megastory },
    { href: `${p}/tin/trong-nuoc-1`, label: t.sourceInfo },
  ];
}

/** Hàng liên kết nhanh dưới thanh điều hướng. */
export function quickLinks(locale: PublicLocale, t: Dict): NavItem[] {
  const p = `/${locale}`;
  return [
    { href: `${p}/tin/trong-nuoc-1`, label: t.sourceInfo },
    { href: `${p}/trang/gioi-thieu`, label: t.operations },
    { href: "https://xembao.vn", label: "Xembao.vn", external: true },
    { href: `${p}/search`, label: t.lookup },
    { href: `${p}/tin/the-gioi-3`, label: t.news },
    { href: `${p}/tin-anh`, label: t.newsPhoto },
    { href: `${p}/anh`, label: t.photo },
  ];
}

/** Ngôn ngữ trên thanh trên cùng; chỉ vi/en là route thật. */
export const LANGUAGES: { code: string; label: string; locale?: PublicLocale }[] = [
  { code: "vi", label: "VI", locale: "vi" },
  { code: "en", label: "EN", locale: "en" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "RU" },
];
