import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { btnCls, Card, EmptyState, PageHeader } from "@/components/cms/ui";

export const metadata = { title: "Thông báo" };

async function markAllRead() {
  "use server";
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/Admin/notifications");
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHeader title="Thông báo" actions={<form action={markAllRead}><button className={btnCls.default}>Đánh dấu tất cả đã đọc</button></form>} />
      <Card>
        {items.length === 0 ? (
          <EmptyState>Chưa có thông báo.</EmptyState>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 py-3 ${n.readAt ? "" : "font-semibold"}`}>
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.readAt ? "bg-gray-300" : "bg-brand"}`} />
                <div className="flex-1">
                  {n.link ? <Link href={n.link} className="text-sm hover:text-brand">{n.title}</Link> : <span className="text-sm">{n.title}</span>}
                  <div className="text-xs font-normal text-gray-500">{formatDateTime(n.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
