import { AuthShell } from "@/components/cms/AuthShell";
import { ForgotPasswordForm } from "@/components/cms/AuthForms";

export const metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Quên mật khẩu" subtitle="Nhập email để nhận liên kết đặt lại mật khẩu.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
