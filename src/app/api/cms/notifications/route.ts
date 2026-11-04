import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || s.pending2fa) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId: s.user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: s.user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return NextResponse.json({ unread, items }, { headers: { "X-Robots-Tag": "noindex" } });
}

export async function POST() {
  const s = await getSession();
  if (!s || s.pending2fa) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await db.notification.updateMany({ where: { userId: s.user.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
