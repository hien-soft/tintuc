"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction } from "@/app/Admin/_actions/articles";
import { Alert, btnCls, inputCls } from "../ui";

export interface CommentItem {
  id: string;
  body: string;
  kind: string;
  authorName: string;
  createdAt: string;
}

const KIND_LABELS: Record<string, { label: string; cls: string }> = {
  RETURN_REASON: { label: "Lý do trả lại", cls: "border-rose-200 bg-rose-50" },
  REJECT_REASON: { label: "Lý do từ chối", cls: "border-red-300 bg-red-50" },
  UNPUBLISH_REASON: { label: "Lý do gỡ bài", cls: "border-zinc-300 bg-zinc-50" },
  CORRECTION: { label: "Đính chính", cls: "border-amber-200 bg-amber-50" },
};

export function Comments({ articleId, items }: { articleId: number; items: CommentItem[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-gray-500">Chưa có bình luận.</p>}
      <ul className="space-y-2">
        {items.map((c) => {
          const kind = KIND_LABELS[c.kind];
          return (
            <li key={c.id} className={`rounded-md border p-3 text-sm ${kind?.cls ?? "border-gray-200 bg-white"}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <strong className="text-gray-800">{c.authorName}</strong>
                {kind && <span className="rounded bg-white/70 px-1.5 py-0.5 font-semibold text-gray-700">{kind.label}</span>}
                <span>{new Date(c.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          );
        })}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addCommentAction(articleId, body);
            if (!res.ok) return setError(res.message);
            setBody("");
            setError(undefined);
            router.refresh();
          });
        }}
      >
        {error && <Alert kind="error">{error}</Alert>}
        <textarea className={inputCls} rows={3} placeholder="Viết bình luận nội bộ..." value={body} onChange={(e) => setBody(e.target.value)} />
        <button className={btnCls.default} disabled={pending || !body.trim()}>{pending ? "Đang gửi..." : "Gửi bình luận"}</button>
      </form>
    </div>
  );
}
