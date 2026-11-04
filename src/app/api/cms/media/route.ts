import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

/** Danh sách media cho bộ chọn ảnh trong trình soạn thảo. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.pending2fa) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const user = s.user;
  if (!can(user, "media.manageOwn")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
  const where: Prisma.MediaWhereInput = {
    ...(can(user, "media.manageAll") ? {} : { uploadedById: user.id }),
    ...(q ? { OR: [{ caption: { contains: q, mode: "insensitive" } }, { alt: { contains: q, mode: "insensitive" } }, { photographer: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const items = await db.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 24,
    skip: (page - 1) * 24,
    select: { id: true, key: true, caption: true, alt: true, photographer: true, width: true, height: true },
  });
  return NextResponse.json({ items });
}
