"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { swapLocale } from "@/lib/i18n";
import type { PublicLocale } from "@/lib/urls";
import { LANGUAGES } from "./nav";

/**
 * VI · EN giữ nguyên trang hiện tại; các ngôn ngữ khác chưa có nên dẫn về bản tiếng Anh.
 * Đường dẫn lấy từ `window.location` sau khi mount vì trang chi tiết bài được render qua route nội bộ
 * (pathname phía server khác URL trên trình duyệt).
 */
export function LangSwitch({ locale }: { locale: PublicLocale }) {
  const pathname = usePathname();
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => setPath(window.location.pathname), [pathname]);
  return (
    <ul className="flex items-center gap-1">
      {LANGUAGES.map((l, i) => {
        const active = l.locale === locale;
        const href = l.locale ? (path ? swapLocale(path, l.locale) : `/${l.locale}`) : "/en";
        return (
          <li key={l.code} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-400" aria-hidden="true">·</span>}
            <a
              href={href}
              hrefLang={l.locale ?? "en"}
              aria-current={active ? "true" : undefined}
              className={`px-0.5 hover:text-brand ${active ? "font-bold text-brand" : ""}`}
            >
              {l.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
