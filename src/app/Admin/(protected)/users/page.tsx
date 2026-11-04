import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can, ROLE_LABELS, requiresTwoFactor } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { createUserAction, forceLogoutAction, resetUserPasswordAction, toggleUserLockAction, updateUserAction } from "@/app/Admin/_actions/admin";
import { Card, inputCls, labelCls, PageHeader } from "@/components/cms/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/cms/forms";

export const metadata = { title: "Người dùng" };

const ROLES = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

export default async function UsersPage() {
  const me = await requireUser();
  if (!can(me, "user.manage")) redirect("/Admin");
  const [users, categories] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, include: { categoryScopes: true, _count: { select: { sessions: true } } } }),
    db.category.findMany({ where: { type: { in: ["NEWS", "PHOTO"] } }, orderBy: { order: "asc" } }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Người dùng & phân quyền" description="Vai trò duyệt cấp 1, cấp 2 và quản trị bắt buộc bật xác thực 2 lớp." />
      <Card title="Tạo người dùng" className="mb-6">
        <form action={createUserAction} className="grid gap-3 md:grid-cols-4">
          <div><label className={labelCls}>Họ tên</label><input name="fullName" required className={inputCls} /></div>
          <div><label className={labelCls}>Email</label><input name="email" type="email" required className={inputCls} /></div>
          <div><label className={labelCls}>Mật khẩu tạm</label><input name="password" required className={inputCls} placeholder="≥10 ký tự, hoa, thường, số" /></div>
          <div className="space-y-1">
            <span className={labelCls}>Vai trò</span>
            {ROLES.map((r) => <label key={r} className="flex items-center gap-2 text-xs"><input type="checkbox" name="roles" value={r} /> {ROLE_LABELS[r]}</label>)}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="require2fa" /> Bắt buộc 2FA</label>
          </div>
          <div className="md:col-span-4"><SubmitButton>Tạo tài khoản</SubmitButton> <span className="ml-2 text-xs text-gray-500">Người dùng phải đổi mật khẩu ở lần đăng nhập đầu.</span></div>
        </form>
      </Card>

      <div className="space-y-4">
        {users.map((u) => {
          const locked = !u.isActive || (u.lockedUntil !== null && u.lockedUntil > now);
          return (
            <Card key={u.id} title={<span className="normal-case">{u.fullName} <span className="font-normal text-gray-500">· {u.email}</span></span>}
              actions={<span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${locked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{locked ? (u.isActive ? "Tạm khóa (sai mật khẩu)" : "Đã khóa") : "Hoạt động"}</span>}>
              <form action={updateUserAction} className="grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
                <input type="hidden" name="id" value={u.id} />
                <div>
                  <label className={labelCls}>Họ tên</label>
                  <input name="fullName" defaultValue={u.fullName} className={inputCls} />
                  <p className="mt-2 text-xs text-gray-500">
                    Đăng nhập gần nhất: {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}<br />
                    2FA: {u.totpEnabled ? "đã bật" : "chưa bật"}{(u.require2fa || requiresTwoFactor(u.roles)) && " (bắt buộc)"} · {u._count.sessions} phiên
                  </p>
                </div>
                <div className="space-y-1">
                  <span className={labelCls}>Vai trò</span>
                  {ROLES.map((r) => <label key={r} className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value={r} defaultChecked={u.roles.includes(r)} /> {ROLE_LABELS[r]}</label>)}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="require2fa" defaultChecked={u.require2fa} /> Bắt buộc 2FA</label>
                </div>
                <div>
                  <span className={labelCls}>Phạm vi danh mục (áp dụng cho Duyệt cấp 1)</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs"><input type="checkbox" name="scopes" value={c.id} defaultChecked={u.categoryScopes.some((s) => s.categoryId === c.id)} /> {c.name}</label>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-3"><SubmitButton variant="default">Lưu phân quyền</SubmitButton></div>
              </form>
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                <form action={toggleUserLockAction}><input type="hidden" name="id" value={u.id} /><ConfirmSubmit message={locked ? "Mở khóa tài khoản này?" : "Khóa tài khoản này và đăng xuất mọi phiên?"} variant={locked ? "default" : "danger"}>{locked ? "Mở khóa" : "Khóa tài khoản"}</ConfirmSubmit></form>
                <form action={resetUserPasswordAction}><input type="hidden" name="id" value={u.id} /><ConfirmSubmit message="Đặt lại mật khẩu và gửi mật khẩu tạm qua email?">Reset mật khẩu</ConfirmSubmit></form>
                <form action={forceLogoutAction}><input type="hidden" name="id" value={u.id} /><ConfirmSubmit message="Buộc đăng xuất mọi phiên của người dùng này?">Buộc đăng xuất</ConfirmSubmit></form>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
