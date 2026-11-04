import type { Metadata } from "next";
import { CategoryPage, categoryMetadata, type CategoryRouteProps } from "@/app/_public/category";

type Props = CategoryRouteProps & { params: Promise<{ locale: string; catSlug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  return categoryMetadata("NEWS", (await props.params).catSlug, props);
}

export default async function NewsCategoryPage(props: Props) {
  return <CategoryPage type="NEWS" segment={(await props.params).catSlug} props={props} />;
}
