import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac/permissions";
import { formatDateTime } from "@/lib/time";
import { logoutAllAction, updateEmailNotifyAction } from "@/app/Admin/_actions/auth";
import { ChangePasswordForm, Disable2faForm } from "@/components/cms/AuthForms";
import { btnCls, Card, PageHeader } from "@/components/cms/ui";
import { SubmitButton } from "@/components/cms/forms";

export const metadata = { title: "Hồ sơ cá nhân" };

export default async function ProfilePage() {
  const user = await requireUser();
  const [row, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, include: { categoryScopes: { include: { category: true } } } }),
    db.session.findMany({ where: { userId: user.id, pending2fa: false }, orderBy: { lastActiveAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Hồ sơ cá nhân" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Thông tin tài khoản">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Họ tên</dt><dd className="font-semibold">{row.fullName}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd>{row.email}</dd></div>
            <div><dt className="text-gray-500">Vai trò</dt><dd>{row.roles.map((r) => ROLE_LABELS[r]).join(", ")}</dd></div>
            {row.categoryScopes.length > 0 && <div><dt className="text-gray-500">Phạm vi duyệt</dt><dd>{row.categoryScopes.map((s) => s.category.name).join(", ")}</dd></div>}
            <div><dt className="text-gray-500">Đăng nhập gần nhất</dt><dd>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "—"}</dd></div>
          </dl>
          <form action={updateEmailNotifyAction} className="mt-4 flex items-center gap-3 border-t pt-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="emailNotify" defaultChecked={row.emailNotify} /> Nhận thông báo qua email</label>
            <SubmitButton variant="default">Lưu</SubmitButton>
          </form>
        </Card>
        <Card title="Đổi mật khẩu">
          <ChangePasswordForm />
        </Card>
        <Card title="Xác thực 2 lớp (2FA)">
          {row.totpEnabled ? (
            <div className="space-y-3 text-sm">
              <p className="text-emerald-700">✔ Đã bật. Còn {row.backupCodes.length} mã dự phòng.</p>
              {user.require2fa ? <p className="text-gray-500">Vai trò của bạn bắt buộc bật 2FA nên không thể tắt.</p> : <Disable2faForm />}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Chưa bật xác thực 2 lớp.</p>
              <Link href="/Admin/setup-2fa" className={btnCls.primary}>Bật 2FA</Link>
            </div>
          )}
        </Card>
        <Card title={`Phiên đăng nhập (${sessions.length})`}>
          <ul className="mb-4 space-y-2 text-xs text-gray-600">
            {sessions.map((s) => (
              <li key={s.id} className="rounded bg-gray-50 p-2">
                <div className="font-medium text-gray-800">{s.ip ?? "?"} — hoạt động {formatDateTime(s.lastActiveAt)}</div>
                <div className="truncate">{s.userAgent}</div>
              </li>
            ))}
          </ul>
          <form action={logoutAllAction}><SubmitButton variant="danger">Đăng xuất mọi thiết bị</SubmitButton></form>
        </Card>
      </div>
    </>
  );
}
