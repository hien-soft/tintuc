import { redirect } from "next/navigation";
import type { Category } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { saveCategoryAction } from "@/app/Admin/_actions/admin";
import { Card, inputCls, PageHeader } from "@/components/cms/ui";
import { SubmitButton } from "@/components/cms/forms";
import { SortableList } from "@/components/cms/SortableList";

export const metadata = { title: "Danh mục" };

const TYPE_LABELS = { NEWS: "Chủ đề", FEED: "Tin thời sự", PHOTO: "Ảnh" } as const;

function CategoryForm({ c }: { c?: Category }) {
  return (
    <form action={saveCategoryAction} className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_90px_130px_90px_auto_auto_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="name" defaultValue={c?.name} placeholder="Tên hiển thị" required className={inputCls} aria-label="Tên" />
      <input name="slug" defaultValue={c?.slug} placeholder="slug (tự sinh)" className={inputCls} aria-label="Slug" />
      <input name="publicId" type="number" defaultValue={c?.publicId} placeholder="ID URL" required className={inputCls} aria-label="ID công khai" />
      <select name="type" defaultValue={c?.type ?? "NEWS"} className={inputCls} aria-label="Nhóm">
        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select name="footerCol" defaultValue={c?.footerCol ?? 0} className={inputCls} aria-label="Cột footer">
        <option value={0}>Footer: –</option>
        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Cột {n}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="showInMenu" defaultChecked={c?.showInMenu ?? true} /> Menu</label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} /> Hiển thị</label>
      <SubmitButton variant={c ? "default" : "primary"}>{c ? "Lưu" : "Thêm"}</SubmitButton>
    </form>
  );
}

export default async function CategoriesPage() {
  const user = await requireUser();
  if (!can(user, "taxonomy.manage")) redirect("/Admin");
  const cats = await db.category.findMany({ orderBy: { order: "asc" } });
  return (
    <>
      <PageHeader title="Danh mục" description="ID URL là số xuất hiện trên đường dẫn công khai, ví dụ /vi/tin-tuc/chinh-tri-11." />
      <Card title="Thêm danh mục" className="mb-6"><CategoryForm /></Card>
      {(["NEWS", "FEED", "PHOTO"] as const).map((type) => (
        <Card key={type} title={TYPE_LABELS[type]} className="mb-6">
          <SortableList kind="category" items={cats.filter((c) => c.type === type).map((c) => ({ id: c.id, node: <CategoryForm c={c} /> }))} />
        </Card>
      ))}
    </>
  );
}
