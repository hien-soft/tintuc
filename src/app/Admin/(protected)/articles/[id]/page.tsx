import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { availableActions } from "@/lib/workflow/machine";
import { canViewArticle, editMode } from "@/lib/cms/queries";
import { loadEditorArticle, loadEditorOptions, toEditorArticle } from "@/lib/cms/editor-data";
import { diffArticles, type Comparable } from "@/lib/cms/diff";
import { ArticleEditor } from "@/components/cms/editor/ArticleEditor";
import { Comments } from "@/components/cms/workflow/Comments";
import { StatusTimeline } from "@/components/cms/workflow/StatusTimeline";
import { DiffView } from "@/components/cms/workflow/DiffView";
import { Card } from "@/components/cms/ui";
import { togglePinAction } from "@/app/Admin/_actions/articles";
import { articleUrl } from "@/lib/urls";

export const metadata = { title: "Soạn bài" };

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const article = await loadEditorArticle(Number(id));
  if (!article || !canViewArticle(user, article)) notFound();

  const mode = editMode(user, article);
  const actions = availableActions(article, user).map((t) => ({ action: t.action, label: t.label, tone: t.tone, requiresReason: t.requiresReason }));
  const options = await loadEditorOptions();

  // So sánh với phiên bản lần gửi duyệt trước (nếu bài được gửi lại).
  const submissions = article.statusLogs.filter((l) => l.action === "SUBMIT" || l.action === "RESUBMIT");
  let diffs = null;
  if (submissions.length >= 2 && article.status !== "DRAFT") {
    const prev = await db.articleRevision.findUnique({ where: { articleId_version: { articleId: article.id, version: submissions[1].version } } });
    if (prev) diffs = diffArticles(prev.snapshot as Comparable, article);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Link href="/Admin/articles" className="hover:text-brand">Bài viết</Link> <span>/</span>
        <span className="text-gray-800">#{article.id} · tác giả {article.author.fullName}</span>
        {article.status === "PUBLISHED" && (
          <a href={articleUrl({ ...article, primaryCat: article.primaryCat })} target="_blank" className="ml-auto text-brand hover:underline">Xem bài trên trang công khai ↗</a>
        )}
        {article.status === "PUBLISHED" && can(user, "article.pin") && (
          <form action={togglePinAction}>
            <input type="hidden" name="id" value={article.id} />
            <button className="rounded border px-2 py-1 text-xs hover:bg-gray-100">{article.isPinned ? "📌 Bỏ ghim" : "📌 Ghim đầu danh mục"}</button>
          </form>
        )}
      </div>

      <ArticleEditor
        article={toEditorArticle(article)}
        mode={mode}
        actions={actions}
        categories={options.categories}
        sources={options.sources}
        topics={options.topics}
        canSchedule={can(user, "review.l2.act")}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {diffs && (
            <Card title="Khác biệt so với lần gửi duyệt trước">
              <DiffView diffs={diffs} />
            </Card>
          )}
          <Card title="Bình luận nội bộ">
            <Comments
              articleId={article.id}
              items={article.comments.map((c) => ({ id: c.id, body: c.body, kind: c.kind, authorName: c.author.fullName, createdAt: c.createdAt.toISOString() }))}
            />
          </Card>
        </div>
        <Card title="Lịch sử trạng thái">
          <StatusTimeline
            items={article.statusLogs.map((s) => ({ id: s.id, fromStatus: s.fromStatus, toStatus: s.toStatus, action: s.action, actorName: s.actor.fullName, reason: s.reason, createdAt: s.createdAt }))}
          />
        </Card>
      </div>
    </div>
  );
}
