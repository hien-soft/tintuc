"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/time";

/** Đồng hồ giờ Việt Nam trên thanh trên cùng, cập nhật mỗi 15 giây. */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="tabular-nums" dateTime={now?.toISOString()}>
      {now ? formatClock(now) : " "}
    </time>
  );
}
