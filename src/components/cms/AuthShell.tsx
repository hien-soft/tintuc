import { SITE_NAME } from "@/lib/config";

/** Khung trang đăng nhập CMS: nền gradient navy kiểu Admin, thẻ trắng bo 24px. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-grad-navy px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#0A9BFC]/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#F8781A]/20 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-grad-accent text-lg font-extrabold text-white shadow-accent">TV</span>
            <span className="text-2xl font-bold text-white">{SITE_NAME}</span>
          </div>
          <p className="mt-2 text-sm text-white/60">Hệ thống quản trị nội dung</p>
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-lg sm:p-8">
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
