import { AuthShell } from "@/components/cms/AuthShell";
import { ResetPasswordForm } from "@/components/cms/AuthForms";

export const metadata = { title: "Đặt lại mật khẩu" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell title="Đặt lại mật khẩu">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
