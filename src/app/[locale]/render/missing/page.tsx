import { notFound } from "next/navigation";

/** Dùng bởi route handler chi tiết bài khi không tìm thấy bài → giao diện 404. */
export default function MissingPage() {
  notFound();
}
