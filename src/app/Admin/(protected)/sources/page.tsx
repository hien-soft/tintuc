import { redirect } from "next/navigation";
import type { Partner, Source } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { savePartnerAction, saveSourceAction } from "@/app/Admin/_actions/admin";
import { Card, inputCls, PageHeader } from "@/components/cms/ui";
import { SubmitButton } from "@/components/cms/forms";
import { SortableList } from "@/components/cms/SortableList";

export const metadata = { title: "Nguồn & đối tác" };

function SourceForm({ s }: { s?: Source }) {
  return (
    <form action={saveSourceAction} className="grid items-end gap-2 sm:grid-cols-[2fr_2fr_3fr_auto]">
      {s && <input type="hidden" name="id" value={s.id} />}
      <input name="name" defaultValue={s?.name} placeholder="Tên nguồn" required className={inputCls} aria-label="Tên nguồn" />
      <input name="slug" defaultValue={s?.slug} placeholder="slug" className={inputCls} aria-label="Slug" />
      <input name="homepage" defaultValue={s?.homepage ?? ""} placeholder="https://... (domain cho phép bài nguồn ngoài)" className={inputCls} aria-label="Trang chủ" />
      <SubmitButton variant={s ? "default" : "primary"}>{s ? "Lưu" : "Thêm"}</SubmitButton>
    </form>
  );
}

function PartnerForm({ p }: { p?: Partner }) {
  return (
    <form action={savePartnerAction} className="grid items-end gap-2 sm:grid-cols-[60px_2fr_3fr_3fr_auto_auto]">
      {p && <input type="hidden" name="id" value={p.id} />}
      {p ? <img src={p.logoUrl} alt={p.name} className="h-8 w-14 rounded border object-contain" /> : <span />}
      <input name="name" defaultValue={p?.name} placeholder="Tên đối tác" required className={inputCls} aria-label="Tên đối tác" />
      <input name="logoUrl" defaultValue={p?.logoUrl} placeholder="URL logo" required className={inputCls} aria-label="Logo" />
      <input name="url" defaultValue={p?.url} placeholder="https://..." required className={inputCls} aria-label="Liên kết" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> Hiển thị</label>
      <SubmitButton variant={p ? "default" : "primary"}>{p ? "Lưu" : "Thêm"}</SubmitButton>
    </form>
  );
}

export default async function SourcesPage() {
  const user = await requireUser();
  if (!can(user, "taxonomy.manage")) redirect("/Admin");
  const [sources, partners] = await Promise.all([db.source.findMany({ orderBy: { id: "asc" } }), db.partner.findMany({ orderBy: { order: "asc" } })]);
  return (
    <>
      <PageHeader title="Nguồn tin & đối tác" />
      <Card title="Nguồn tin" className="mb-6">
        <div className="space-y-2">
          {sources.map((s) => <SourceForm key={s.id} s={s} />)}
          <div className="border-t pt-3"><SourceForm /></div>
        </div>
      </Card>
      <Card title="Đối tác (dải logo cuối trang)">
        <SortableList kind="partner" items={partners.map((p) => ({ id: p.id, node: <PartnerForm p={p} /> }))} />
        <div className="mt-3 border-t pt-3"><PartnerForm /></div>
      </Card>
    </>
  );
}
