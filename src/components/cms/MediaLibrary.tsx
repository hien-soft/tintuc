"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMediaAction, uploadMediaAction, type MediaDto } from "@/app/Admin/_actions/media";
import { Alert, btnCls, inputCls, labelCls } from "./ui";

function MediaCard({ m }: { m: MediaDto & { uploader: string } }) {
  const [caption, setCaption] = useState(m.caption ?? "");
  const [alt, setAlt] = useState(m.alt ?? "");
  const [photographer, setPhotographer] = useState(m.photographer ?? "");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="ds-card--dash overflow-hidden">
      <img src={`/media/${m.key}/thumb.webp`} alt={m.alt ?? ""} className="aspect-video w-full object-cover" loading="lazy" />
      <div className="space-y-1 p-2 text-xs">
        <textarea className={`${inputCls} text-xs`} rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Chú thích" aria-label="Chú thích" />
        <input className={`${inputCls} text-xs`} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt" aria-label="Alt" />
        <input className={`${inputCls} text-xs`} value={photographer} onChange={(e) => setPhotographer(e.target.value)} placeholder="Tác giả ảnh" aria-label="Tác giả ảnh" />
        <div className="flex items-center justify-between pt-1">
          <span className="text-gray-400">{m.width}×{m.height} · {m.uploader}</span>
          <button
            className={btnCls.ghost}
            disabled={pending}
            onClick={() => start(async () => {
              const res = await updateMediaAction(m.id, { caption, alt, photographer });
              setMsg(res.ok ? "Đã lưu" : res.message);
            })}
          >
            {pending ? "..." : "Lưu"}
          </button>
        </div>
        {msg && <p className="text-emerald-700">{msg}</p>}
      </div>
    </div>
  );
}

export function MediaLibrary({ items }: { items: (MediaDto & { uploader: string })[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <form
        action={(fd) => start(async () => {
          const res = await uploadMediaAction(fd);
          if (!res.ok) return setError(res.message);
          setError(undefined);
          router.refresh();
        })}
        className="grid items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_3fr_2fr_2fr_auto]"
      >
        <div><label className={labelCls}>Ảnh (JPG/PNG/WEBP ≤ 15 MB)</label><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" /></div>
        <div><label className={labelCls}>Chú thích</label><input name="caption" className={inputCls} placeholder="... Ảnh: Tác giả - TTVN" /></div>
        <div><label className={labelCls}>Alt</label><input name="alt" className={inputCls} /></div>
        <div><label className={labelCls}>Tác giả ảnh</label><input name="photographer" className={inputCls} /></div>
        <button className={btnCls.primary} disabled={pending}>{pending ? "Đang tải..." : "Tải lên"}</button>
        {error && <div className="md:col-span-5"><Alert kind="error">{error}</Alert></div>}
      </form>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {items.map((m) => <MediaCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}
