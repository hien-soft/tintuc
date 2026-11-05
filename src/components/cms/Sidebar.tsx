"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE_NAME } from "@/lib/config";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  show: boolean;
  badge?: number;
}

const ICONS: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  articles: "M4 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4zm0 4h16v2H4z",
  new: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
  review: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  review2: "M1 13.4 2.4 12l4.6 4.6L17.6 6 19 7.4 7 19.4zm10 3.2 1.4-1.4L22.6 5 24 6.4 12.4 18z",
  media: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z",
  layout: "M3 3h18v6H3zm0 8h8v10H3zm10 0h8v10h-8z",
  folder: "M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z",
  topic: "M12 2 2 7l10 5 10-5-10-5zm0 13L2 10v2l10 5 10-5v-2l-10 5zm0 4L2 14v2l10 5 10-5v-2l-10 5z",
  source: "M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z",
  ads: "M3 10v4h3l5 4V6L6 10H3zm13.5 2A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z",
  users: "M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1a4.2 4.2 0 0 1 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z",
  audit: "M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12z",
};

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/Admin" ? pathname === "/Admin" : pathname === href || (pathname.startsWith(`${href}/`) && href !== "/Admin/articles") || (href === "/Admin/articles" && pathname.startsWith("/Admin/articles") && !pathname.startsWith("/Admin/articles/new")));

  return (
    <>
      <button className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-full bg-navy text-white shadow-md lg:hidden" onClick={() => setOpen(!open)} aria-label="Mở menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
      </button>
      {/* Jobie: sidebar gradient navy, mục đang chọn là "tab" màu nền canvas khuyết vào nội dung */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 shrink-0 transform lg:w-64 xl:w-72 flex-col overflow-y-auto text-white/80 transition-transform duration-300 ease-ds lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "linear-gradient(180deg, #0B2C9F 0%, #0A1F7A 46%, #071457 100%)" }}
      >
        <div className="flex items-center gap-3 px-6 pb-5 pt-6 pl-16 lg:pl-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-grad-accent text-base font-extrabold text-white shadow-accent">TV</span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[17px] font-bold text-white">{SITE_NAME}</div>
            <span className="mt-1 inline-block rounded-full border border-[#FBC531]/35 bg-[#FBC531]/10 px-2 py-0.5 text-[10px] font-bold text-[#FFD978]">CMS tòa soạn</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 py-2 pl-5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex h-12 items-center gap-3.5 rounded-l-full pl-4 pr-5 text-sm font-semibold transition-colors ${isActive(item.href) ? "bg-canvas text-[#0061FC]" : "hover:bg-white/10 hover:text-white"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0"><path d={ICONS[item.icon]} /></svg>
              <span className="flex-1 truncate">{item.label}</span>
              {!!item.badge && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#F8781A] px-1.5 text-xs font-bold text-white">{item.badge}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-navy-950/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
