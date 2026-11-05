import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { auditWhere, type AuditFilters } from "@/lib/cms/audit-query";
import { btnCls, Card, inputCls, PageHeader, Pagination } from "@/components/cms/ui";

export const metadata = { title: "Nhật ký hệ thống" };
const PER_PAGE = 50;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<AuditFilters & { page?: string }> }) {
  const user = await requireUser();
  if (!can(user, "audit.viewArticle")) redirect("/Admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = auditWhere(user, sp);
  const [rows, total, users] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (page - 1) * PER_PAGE }),
    db.auditLog.count({ where }),
    db.user.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  const params = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  return (
    <>
      <PageHeader
        title="Nhật ký hệ thống"
        description={can(user, "audit.viewAll") ? "Toàn bộ thao tác (chỉ đọc)." : "Nhật ký thao tác trên bài viết (chỉ đọc)."}
        actions={<a href={`/api/cms/audit-log/export?${params}`} className={btnCls.default}>⬇ Xuất CSV</a>}
      />
      <Card className="mb-4">
        <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7" method="get">
          <select name="actor" defaultValue={sp.actor ?? ""} className={inputCls} aria-label="Người thực hiện">
            <option value="">Mọi người</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          <input name="action" defaultValue={sp.action} placeholder="Hành động (VD LOGIN)" className={inputCls} />
          <input name="entityType" defaultValue={sp.entityType} placeholder="Đối tượng (Article, User...)" className={inputCls} />
          <input name="entityId" defaultValue={sp.entityId} placeholder="ID đối tượng" className={inputCls} />
          <input type="date" name="from" defaultValue={sp.from} className={inputCls} aria-label="Từ ngày" />
          <input type="date" name="to" defaultValue={sp.to} className={inputCls} aria-label="Đến ngày" />
          <div className="flex gap-2"><button className={btnCls.primary}>Lọc</button><Link href="/Admin/audit-log" className={btnCls.default}>Xóa</Link></div>
        </form>
      </Card>
      <div className="ds-card--dash overflow-x-auto">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-canvas text-left text-xs font-semibold text-[#2A3560]">
            <tr><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Người thực hiện</th><th className="px-4 py-3">Hành động</th><th className="px-4 py-3">Đối tượng</th><th className="px-4 py-3">Chi tiết</th><th className="px-4 py-3">IP</th></tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{formatDateTime(r.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.actorId ? names.get(r.actorId) ?? r.actorId : <em className="text-gray-400">Hệ thống</em>}</td>
                <td className="whitespace-nowrap px-3 py-2"><code className="rounded bg-gray-100 px-1 text-xs">{r.action}</code></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {r.entityType === "Article" && r.entityId ? <Link className="text-brand hover:underline" href={`/Admin/articles/${r.entityId}`}>Article #{r.entityId}</Link> : `${r.entityType}${r.entityId ? ` #${r.entityId.slice(0, 12)}` : ""}`}
                </td>
                <td className="max-w-sm truncate px-3 py-2 text-xs text-gray-600" title={r.metadata ? JSON.stringify(r.metadata) : ""}>{r.metadata ? JSON.stringify(r.metadata) : ""}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/Admin/audit-log?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) })}`} />
    </>
  );
}
