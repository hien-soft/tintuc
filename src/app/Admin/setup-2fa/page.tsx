import { redirect } from "next/navigation";
import { AuthShell } from "@/components/cms/AuthShell";
import { Setup2faForm } from "@/components/cms/AuthForms";
import { requireUser } from "@/lib/auth/session";
import { begin2faSetup } from "@/app/Admin/_actions/auth";
import { totpQrDataUrl } from "@/lib/auth/totp";

export const metadata = { title: "Thiết lập xác thực 2 lớp" };
export const dynamic = "force-dynamic";

export default async function Setup2faPage() {
  const user = await requireUser({ setup2fa: true });
  if (user.totpEnabled) redirect("/Admin/profile");
  const secret = await begin2faSetup();
  const qr = await totpQrDataUrl(user.email, secret);
  return (
    <AuthShell
      title="Thiết lập xác thực 2 lớp"
      subtitle={user.require2fa ? "Vai trò của bạn bắt buộc bật xác thực 2 lớp trước khi vào hệ thống." : undefined}
    >
      <Setup2faForm qr={qr} secret={secret} />
    </AuthShell>
  );
}
