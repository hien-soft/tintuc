import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { auditWhere } from "@/lib/cms/audit-query";
import { toIsoVN } from "@/lib/time";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  // chống CSV injection
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.pending2fa || !can(s.user, "audit.viewArticle")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const rows = await db.auditLog.findMany({ where: auditWhere(s.user, sp), orderBy: { createdAt: "desc" }, take: 50_000 });
  const users = new Map((await db.user.findMany({ select: { id: true, email: true } })).map((u) => [u.id, u.email]));
  const header = ["time", "actor", "action", "entityType", "entityId", "metadata", "ip", "userAgent"];
  const lines = rows.map((r) => [toIsoVN(r.createdAt), r.actorId ? users.get(r.actorId) ?? r.actorId : "system", r.action, r.entityType, r.entityId, r.metadata, r.ip, r.userAgent].map(csvCell).join(","));
  const body = "﻿" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Robots-Tag": "noindex",
    },
  });
}
