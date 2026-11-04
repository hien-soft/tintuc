import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

/** 404 ngoài phạm vi /vi, /en. */
export default function RootNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-serif text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-2 text-ink-soft">Trang bạn tìm không tồn tại trên {SITE_NAME}.</p>
      <Link href="/vi" className="mt-6 inline-block rounded bg-brand px-5 py-2 text-sm font-bold text-white">
        Về trang chủ
      </Link>
    </div>
  );
}
