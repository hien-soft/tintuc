import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isInternalRequest } from "@/app/_public/internal-render";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: true } };

/** Trang nội bộ chỉ phục vụ route handler chi tiết bài; truy cập trực tiếp → 404. */
export default async function InternalRenderLayout({ children }: { children: React.ReactNode }) {
  if (!(await isInternalRequest())) notFound();
  return children;
}
