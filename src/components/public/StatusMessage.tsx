import Link from "next/link";

/** Thông báo trạng thái (404 / 410) trong khung trang công khai. */
export function StatusMessage({ code, title, text, homeHref, homeLabel }: { code: string; title: string; text: string; homeHref: string; homeLabel: string }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-6xl font-bold text-brand">{code}</p>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-ink-soft">{text}</p>
      <Link href={homeHref} className="mt-6 ds-btn">
        {homeLabel}
      </Link>
    </div>
  );
}
