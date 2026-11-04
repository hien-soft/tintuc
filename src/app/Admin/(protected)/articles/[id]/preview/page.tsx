import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canViewArticle } from "@/lib/cms/queries";
import { articleDetailInclude } from "@/lib/repo/public";
import { ArticleView } from "@/components/public/article/ArticleView";
import { PhotoStoryView } from "@/components/public/photo/PhotoStoryView";
import { btnCls } from "@/components/cms/ui";

export const metadata = { title: "Xem trước" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const article = await db.article.findUnique({ where: { id: Number(id) }, include: articleDetailInclude });
  if (!article || !canViewArticle(user, article)) notFound();

  return (
    <div className="-m-4 lg:-m-6">
      <div className="flex items-center justify-between border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <span>Bản xem trước — giao diện trang công khai. Bài chưa chắc đã được xuất bản.</span>
        <Link href={`/Admin/articles/${article.id}`} className={btnCls.default}>← Quay lại soạn thảo</Link>
      </div>
      <div className="bg-white">
        {article.type === "PHOTO_STORY" ? <PhotoStoryView article={article} preview locale="vi" /> : <ArticleView article={article} preview locale="vi" />}
      </div>
    </div>
  );
}
