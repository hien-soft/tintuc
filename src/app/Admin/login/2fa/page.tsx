import { redirect } from "next/navigation";
import { AuthShell } from "@/components/cms/AuthShell";
import { TwoFactorForm } from "@/components/cms/AuthForms";
import { getPending2faSession } from "@/lib/auth/session";

export const metadata = { title: "Xác thực 2 lớp" };

export default async function TwoFactorPage() {
  const s = await getPending2faSession();
  if (!s) redirect("/Admin/login");
  return (
    <AuthShell title="Xác thực 2 lớp" subtitle={`Tài khoản ${s.user.email}`}>
      <TwoFactorForm />
    </AuthShell>
  );
}
