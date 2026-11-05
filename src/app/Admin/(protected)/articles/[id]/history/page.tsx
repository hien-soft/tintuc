import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canViewArticle, editMode } from "@/lib/cms/queries";
import { diffArticles, type Comparable } from "@/lib/cms/diff";
import { formatDateTime } from "@/lib/time";
import { btnCls, Card, PageHeader, StatusBadge } from "@/components/cms/ui";
import { DiffView } from "@/components/cms/workflow/DiffView";
import { StatusTimeline } from "@/components/cms/workflow/StatusTimeline";
import { RestoreButton } from "@/components/cms/workflow/RestoreButton";

export const metadata = { title: "Lịch sử phiên bản" };

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const article = await db.article.findUnique({ where: { id: Number(id) } });
  if (!article || !canViewArticle(user, article)) notFound();

  const [revisions, logs] = await Promise.all([
    db.articleRevision.findMany({ where: { articleId: article.id }, orderBy: { version: "desc" }, include: { editor: { select: { fullName: true } } } }),
    db.articleStatusLog.findMany({ where: { articleId: article.id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { fullName: true } } } }),
  ]);
  const canRestore = editMode(user, article) === "edit";
  const va = Number(sp.a ?? revisions[1]?.version ?? 0);
  const vb = Number(sp.b ?? revisions[0]?.version ?? 0);
  const ra = revisions.find((r) => r.version === va);
  const rb = revisions.find((r) => r.version === vb);
  const diffs = ra && rb ? diffArticles(ra.snapshot as Comparable, rb.snapshot as Comparable) : null;

  return (
    <>
      <PageHeader
        title="Lịch sử phiên bản"
        description={article.title || `Bài #${article.id}`}
        actions={<Link href={`/Admin/articles/${article.id}`} className={btnCls.default}>← Quay lại bài</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card title="So sánh hai phiên bản">
            <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
              <label className="text-sm">Phiên bản A
                <select name="a" defaultValue={va} className="ml-2 h-9 rounded-full border px-3 text-sm">{revisions.map((r) => <option key={r.id} value={r.version}>v{r.version}</option>)}</select>
              </label>
              <label className="text-sm">Phiên bản B
                <select name="b" defaultValue={vb} className="ml-2 h-9 rounded-full border px-3 text-sm">{revisions.map((r) => <option key={r.id} value={r.version}>v{r.version}</option>)}</select>
              </label>
              <button className={btnCls.default}>So sánh</button>
            </form>
            {diffs ? <DiffView diffs={diffs} /> : <p className="text-sm text-gray-500">Cần ít nhất hai phiên bản để so sánh.</p>}
          </Card>
          <Card title={`Các phiên bản (${revisions.length})`}>
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold text-[#2A3560]">
                <tr><th className="py-1">Phiên bản</th><th>Người sửa</th><th>Thời điểm</th><th>Trạng thái lúc đó</th><th>Ghi chú</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {revisions.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-semibold">v{r.version}</td>
                    <td>{r.editor.fullName}</td>
                    <td className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(r.createdAt)}</td>
                    <td><StatusBadge status={r.statusAtSave} /></td>
                    <td className="text-xs text-gray-600">{r.note}</td>
                    <td className="text-right">{canRestore && r.version !== article.version && <RestoreButton articleId={article.id} version={r.version} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <Card title="Dòng thời gian trạng thái">
          <StatusTimeline items={logs.map((s) => ({ id: s.id, fromStatus: s.fromStatus, toStatus: s.toStatus, action: s.action, actorName: s.actor.fullName, reason: s.reason, createdAt: s.createdAt }))} />
        </Card>
      </div>
    </>
  );
}
