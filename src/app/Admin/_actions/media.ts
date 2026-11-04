"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createId } from "@/lib/cms/id";
import { db } from "@/lib/db";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { requireActionUser } from "@/lib/auth/session";
import { requestMeta } from "@/lib/auth/misc";
import { can } from "@/lib/rbac/permissions";
import { writeAudit } from "@/lib/audit";
import { detectImageMime, MAX_UPLOAD_BYTES, mediaKey, storeImage } from "@/lib/storage";

export interface MediaDto {
  id: string;
  key: string;
  caption: string | null;
  alt: string | null;
  photographer: string | null;
  width: number;
  height: number;
}

const metaSchema = z.object({
  caption: z.string().trim().max(500).default(""),
  alt: z.string().trim().max(250).default(""),
  photographer: z.string().trim().max(120).default(""),
});

export async function uploadMediaAction(formData: FormData): Promise<ActionResult<MediaDto>> {
  return runAction(async () => {
    const user = await requireActionUser();
    if (!can(user, "media.manageOwn")) throw new AppError("FORBIDDEN");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("VALIDATION_ERROR", "Vui lòng chọn ảnh.");
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION_ERROR", "Ảnh vượt quá 15 MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(buf);
    if (!mime) throw new AppError("VALIDATION_ERROR", "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.");
    const meta = metaSchema.parse({ caption: formData.get("caption") ?? "", alt: formData.get("alt") ?? "", photographer: formData.get("photographer") ?? "" });

    const id = createId();
    const key = mediaKey(id);
    const { width, height } = await storeImage(key, buf);
    const media = await db.media.create({
      data: { id, key, mime: "image/webp", width, height, sizeBytes: buf.length, caption: meta.caption || null, alt: meta.alt || null, photographer: meta.photographer || null, uploadedById: user.id },
    });
    await writeAudit({ actorId: user.id, action: "MEDIA_UPLOAD", entityType: "Media", entityId: id, metadata: { originalMime: mime, size: buf.length }, ...(await requestMeta()) });
    revalidatePath("/Admin/media");
    return { id: media.id, key: media.key, caption: media.caption, alt: media.alt, photographer: media.photographer, width, height };
  });
}

export async function updateMediaAction(id: string, input: z.input<typeof metaSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const media = await db.media.findUnique({ where: { id } });
    if (!media) throw new AppError("NOT_FOUND");
    const allowed = can(user, "media.manageAll") || (can(user, "media.manageOwn") && media.uploadedById === user.id);
    if (!allowed) throw new AppError("FORBIDDEN");
    const data = metaSchema.parse(input);
    await db.media.update({ where: { id }, data: { caption: data.caption || null, alt: data.alt || null, photographer: data.photographer || null } });
    await writeAudit({ actorId: user.id, action: "MEDIA_UPDATE", entityType: "Media", entityId: id, ...(await requestMeta()) });
    revalidatePath("/Admin/media");
    return null;
  });
}
