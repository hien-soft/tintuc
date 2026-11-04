import { SITE_NAME } from "@/lib/config";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-brand text-lg font-black text-white">TV</span>
            <span className="text-xl font-bold text-gray-900">{SITE_NAME}</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-widest text-gray-500">Hệ thống quản trị nội dung</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
