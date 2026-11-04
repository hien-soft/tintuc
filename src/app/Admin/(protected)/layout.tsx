import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { Sidebar, type NavItem } from "@/components/cms/Sidebar";
import { NotificationBell } from "@/components/cms/NotificationBell";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import { logoutAction } from "@/app/Admin/_actions/auth";
import { l1QueueWhere } from "@/lib/cms/queries";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [l1Count, l2Count, unread] = await Promise.all([
    can(user, "review.l1.view") ? db.article.count({ where: l1QueueWhere(user) }) : 0,
    can(user, "review.l2.view") ? db.article.count({ where: { status: { in: ["PENDING_L2", "IN_REVIEW_L2"] } } }) : 0,
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const items: NavItem[] = [
    { href: "/Admin", label: "Tổng quan", icon: "dashboard", show: true },
    { href: "/Admin/articles", label: "Bài viết", icon: "articles", show: can(user, "article.create") || can(user, "audit.viewAll") },
    { href: "/Admin/articles/new", label: "Viết bài mới", icon: "new", show: can(user, "article.create") },
    { href: "/Admin/review/level-1", label: "Duyệt cấp 1", icon: "review", show: can(user, "review.l1.view"), badge: l1Count },
    { href: "/Admin/review/level-2", label: "Duyệt cấp 2", icon: "review2", show: can(user, "review.l2.view"), badge: l2Count },
    { href: "/Admin/media", label: "Thư viện media", icon: "media", show: can(user, "media.manageOwn") },
    { href: "/Admin/home-layout", label: "Bố cục trang chủ", icon: "layout", show: can(user, "home.layout") },
    { href: "/Admin/categories", label: "Danh mục", icon: "folder", show: can(user, "taxonomy.manage") },
    { href: "/Admin/topics", label: "Chuyên đề", icon: "topic", show: can(user, "taxonomy.manage") },
    { href: "/Admin/sources", label: "Nguồn & đối tác", icon: "source", show: can(user, "taxonomy.manage") },
    { href: "/Admin/ads", label: "Quảng cáo", icon: "ads", show: can(user, "ads.manage") },
    { href: "/Admin/users", label: "Người dùng", icon: "users", show: can(user, "user.manage") },
    { href: "/Admin/audit-log", label: "Nhật ký hệ thống", icon: "audit", show: can(user, "audit.viewArticle") },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items.filter((i) => i.show)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:px-6">
          <a href="/vi" target="_blank" className="mr-auto hidden text-sm text-gray-500 hover:text-brand sm:block">Xem trang công khai ↗</a>
          <NotificationBell initialUnread={unread} />
          <Link href="/Admin/profile" className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">{user.fullName.split(" ").pop()?.[0]}</span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-semibold text-gray-800">{user.fullName}</span>
              <span className="block text-xs text-gray-500">{user.roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
            </span>
          </Link>
          <form action={logoutAction}>
            <button className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" type="submit">Đăng xuất</button>
          </form>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
