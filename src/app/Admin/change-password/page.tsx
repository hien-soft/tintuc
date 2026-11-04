import { AuthShell } from "@/components/cms/AuthShell";
import { ChangePasswordForm } from "@/components/cms/AuthForms";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ changePassword: true });
  return (
    <AuthShell title="Đổi mật khẩu" subtitle={user.mustChangePassword ? "Bạn cần đổi mật khẩu trước khi sử dụng hệ thống." : undefined}>
      <ChangePasswordForm />
    </AuthShell>
  );
}
