"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreRevisionAction } from "@/app/Admin/_actions/articles";
import { btnCls } from "../ui";

export function RestoreButton({ articleId, version }: { articleId: number; version: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className={btnCls.ghost}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Khôi phục nội dung từ phiên bản v${version}? Một phiên bản mới sẽ được tạo.`)) return;
        start(async () => {
          const res = await restoreRevisionAction(articleId, version);
          if (!res.ok) alert(res.message);
          router.refresh();
        });
      }}
    >
      {pending ? "..." : "Khôi phục"}
    </button>
  );
}
