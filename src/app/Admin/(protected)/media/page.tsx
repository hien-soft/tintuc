import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { toMediaDto } from "@/lib/cms/editor-data";
import { MediaLibrary } from "@/components/cms/MediaLibrary";
import { btnCls, inputCls, PageHeader, Pagination } from "@/components/cms/ui";

export const metadata = { title: "Thư viện media" };
const PER_PAGE = 30;

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireUser();
  if (!can(user, "media.manageOwn")) redirect("/Admin");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: Prisma.MediaWhereInput = {
    ...(can(user, "media.manageAll") ? {} : { uploadedById: user.id }),
    ...(sp.q ? { OR: [{ caption: { contains: sp.q, mode: "insensitive" } }, { alt: { contains: sp.q, mode: "insensitive" } }, { photographer: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([db.media.findMany({ where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (page - 1) * PER_PAGE }), db.media.count({ where })]);
  const uploaders = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.uploadedById))] } }, select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]));
  return (
    <>
      <PageHeader title="Thư viện media" description={`${total} ảnh. Ảnh tải lên được tự sinh các cỡ 320 / 960 / 1920 px định dạng WEBP, đã xóa EXIF.`} />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Tìm theo chú thích, alt, tác giả ảnh" className={inputCls} />
        <button className={btnCls.default}>Tìm</button>
        {sp.q && <Link href="/Admin/media" className={btnCls.ghost}>Xóa</Link>}
      </form>
      <MediaLibrary items={rows.map((m) => ({ ...toMediaDto(m), uploader: uploaders.get(m.uploadedById) ?? "" }))} />
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/Admin/media?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </>
  );
}
