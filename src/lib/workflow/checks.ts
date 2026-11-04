import type { ArticleType } from "@prisma/client";
import { countWords, imagesMissingMeta } from "@/lib/content/sanitize";

export interface ArticleForCheck {
  type: ArticleType;
  title: string;
  sapo: string | null;
  contentHtml: string | null;
  primaryCatId: number | null;
  sourceId: number | null;
  authorName: string | null;
  externalUrl: string | null;
  cover: { caption: string | null } | null;
  photoCount: number;
}

/** Kiểm tra trước khi gửi duyệt (mục 6.3.6). Trả về danh sách lỗi tiếng Việt. */
export function checkBeforeSubmit(a: ArticleForCheck): string[] {
  const errors: string[] = [];
  const title = a.title.trim();
  if (!title) errors.push("Thiếu tiêu đề.");
  else if (title.length > 150) errors.push("Tiêu đề không quá 150 ký tự.");
  const sapo = (a.sapo ?? "").trim();
  if (!sapo) errors.push("Thiếu sapo.");
  else if (sapo.length > 300) errors.push("Sapo không quá 300 ký tự.");
  if (!a.primaryCatId) errors.push("Chưa chọn danh mục chính.");
  if (!a.sourceId) errors.push("Chưa chọn nguồn.");
  if (!a.cover) errors.push("Chưa có ảnh đại diện.");
  else if (!a.cover.caption?.trim()) errors.push("Ảnh đại diện chưa có chú thích.");

  if (a.type === "EXTERNAL") {
    if (!a.externalUrl?.startsWith("https://")) errors.push("Bài nguồn ngoài cần đường dẫn https:// hợp lệ.");
    return errors;
  }
  if (!a.authorName?.trim()) errors.push("Thiếu tác giả hiển thị.");
  if (a.type === "PHOTO_STORY") {
    if (a.photoCount < 1) errors.push("Bộ ảnh cần ít nhất 1 ảnh.");
  } else if (a.type === "NEWS" || a.type === "MEGASTORY") {
    const words = countWords(a.contentHtml ?? "");
    if (words < 100) errors.push(`Nội dung cần tối thiểu 100 từ (hiện có ${words}).`);
  }
  return errors;
}

/** Kiểm tra trước khi xuất bản (mục 6.3.7) — phần không cần DB. */
export function checkBeforePublish(a: ArticleForCheck & { photosMissingCaption: number }): string[] {
  const errors = checkBeforeSubmit(a);
  const missing = imagesMissingMeta(a.contentHtml ?? "");
  if (missing > 0) errors.push(`Có ${missing} ảnh trong nội dung chưa có alt hoặc chú thích.`);
  if (a.photosMissingCaption > 0) errors.push(`Có ${a.photosMissingCaption} ảnh trong bộ ảnh chưa có chú thích.`);
  return errors;
}
