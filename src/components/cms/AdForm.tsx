"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdFrequency, AdPosition } from "@prisma/client";
import { deleteAdAction, saveAdAction, setAdActiveAction } from "@/app/Admin/_actions/ads";
import type { MediaDto } from "@/app/Admin/_actions/media";
import { AD_FREQUENCIES, AD_POSITIONS, FREQUENCY_LABELS, POSITION_LABELS, POSITION_SIZE_HINT } from "@/lib/ads";
import { MediaPicker, thumbUrl } from "./editor/MediaPicker";
import { Alert, btnCls, inputCls, labelCls } from "./ui";

export interface AdFormValue {
  id: number | null;
  name: string;
  position: AdPosition;
  media: Pick<MediaDto, "id" | "key" | "width" | "height"> | null;
  linkUrl: string;
  openNewTab: boolean;
  homeOnly: boolean;
  frequency: AdFrequency;
  /** Giá trị ô datetime-local, giờ Việt Nam. */
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export const EMPTY_AD: AdFormValue = {
  id: null,
  name: "",
  position: "RIGHT",
  media: null,
  linkUrl: "",
  openNewTab: true,
  homeOnly: false,
  frequency: "SESSION",
  startAt: "",
  endAt: "",
  isActive: true,
};

export function AdForm({ initial }: { initial: AdFormValue }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [picker, setPicker] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string; details?: string[] }>();
  const [pending, start] = useTransition();
  const set = <K extends keyof AdFormValue>(k: K, value: AdFormValue[K]) => setV((p) => ({ ...p, [k]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    start(async () => {
      const res = await saveAdAction(v.id, {
        name: v.name,
        position: v.position,
        mediaId: v.media?.id ?? "",
        linkUrl: v.linkUrl,
        openNewTab: v.openNewTab,
        homeOnly: v.homeOnly,
        frequency: v.frequency,
        startAt: v.startAt,
        endAt: v.endAt,
        isActive: v.isActive,
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message, details: res.details });
        return;
      }
      if (v.id) {
        setMessage({ kind: "success", text: "Đã lưu quảng cáo." });
        router.refresh();
      } else {
        setV(EMPTY_AD);
        setMessage({ kind: "success", text: "Đã thêm quảng cáo." });
        router.refresh();
      }
    });
  };

  const isPopup = v.position === "POPUP";
  return (
    <form onSubmit={submit} className="space-y-4">
      {message && (
        <Alert kind={message.kind}>
          {message.text}
          {message.details && <ul className="mt-1 list-disc pl-5">{message.details.map((d) => <li key={d}>{d}</li>)}</ul>}
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div>
          <span className={labelCls}>Ảnh quảng cáo</span>
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="grid min-h-40 w-full place-items-center overflow-hidden rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 hover:border-brand"
          >
            {v.media ? (
              <img src={thumbUrl(v.media.key, "stand")} alt="" className="max-h-72 w-full object-contain" />
            ) : (
              <span className="p-4">Bấm để chọn hoặc tải ảnh lên</span>
            )}
          </button>
          {v.media && <p className="mt-1 text-xs text-gray-500">Ảnh gốc {v.media.width}×{v.media.height}px · <button type="button" className="text-brand hover:underline" onClick={() => setPicker(true)}>Đổi ảnh</button></p>}
          <p className="mt-1 text-xs text-gray-500">Gợi ý: {POSITION_SIZE_HINT[v.position]}.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="ad-name">Tên quảng cáo (nội bộ, dùng làm mô tả ảnh)</label>
            <input id="ad-name" className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="ad-position">Vị trí</label>
            <select id="ad-position" className={inputCls} value={v.position} onChange={(e) => set("position", e.target.value as AdPosition)}>
              {AD_POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="ad-frequency">Tần suất hiện popup</label>
            <select id="ad-frequency" className={inputCls} value={v.frequency} onChange={(e) => set("frequency", e.target.value as AdFrequency)} disabled={!isPopup}>
              {AD_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="ad-link">Liên kết khi bấm (để trống nếu không cần)</label>
            <input id="ad-link" className={inputCls} value={v.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://..." inputMode="url" />
          </div>
          <div>
            <label className={labelCls} htmlFor="ad-start">Bắt đầu (để trống = ngay)</label>
            <input id="ad-start" type="datetime-local" className={inputCls} value={v.startAt} onChange={(e) => set("startAt", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ad-end">Kết thúc (để trống = không giới hạn)</label>
            <input id="ad-end" type="datetime-local" className={inputCls} value={v.endAt} onChange={(e) => set("endAt", e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm sm:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Đang bật</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.homeOnly} onChange={(e) => set("homeOnly", e.target.checked)} /> Chỉ hiện ở trang chủ</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.openNewTab} onChange={(e) => set("openNewTab", e.target.checked)} /> Mở liên kết ở tab mới</label>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnCls.primary} disabled={pending}>{pending ? "Đang lưu..." : v.id ? "Lưu thay đổi" : "Thêm quảng cáo"}</button>
        {v.id && <Link href="/Admin/ads" className={btnCls.default}>Hủy</Link>}
      </div>
      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(items) => {
          if (items[0]) set("media", items[0]);
          setPicker(false);
        }}
      />
    </form>
  );
}

/** Nút bật/tắt và xóa trên từng dòng quảng cáo. */
export function AdRowActions({ id, name, isActive }: { id: number; name: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`/Admin/ads?edit=${id}`} className={btnCls.ghost}>Sửa</Link>
      <button type="button" className={btnCls.ghost} disabled={pending} onClick={() => run(() => setAdActiveAction(id, !isActive))}>{isActive ? "Tắt" : "Bật"}</button>
      <button
        type="button"
        className={`${btnCls.ghost} text-red-700`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Xóa quảng cáo "${name}"? Thao tác không thể hoàn tác.`)) run(() => deleteAdAction(id));
        }}
      >
        Xóa
      </button>
      {error && <span className="text-xs text-red-700" role="alert">{error}</span>}
    </div>
  );
}
