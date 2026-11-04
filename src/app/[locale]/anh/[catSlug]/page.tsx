import type { Metadata } from "next";
import { CategoryPage, categoryMetadata, type CategoryRouteProps } from "@/app/_public/category";
import { asLocale, dict } from "@/lib/i18n";

type Props = CategoryRouteProps & { params: Promise<{ locale: string; catSlug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  return categoryMetadata("PHOTO", (await props.params).catSlug, props);
}

export default async function PhotoCategoryPage(props: Props) {
  const { locale, catSlug } = await props.params;
  const l = asLocale(locale);
  return <CategoryPage type="PHOTO" segment={catSlug} props={props} parent={{ label: dict(l).photo, href: `/${l}/anh` }} />;
}
