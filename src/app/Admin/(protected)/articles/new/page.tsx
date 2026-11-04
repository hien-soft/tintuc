import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { createArticleAction } from "@/app/Admin/_actions/articles";
import { PageHeader } from "@/components/cms/ui";
import { SubmitButton } from "@/components/cms/forms";

export const metadata = { title: "Viết bài mới" };

const TYPES = [
  { value: "NEWS", label: "Tin bài", desc: "Bài chữ có ảnh, video, bảng, trích dẫn." },
  { value: "PHOTO_STORY", label: "Bộ ảnh", desc: "Gallery nhiều ảnh, mỗi ảnh có chú thích riêng." },
  { value: "GRAPHIC", label: "Đồ họa", desc: "Infographic, đồ họa dữ liệu." },
  { value: "MEGASTORY", label: "Mega Story", desc: "Bài chuyên sâu, dài." },
  { value: "EXTERNAL", label: "Bài nguồn ngoài", desc: "Dẫn link tới bài trên trang của Nguồn." },
];

export default async function NewArticlePage() {
  const user = await requireUser();
  if (!can(user, "article.create")) redirect("/Admin");
  return (
    <>
      <PageHeader title="Viết bài mới" description="Chọn loại bài để bắt đầu. Bài được lưu ở trạng thái Bản nháp." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TYPES.map((t) => (
          <form key={t.value} action={createArticleAction} className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="type" value={t.value} />
            <h2 className="text-lg font-bold">{t.label}</h2>
            <p className="mb-4 mt-1 flex-1 text-sm text-gray-500">{t.desc}</p>
            <SubmitButton>Tạo {t.label.toLowerCase()}</SubmitButton>
          </form>
        ))}
      </div>
    </>
  );
}
