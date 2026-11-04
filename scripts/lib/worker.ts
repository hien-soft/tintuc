import { createHmac } from "crypto";

/**
 * Mỗi phút gọi /api/cron/publish để chuyển SCHEDULED → PUBLISHED và nhắc bài quá hạn.
 * Gọi qua HTTP (thay vì chạy trực tiếp) để Next.js revalidate cache trang công khai.
 */
export function startWorker(siteUrl: string): NodeJS.Timeout {
  const key = createHmac("sha256", process.env.AUTH_SECRET ?? "").update("cron").digest("base64url");

  async function tick() {
    try {
      const res = await fetch(`${siteUrl}/api/cron/publish`, { method: "POST", headers: { "x-cron-key": key } });
      const data = (await res.json()) as { published?: number; reminded?: number; error?: string };
      if (!res.ok) console.error(`[worker] ${res.status} ${data.error ?? ""}`);
      else if (data.published || data.reminded) console.log(`[worker] ${new Date().toISOString()} xuất bản ${data.published}, nhắc ${data.reminded}`);
    } catch (e) {
      console.error("[worker] Không gọi được máy chủ:", (e as Error).message);
    }
  }

  console.log(`[worker] Bắt đầu, gọi ${siteUrl}/api/cron/publish mỗi 60 giây`);
  tick();
  return setInterval(tick, 60_000);
}
