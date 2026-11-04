import { redirect } from "next/navigation";
import { AuthShell } from "@/components/cms/AuthShell";
import { LoginForm } from "@/components/cms/AuthForms";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  const s = await getSession();
  if (s && !s.pending2fa) redirect("/Admin");
  return (
    <AuthShell title="Đăng nhập" subtitle="Dành cho phóng viên, biên tập viên và quản trị viên.">
      <LoginForm />
    </AuthShell>
  );
}
