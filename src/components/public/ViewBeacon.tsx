"use client";

import { useEffect } from "react";

/** Ghi nhận lượt xem phía client để không ảnh hưởng cache của trang. */
export function ViewBeacon({ id }: { id: number }) {
  useEffect(() => {
    const key = `ttvn:view:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage có thể bị chặn; vẫn ghi nhận.
    }
    const url = `/api/public/view/${id}`;
    if (!navigator.sendBeacon?.(url)) {
      void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    }
  }, [id]);
  return null;
}
