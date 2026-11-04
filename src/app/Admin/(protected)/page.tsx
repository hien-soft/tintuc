import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { l1QueueWhere, l2QueueWhere } from "@/lib/cms/queries";
import { formatDate, formatDateTime, vnDay } from "@/lib/time";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/cms/ui";

export const metadata = { title: "Tổng quan" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = vnDay();
  const todayStart = new Date(today.getTime() - 7 * 3600_000); // 00:00 giờ VN
  const isWriter = can(user, "article.create");
  const seesL1 = can(user, "review.l1.view");
  const seesL2 = can(user, "review.l2.view");

  const [drafts, returned, pendingL1, pendingL2, publishedToday, scheduled] = await Promise.all([
    isWriter ? db.article.count({ where: { authorId: user.id, status: "DRAFT" } }) : null,
    isWriter ? db.article.count({ where: { authorId: user.id, status: "RETURNED" } }) : null,
    seesL1 ? db.article.count({ where: { ...l1QueueWhere(user), status: "PENDING_L1" } }) : null,
    seesL2 ? db.article.count({ where: { status: "PENDING_L2" } }) : null,
    db.article.count({ where: { status: "PUBLISHED", publishedAt: { gte: todayStart } } }),
    db.article.count({ where: { status: "SCHEDULED" } }),
  ]);

  // Việc cần làm
  const todo = await db.article.findMany({
    where: {
      OR: [
        { authorId: user.id, status: "RETURNED" },
        { holderId: user.id },
        ...(seesL1 ? [{ AND: [l1QueueWhere(user), { status: "PENDING_L1" as const }, { authorId: { not: user.id } }] }] : []),
        ...(seesL2 ? [{ AND: [l2QueueWhere(), { status: "PENDING_L2" as const }, { authorId: { not: user.id } }, { OR: [{ l1ReviewerId: null }, { l1ReviewerId: { not: user.id } }] }] }] : []),
      ],
    },
    orderBy: [{ isUrgent: "desc" }, { updatedAt: "asc" }],
    take: 10,
    include: { primaryCat: { select: { name: true } } },
  });

  // Biểu đồ 7 ngày
  const since = new Date(todayStart.getTime() - 6 * 86400_000);
  const published = await db.article.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since } }, select: { publishedAt: true } });
  const days = Array.from({ length: 7 }, (_, i) => new Date(since.getTime() + i * 86400_000));
  const counts = days.map((d) => published.filter((p) => p.publishedAt && p.publishedAt >= d && p.publishedAt < new Date(d.getTime() + 86400_000)).length);
  const max = Math.max(1, ...counts);

  const topViewed = await db.article.findMany({ where: { status: "PUBLISHED" }, orderBy: { viewCount: "desc" }, take: 8, select: { id: true, title: true, viewCount: true } });

  const stats = [
    { label: "Bài nháp của tôi", value: drafts, href: "/Admin/articles?mine=1&status=DRAFT" },
    { label: "Bài bị trả lại", value: returned, href: "/Admin/articles?mine=1&status=RETURNED", alert: !!returned },
    { label: "Chờ duyệt cấp 1", value: pendingL1, href: "/Admin/review/level-1" },
    { label: "Chờ duyệt cấp 2", value: pendingL2, href: "/Admin/review/level-2" },
    { label: "Đã đăng hôm nay", value: publishedToday, href: "/Admin/articles?status=PUBLISHED" },
    { label: "Hẹn giờ đăng", value: scheduled, href: "/Admin/articles?status=SCHEDULED" },
  ].filter((s) => s.value !== null);

  return (
    <>
      <PageHeader title={`Xin chào, ${user.fullName}`} description={`Hôm nay ${formatDate(new Date())}`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`rounded-lg border bg-white p-4 shadow-sm hover:border-brand ${s.alert ? "border-rose-300" : "border-gray-200"}`}>
            <div className={`text-3xl font-bold ${s.alert ? "text-rose-600" : "text-gray-900"}`}>{s.value}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</div>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Việc cần làm" className="xl:col-span-2">
          {todo.length === 0 ? (
            <EmptyState>Không có việc tồn đọng. 🎉</EmptyState>
          ) : (
            <ul className="divide-y">
              {todo.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                  <StatusBadge status={a.status} />
                  {a.isUrgent && <span className="rounded bg-red-600 px-1 text-[10px] font-bold text-white">KHẨN</span>}
                  <Link href={`/Admin/articles/${a.id}`} className="flex-1 text-sm font-medium hover:text-brand">{a.title || "(chưa có tiêu đề)"}</Link>
                  <span className="text-xs text-gray-500">{a.primaryCat.name} · {formatDateTime(a.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Xuất bản 7 ngày qua">
          <div className="flex h-40 items-end gap-2" role="img" aria-label={`Số bài xuất bản: ${counts.join(", ")}`}>
            {counts.map((c, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold text-gray-700">{c}</span>
                <div className="w-full rounded-t bg-brand/80" style={{ height: `${(c / max) * 110 + 2}px` }} />
                <span className="text-[10px] text-gray-500">{formatDate(days[i]).slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Bài xem nhiều" className="xl:col-span-3">
          <ol className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {topViewed.map((a, i) => (
              <li key={a.id} className="flex gap-2">
                <span className="w-5 font-bold text-brand">{i + 1}</span>
                <Link href={`/Admin/articles/${a.id}`} className="flex-1 truncate hover:text-brand">{a.title}</Link>
                <span className="text-gray-500">{a.viewCount.toLocaleString("vi-VN")}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
