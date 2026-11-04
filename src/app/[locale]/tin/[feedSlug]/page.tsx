import type { Metadata } from "next";
import { CategoryPage, categoryMetadata, type CategoryRouteProps } from "@/app/_public/category";

type Props = CategoryRouteProps & { params: Promise<{ locale: string; feedSlug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  return categoryMetadata("FEED", (await props.params).feedSlug, props);
}

/** Nhóm tin thời sự (Trong nước, Thế giới, Kinh tế Việt Nam, Kinh tế Thế giới). */
export default async function FeedPage(props: Props) {
  return <CategoryPage type="FEED" segment={(await props.params).feedSlug} props={props} />;
}
