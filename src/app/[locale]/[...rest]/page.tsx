import { notFound } from "next/navigation";

/** Mọi đường dẫn không khớp dưới /vi, /en → 404 trong khung trang công khai. */
export default function CatchAllNotFound() {
  notFound();
}
