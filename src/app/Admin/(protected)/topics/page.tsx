import { redirect } from "next/navigation";
import type { Topic } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { saveTopicAction } from "@/app/Admin/_actions/admin";
import { Card, inputCls, PageHeader } from "@/components/cms/ui";
import { SubmitButton } from "@/components/cms/forms";
import { SortableList } from "@/components/cms/SortableList";

export const metadata = { title: "Chuyên đề" };

function TopicForm({ t }: { t?: Topic }) {
  return (
    <form action={saveTopicAction} className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[80px_2fr_2fr_2fr_auto_auto_auto]">
      <input type="hidden" name="mode" value={t ? "update" : "create"} />
      <input name="id" type="number" defaultValue={t?.id} readOnly={!!t} placeholder="ID" required className={inputCls} aria-label="ID" />
      <input name="name" defaultValue={t?.name} placeholder="Tên chuyên đề" required className={inputCls} aria-label="Tên" />
      <input name="slug" defaultValue={t?.slug} placeholder="slug (tự sinh)" className={inputCls} aria-label="Slug" />
      <input name="bannerUrl" defaultValue={t?.bannerUrl ?? ""} placeholder="URL banner (tùy chọn)" className={inputCls} aria-label="Banner" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isFeatured" defaultChecked={t?.isFeatured} /> Nổi bật</label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={t?.isActive ?? true} /> Hiển thị</label>
      <SubmitButton variant={t ? "default" : "primary"}>{t ? "Lưu" : "Thêm"}</SubmitButton>
    </form>
  );
}

export default async function TopicsPage() {
  const user = await requireUser();
  if (!can(user, "taxonomy.manage")) redirect("/Admin");
  const topics = await db.topic.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { articles: true } } } });
  return (
    <>
      <PageHeader title="Chuyên đề" description="Chuyên đề nổi bật hiển thị ở carousel trang chủ." />
      <Card title="Thêm chuyên đề" className="mb-6"><TopicForm /></Card>
      <Card title={`Danh sách (${topics.length})`}>
        <SortableList kind="topic" items={topics.map((t) => ({ id: t.id, node: <div><TopicForm t={t} /><p className="mt-1 text-xs text-gray-500">{t._count.articles} bài</p></div> }))} />
      </Card>
    </>
  );
}
