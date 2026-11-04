import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { setHomeSlotAction, toggleTopicFeaturedAction } from "@/app/Admin/_actions/admin";
import { togglePinAction } from "@/app/Admin/_actions/articles";
import { btnCls, Card, inputCls, PageHeader } from "@/components/cms/ui";
import { SubmitButton } from "@/components/cms/forms";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Bố cục trang chủ" };

export default async function HomeLayoutPage() {
  const user = await requireUser();
  if (!can(user, "home.layout")) redirect("/Admin");
  const [slot, photoStories, topics, pinned, categories] = await Promise.all([
    db.homeSlot.findUnique({ where: { key: "HOME_PHOTO_HERO" } }),
    db.article.findMany({ where: { type: "PHOTO_STORY", status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 30, select: { id: true, title: true, publishedAt: true } }),
    db.topic.findMany({ orderBy: { order: "asc" } }),
    db.article.findMany({ where: { isPinned: true, status: "PUBLISHED" }, include: { primaryCat: { select: { name: true } } } }),
    db.category.findMany({ where: { type: "NEWS" }, orderBy: { order: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Bố cục trang chủ" description="Chọn bài cho các khối nổi bật. Thay đổi có hiệu lực ngay trên trang chủ." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Tiêu điểm ảnh (1 bộ ảnh lớn + 5 bộ tiếp theo)">
          <form action={setHomeSlotAction} className="space-y-3">
            <input type="hidden" name="key" value="HOME_PHOTO_HERO" />
            <label className="block text-sm text-gray-600" htmlFor="ids">ID bài theo thứ tự hiển thị (phân tách bằng dấu phẩy). Bỏ trống để tự lấy bộ ảnh mới nhất.</label>
            <input id="ids" name="articleIds" defaultValue={slot?.articleIds.join(", ")} className={inputCls} />
            <SubmitButton>Lưu khối tiêu điểm ảnh</SubmitButton>
          </form>
          <h3 className="mb-1 mt-4 text-xs font-semibold uppercase text-gray-500">Bộ ảnh đã xuất bản</h3>
          <ul className="max-h-72 overflow-y-auto text-sm">
            {photoStories.map((p) => (
              <li key={p.id} className="flex gap-2 border-b py-1">
                <code className="w-10 text-gray-500">{p.id}</code>
                <span className="flex-1">{p.title}</span>
                {slot?.articleIds.includes(p.id) && <span className="text-xs font-semibold text-emerald-700">#{slot.articleIds.indexOf(p.id) + 1}</span>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Chuyên đề nổi bật (carousel)">
          <ul className="divide-y">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">{t.name}</span>
                <form action={toggleTopicFeaturedAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className={t.isFeatured ? btnCls.primary : btnCls.default}>{t.isFeatured ? "★ Nổi bật" : "☆ Đặt nổi bật"}</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Bài ghim đầu danh mục" className="xl:col-span-2">
          <p className="mb-2 text-sm text-gray-500">Ghim bài từ màn hình soạn bài (nút “Ghim đầu danh mục”). Bài ghim được ưu tiên làm tin chính của danh mục trên trang chủ.</p>
          <table className="min-w-full text-sm">
            <tbody className="divide-y">
              {categories.map((c) => {
                const items = pinned.filter((p) => p.primaryCatId === c.id);
                return (
                  <tr key={c.id}>
                    <td className="w-48 py-2 font-medium">{c.name}</td>
                    <td className="py-2">
                      {items.length === 0 ? <span className="text-gray-400">— (lấy bài mới nhất)</span> : items.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Link href={`/Admin/articles/${p.id}`} className="hover:text-brand">📌 {p.title}</Link>
                          <span className="text-xs text-gray-500">{p.publishedAt && formatDateTime(p.publishedAt)}</span>
                          <form action={togglePinAction}><input type="hidden" name="id" value={p.id} /><button className={btnCls.ghost}>Bỏ ghim</button></form>
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
