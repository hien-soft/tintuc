"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Item {
  id: string;
  title: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Chuông thông báo — cập nhật mỗi 30 giây. */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/cms/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; items: Item[] };
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      // mạng chập chờn — thử lại ở lần sau
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => {
      clearInterval(t);
      document.removeEventListener("click", onClick);
    };
  }, []);

  async function markAll() {
    await fetch("/api/cms/notifications", { method: "POST" });
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100" onClick={() => setOpen(!open)} aria-label={`Thông báo (${unread} chưa đọc)`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-4.5-5.8V4a1.5 1.5 0 0 0-3 0v1.2A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Thông báo</span>
            <button className="text-xs text-brand hover:underline" onClick={markAll}>Đánh dấu đã đọc</button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-center text-sm text-gray-500">Không có thông báo.</li>}
            {items.map((n) => (
              <li key={n.id} className={`border-b last:border-0 ${n.readAt ? "" : "bg-brand-light/50"}`}>
                <Link href={n.link ?? "/Admin/notifications"} className="block px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>
                  <span className="line-clamp-2 text-gray-800">{n.title}</span>
                  <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/Admin/notifications" className="block border-t px-3 py-2 text-center text-sm text-brand hover:bg-gray-50" onClick={() => setOpen(false)}>Xem tất cả</Link>
        </div>
      )}
    </div>
  );
}
