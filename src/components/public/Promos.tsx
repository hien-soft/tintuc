"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isPublicAdLive, shouldShowPopup, type PublicAd } from "@/lib/ads";

/*
 * Banner 2 bên + popup quảng cáo. Tên class/URL tránh "ad"/"banner" để trình chặn quảng cáo không ẩn nhầm.
 * Chỉ render sau khi mount (lịch chạy, tần suất phụ thuộc giờ và bộ nhớ trình duyệt của người xem).
 */

const RAIL_WIDTH = 160;
const RAIL_GAP = 12;
const CONTENT_HALF = 600; // nửa max-w-[1200px] của <main>

function storageGet(store: "local" | "session", key: string): string | null {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function storageSet(store: "local" | "session", key: string, value: string) {
  try {
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // trình duyệt chặn lưu trữ — popup có thể hiện lại, chấp nhận được
  }
}

function PromoImage({ ad, src, width, className }: { ad: PublicAd; src: string; width: number; className?: string }) {
  const img = <img src={src} alt={ad.name} width={width} height={Math.round((width * ad.height) / ad.width)} className={className} loading="lazy" />;
  if (!ad.href) return img;
  return (
    <a href={ad.href} target={ad.newTab ? "_blank" : undefined} rel={ad.newTab ? "noopener sponsored" : "sponsored"} className="block">
      {img}
    </a>
  );
}

function Rail({ side, items, top }: { side: "left" | "right"; items: PublicAd[]; top: number }) {
  if (items.length === 0) return null;
  const offset = `calc(50% - ${CONTENT_HALF + RAIL_GAP + RAIL_WIDTH}px)`;
  return (
    <div
      className="fixed z-30 hidden flex-col gap-3 overflow-hidden min-[1560px]:flex"
      style={{ width: RAIL_WIDTH, top, maxHeight: `calc(100vh - ${top + 16}px)`, [side]: offset }}
    >
      {items.map((ad) => (
        <PromoImage key={ad.id} ad={ad} src={ad.thumb} width={RAIL_WIDTH} className="h-auto w-full" />
      ))}
    </div>
  );
}

export function Promos({ ads, locale, labels }: { ads: PublicAd[]; locale: string; labels: { advertisement: string; close: string } }) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  const [top, setTop] = useState(160);
  const [popup, setPopup] = useState<PublicAd | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Đồng hồ: kiểm tra lại lịch chạy mỗi phút.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Banner 2 bên bắt đầu ngang mép trên nội dung, khi cuộn thì dính sát mép trên màn hình.
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setTop(Math.max(16, Math.round(main.getBoundingClientRect().top + 20)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`;
  const visible = now ? ads.filter((a) => isPublicAdLive(a, now) && (!a.homeOnly || isHome)) : [];
  const popups = visible.filter((a) => a.position === "POPUP");
  const popupIds = popups.map((a) => a.id).join(",");

  // Chọn popup đầu tiên hợp tần suất, hiện sau 1 giây; xét lại mỗi khi chuyển trang.
  useEffect(() => {
    if (!popupIds) return;
    const candidate = popups.find((a) =>
      shouldShowPopup(a.frequency, {
        lastShownAt: storageGet("local", `ttvn_promo_d_${a.id}`) ? new Date(storageGet("local", `ttvn_promo_d_${a.id}`) as string) : null,
        shownThisSession: storageGet("session", `ttvn_promo_s_${a.id}`) === "1",
      }),
    );
    if (!candidate) return;
    const t = setTimeout(() => {
      setPopup(candidate);
      storageSet("session", `ttvn_promo_s_${candidate.id}`, "1");
      storageSet("local", `ttvn_promo_d_${candidate.id}`, new Date().toISOString());
    }, 1000);
    return () => clearTimeout(t);
    // popups suy ra từ popupIds; chỉ chạy lại khi danh sách hoặc trang đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupIds, pathname]);

  useEffect(() => {
    if (!popup) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopup(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup]);

  if (!now) return null;
  return (
    <>
      <Rail side="left" items={visible.filter((a) => a.position === "LEFT")} top={top} />
      <Rail side="right" items={visible.filter((a) => a.position === "RIGHT")} top={top} />
      {popup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setPopup(null)}>
          <div role="dialog" aria-modal="true" aria-label={popup.name} className="relative max-w-[min(600px,92vw)]" onClick={(e) => e.stopPropagation()}>
            <span className="absolute left-0 top-0 rounded-br bg-black/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">{labels.advertisement}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setPopup(null)}
              aria-label={labels.close}
              className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-xl leading-none text-ink shadow-lg hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              ×
            </button>
            <PromoImage ad={popup} src={popup.image} width={600} className="h-auto max-h-[80vh] w-auto max-w-full rounded shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}
