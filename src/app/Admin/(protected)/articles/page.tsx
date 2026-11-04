import Link from "next/link";
import type { ArticleStatus, ArticleType, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { visibleArticlesWhere } from "@/lib/cms/queries";
import { STATUS_LABELS } from "@/lib/workflow/machine";
import { formatDateTime } from "@/lib/time";
import { btnCls, Card, EmptyState, inputCls, PageHeader, Pagination, StatusBadge } from "@/components/cms/ui";

export const metadata = { title: "Bài viết" };

const TYPE_LABELS: Record<ArticleType, string> = { NEWS: "Tin bài", PHOTO_STORY: "Bộ ảnh", GRAPHIC: "Đồ họa", MEGASTORY: "Mega Story", EXTERNAL: "Nguồn ngoài" };
const PER_PAGE = 25;

type SP = Record<string, string | undefined>;

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const page = Math.max(1, Number(sp.page ?? 1));

  const filters: Prisma.ArticleWhereInput[] = [visibleArticlesWhere(user)];
  if (sp.status && sp.status in STATUS_LABELS) filters.push({ status: sp.status as ArticleStatus });
  if (sp.type && sp.type in TYPE_LABELS) filters.push({ type: sp.type as ArticleType });
  if (sp.cat) filters.push({ primaryCatId: Number(sp.cat) });
  if (sp.author) filters.push({ authorId: sp.author });
  if (sp.reviewer) filters.push({ OR: [{ l1ReviewerId: sp.reviewer }, { l2ReviewerId: sp.reviewer }] });
  if (sp.from) filters.push({ updatedAt: { gte: new Date(`${sp.from}T00:00:00+07:00`) } });
  if (sp.to) filters.push({ updatedAt: { lte: new Date(`${sp.to}T23:59:59+07:00`) } });
  if (sp.q) filters.push({ title: { contains: sp.q, mode: "insensitive" } });
  if (sp.urgent === "1") filters.push({ isUrgent: true });
  if (sp.mine === "1") filters.push({ authorId: user.id });
  const where = { AND: filters };

  const [items, total, categories, people] = await Promise.all([
    db.article.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      include: { author: { select: { fullName: true } }, primaryCat: { select: { name: true } }, l1Reviewer: { select: { fullName: true } }, l2Reviewer: { select: { fullName: true } } },
    }),
    db.article.count({ where }),
    db.category.findMany({ where: { type: { in: ["NEWS", "PHOTO"] } }, orderBy: { order: "asc" } }),
    db.user.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  const holderIds = items.map((a) => a.holderId).filter((x): x is string => !!x);
  const holders = new Map(people.filter((p) => holderIds.includes(p.id)).map((p) => [p.id, p.fullName]));
  const qs = (p: number) => `/Admin/articles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Bài viết"
        description={`${total} bài${user.roles.length === 1 && user.roles[0] === "REPORTER" ? " của bạn" : ""}`}
        actions={can(user, "article.create") && <Link href="/Admin/articles/new" className={btnCls.primary}>+ Viết bài mới</Link>}
      />
      <Card className="mb-4">
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" method="get">
          <input name="q" defaultValue={sp.q} placeholder="Từ khóa trong tiêu đề" className={inputCls} />
          <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="cat" defaultValue={sp.cat ?? ""} className={inputCls}>
            <option value="">Mọi danh mục</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className={inputCls}>
            <option value="">Mọi loại bài</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="author" defaultValue={sp.author ?? ""} className={inputCls}>
            <option value="">Mọi tác giả</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
          <select name="reviewer" defaultValue={sp.reviewer ?? ""} className={inputCls}>
            <option value="">Mọi người duyệt</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
          <input type="date" name="from" defaultValue={sp.from} className={inputCls} aria-label="Từ ngày" />
          <input type="date" name="to" defaultValue={sp.to} className={inputCls} aria-label="Đến ngày" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="urgent" value="1" defaultChecked={sp.urgent === "1"} /> Chỉ tin khẩn</label>
          <div className="flex gap-2">
            <button className={btnCls.primary}>Lọc</button>
            <Link href="/Admin/articles" className={btnCls.default}>Xóa lọc</Link>
          </div>
        </form>
      </Card>

      {items.length === 0 ? (
        <EmptyState>Không có bài viết phù hợp.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Tiêu đề</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Danh mục</th>
                <th className="px-3 py-2">Tác giả</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Người giữ / duyệt</th>
                <th className="px-3 py-2">Cập nhật</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="max-w-md px-3 py-2">
                    <Link href={`/Admin/articles/${a.id}`} className="font-medium text-gray-900 hover:text-brand">
                      {a.isUrgent && <span className="mr-1 rounded bg-red-600 px-1 text-[10px] font-bold text-white">KHẨN</span>}
                      {a.isPinned && <span className="mr-1" title="Đã ghim">📌</span>}
                      {a.title || <em className="text-gray-400">(chưa có tiêu đề)</em>}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{TYPE_LABELS[a.type]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{a.primaryCat.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{a.author.fullName}</td>
                  <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                    {a.holderId ? <span className="font-semibold text-orange-700">{holders.get(a.holderId)}</span> : [a.l1Reviewer?.fullName, a.l2Reviewer?.fullName].filter(Boolean).join(" → ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{formatDateTime(a.updatedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Link href={`/Admin/articles/${a.id}`} className={btnCls.ghost}>Mở</Link>
                    <Link href={`/Admin/articles/${a.id}/history`} className={btnCls.ghost}>Lịch sử</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={qs} />
    </>
  );
}
