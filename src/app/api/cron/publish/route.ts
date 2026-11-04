import { NextResponse, type NextRequest } from "next/server";
import { hmac, safeEqual } from "@/lib/auth/crypto";
import { runScheduledJobs } from "@/lib/workflow/jobs";

export const dynamic = "force-dynamic";

/** Gọi mỗi phút bởi `pnpm worker` (hoặc cron hạ tầng). Xác thực bằng header x-cron-key = HMAC(AUTH_SECRET, "cron"). */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-cron-key") ?? "";
  if (!safeEqual(key, hmac("cron"))) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const result = await runScheduledJobs();
  return NextResponse.json(result);
}
