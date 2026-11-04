"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { requireActionUser, type CmsUser } from "@/lib/auth/session";
import { requestMeta } from "@/lib/auth/misc";
import { can } from "@/lib/rbac/permissions";
import { writeAudit } from "@/lib/audit";
import { adInputSchema, type AdInput } from "@/lib/ads";

async function guard(): Promise<CmsUser> {
  const user = await requireActionUser();
  if (!can(user, "ads.manage")) throw new AppError("FORBIDDEN");
  return user;
}

async function audit(user: CmsUser, action: string, id: number, metadata?: Record<string, unknown>) {
  await writeAudit({ actorId: user.id, action, entityType: "Ad", entityId: id, metadata: metadata as never, ...(await requestMeta()) });
}

function revalidate() {
  revalidatePath("/Admin/ads");
  revalidatePath("/", "layout");
}

const idSchema = z.number().int().positive();

export async function saveAdAction(id: number | null, input: AdInput): Promise<ActionResult<{ id: number }>> {
  return runAction(async () => {
    const user = await guard();
    const parsed = adInputSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Vui lòng kiểm tra lại thông tin.", parsed.error.issues.map((i) => i.message));
    const data = parsed.data;
    if (!(await db.media.findUnique({ where: { id: data.mediaId }, select: { id: true } }))) throw new AppError("VALIDATION_ERROR", "Ảnh đã chọn không còn tồn tại.");

    const row = id
      ? await db.ad.update({ where: { id: idSchema.parse(id) }, data })
      : await db.ad.create({ data: { ...data, createdById: user.id, order: await db.ad.count({ where: { position: data.position } }) } });
    await audit(user, id ? "AD_UPDATE" : "AD_CREATE", row.id, { ...data, startAt: data.startAt?.toISOString() ?? null, endAt: data.endAt?.toISOString() ?? null });
    revalidate();
    return { id: row.id };
  });
}

export async function setAdActiveAction(id: number, isActive: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guard();
    await db.ad.update({ where: { id: idSchema.parse(id) }, data: { isActive } });
    await audit(user, isActive ? "AD_ENABLE" : "AD_DISABLE", id);
    revalidate();
    return null;
  });
}

export async function deleteAdAction(id: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await guard();
    const ad = await db.ad.delete({ where: { id: idSchema.parse(id) } }).catch(() => null);
    if (!ad) throw new AppError("NOT_FOUND");
    await audit(user, "AD_DELETE", id, { name: ad.name, position: ad.position, clicks: ad.clicks });
    revalidate();
    return null;
  });
}
