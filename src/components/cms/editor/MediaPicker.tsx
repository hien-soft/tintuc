"use client";

import { useEffect, useState, useTransition } from "react";
import { uploadMediaAction, type MediaDto } from "@/app/Admin/_actions/media";
import { Alert, btnCls, inputCls, labelCls } from "../ui";

export function thumbUrl(key: string, size: "thumb" | "stand" | "large" = "thumb"): string {
  return `/media/${key}/${size}.webp`;
}

export function MediaPicker({ open, onClose, onSelect, multiple = false }: { open: boolean; onClose: () => void; onSelect: (items: MediaDto[]) => void; multiple?: boolean }) {
  const [items, setItems] = useState<MediaDto[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/cms/media?q=${encodeURIComponent(q)}`);
      if (res.ok) setItems(((await res.json()) as { items: MediaDto[] }).items);
    }, 250);
    return () => clearTimeout(t);
  }, [open, q]);

  if (!open) return null;

  const toggle = (id: string) => setSelected((s) => (multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));

  const upload = (fd: FormData) =>
    startTransition(async () => {
      setError(undefined);
      const res = await uploadMediaAction(fd);
      if (!res.ok) return setError(res.message);
      setItems((list) => [res.data, ...list]);
      setSelected((s) => (multiple ? [...s, res.data.id] : [res.data.id]));
      setTab("library");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <button className={tab === "library" ? btnCls.primary : btnCls.default} onClick={() => setTab("library")}>Thư viện</button>
          <button className={tab === "upload" ? btnCls.primary : btnCls.default} onClick={() => setTab("upload")}>Tải ảnh lên</button>
          <button className="ml-auto text-2xl leading-none text-gray-500" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        {tab === "library" ? (
          <div className="flex-1 overflow-y-auto p-4">
            <input className={`${inputCls} mb-3`} placeholder="Tìm theo chú thích, alt, tác giả ảnh..." value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((m) => (
                <button key={m.id} type="button" onClick={() => toggle(m.id)} className={`overflow-hidden rounded border-2 text-left ${selected.includes(m.id) ? "border-brand" : "border-transparent"}`}>
                  <img src={thumbUrl(m.key)} alt={m.alt ?? ""} className="aspect-video w-full object-cover" />
                  <span className="line-clamp-2 block p-1 text-xs text-gray-600">{m.caption || <em className="text-red-600">Chưa có chú thích</em>}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form action={upload} className="space-y-3 p-4">
            {error && <Alert kind="error">{error}</Alert>}
            <div>
              <label className={labelCls}>Ảnh (JPG/PNG/WEBP, tối đa 15 MB)</label>
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
            </div>
            <div>
              <label className={labelCls}>Chú thích</label>
              <input name="caption" className={inputCls} placeholder="... Ảnh: Tác giả - TTVN" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Mô tả thay thế (alt)</label>
                <input name="alt" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tác giả ảnh</label>
                <input name="photographer" className={inputCls} />
              </div>
            </div>
            <button className={btnCls.primary} disabled={pending}>{pending ? "Đang tải lên..." : "Tải lên"}</button>
          </form>
        )}
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button className={btnCls.default} onClick={onClose}>Hủy</button>
          <button
            className={btnCls.primary}
            disabled={selected.length === 0}
            onClick={() => {
              onSelect(selected.map((id) => items.find((m) => m.id === id)).filter((m): m is MediaDto => !!m));
              setSelected([]);
              onClose();
            }}
          >
            Chọn {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
