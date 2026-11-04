"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { acquireLockAction, heartbeatLockAction, releaseLockAction, saveArticleAction, transitionAction, type SaveArticleInput } from "@/app/Admin/_actions/articles";
import type { MediaDto } from "@/app/Admin/_actions/media";
import { STATUS_LABELS } from "@/lib/workflow/machine";
import { RichEditor } from "./RichEditor";
import { MediaPicker, thumbUrl } from "./MediaPicker";
import { Alert, btnCls, inputCls, labelCls, StatusBadge } from "../ui";
import type { ActionButton, EditorArticle, Option } from "./types";

const TYPE_LABELS = { NEWS: "Tin bài", PHOTO_STORY: "Bộ ảnh", GRAPHIC: "Đồ họa", MEGASTORY: "Mega Story", EXTERNAL: "Bài nguồn ngoài" } as const;
const AUTOSAVE_MS = 30_000;
const HEARTBEAT_MS = 60_000;

interface Props {
  article: EditorArticle;
  mode: "edit" | "correct" | "readonly";
  actions: ActionButton[];
  categories: Option[];
  sources: Option[];
  topics: Option[];
  canSchedule: boolean;
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={`text-xs ${value.length > max ? "font-semibold text-red-600" : "text-gray-400"}`}>{value.length}/{max}</span>;
}

export function ArticleEditor({ article, mode: initialMode, actions, categories, sources, topics, canSchedule }: Props) {
  const router = useRouter();
  const [a, setA] = useState(article);
  const [version, setVersion] = useState(article.version);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success" | "warning"; text: string; details?: string[] }>();
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [coverPicker, setCoverPicker] = useState(false);
  const [photoPicker, setPhotoPicker] = useState(false);
  const [dialog, setDialog] = useState<ActionButton | null>(null);
  const [reason, setReason] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [pending, startTransition] = useTransition();
  const contentJson = useRef<JSONContent | undefined>(undefined);
  const dragIndex = useRef<number | null>(null);

  const mode = lockedBy ? "readonly" : initialMode;
  const readOnly = mode === "readonly";

  // Khóa biên tập + heartbeat
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await acquireLockAction(article.id);
      if (alive && res.ok) setLockedBy(res.data.heldByOther);
    })();
    const t = setInterval(async () => {
      if (initialMode === "readonly") return;
      const res = await heartbeatLockAction(article.id);
      if (res.ok && !res.data) setLockedBy("người khác");
    }, HEARTBEAT_MS);
    return () => {
      alive = false;
      clearInterval(t);
      if (initialMode !== "readonly") releaseLockAction(article.id).catch(() => undefined);
    };
  }, [article.id, initialMode]);

  // Cảnh báo khi rời trang chưa lưu
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = <K extends keyof EditorArticle>(key: K, value: EditorArticle[K]) => {
    setA((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const buildInput = useCallback(
    (note?: string): SaveArticleInput => ({
      type: a.type,
      title: a.title,
      sapo: a.sapo,
      contentHtml: a.contentHtml,
      contentJson: contentJson.current ? JSON.stringify(contentJson.current) : undefined,
      primaryCatId: a.primaryCatId,
      categoryIds: a.categoryIds,
      sourceId: a.sourceId,
      authorName: a.authorName,
      coverMediaId: a.cover?.id ?? null,
      tags: a.tags,
      topicIds: a.topicIds,
      slug: a.slug,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      isUrgent: a.isUrgent,
      externalUrl: a.externalUrl,
      photos: a.photos.map((p) => ({ mediaId: p.media.id, caption: p.caption, takenAt: p.takenAt })),
      correctionNote: note,
    }),
    [a],
  );

  const save = useCallback(
    async (opts: { silent?: boolean; note?: string } = {}): Promise<number | null> => {
      const res = await saveArticleAction(a.id, buildInput(opts.note), version);
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message, details: res.details });
        return null;
      }
      setVersion(res.data.version);
      setA((prev) => ({ ...prev, slug: res.data.slug }));
      setDirty(false);
      setSavedAt(new Date());
      if (!opts.silent) setMessage({ kind: "success", text: opts.note ? "Đã lưu đính chính." : "Đã lưu." });
      return res.data.version;
    },
    [a.id, buildInput, version],
  );

  // Tự lưu nháp mỗi 30 giây
  useEffect(() => {
    if (mode !== "edit" || !dirty) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        await save({ silent: true });
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, mode, save]);

  const runTransition = (btn: ActionButton) =>
    startTransition(async () => {
      setMessage(undefined);
      let v = version;
      if (dirty && mode === "edit") {
        const saved = await save({ silent: true });
        if (saved === null) return;
        v = saved;
      }
      const res = await transitionAction({ id: a.id, action: btn.action, expectedVersion: v, reason: reason || undefined, scheduledAt: btn.action === "SCHEDULE" ? scheduleAt : undefined });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.message, details: res.details });
        return;
      }
      setDialog(null);
      setReason("");
      setDirty(false);
      setMessage({ kind: "success", text: `Đã thực hiện: ${btn.label}.` });
      router.refresh();
    });

  const onActionClick = (btn: ActionButton) => {
    if (btn.requiresReason || btn.action === "SCHEDULE" || btn.tone === "danger") {
      setDialog(btn);
      return;
    }
    runTransition(btn);
  };

  // Đồng bộ lại khi server trả dữ liệu mới (sau router.refresh)
  useEffect(() => {
    setA(article);
    setVersion(article.version);
    setDirty(false);
  }, [article]);

  const isExternal = a.type === "EXTERNAL";
  const isPhoto = a.type === "PHOTO_STORY";
  const categoryGroups = categories.reduce<Record<string, Option[]>>((acc, c) => {
    (acc[c.group ?? ""] ??= []).push(c);
    return acc;
  }, {});

  const movePhoto = (from: number, to: number) => {
    if (from === to) return;
    const list = [...a.photos];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    update("photos", list);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {/* Cột trái: nội dung */}
      <div className="min-w-0 space-y-4">
        {lockedBy && <Alert kind="warning">Đang được <strong>{lockedBy}</strong> chỉnh sửa. Bạn đang xem ở chế độ chỉ đọc.</Alert>}
        {!lockedBy && initialMode === "readonly" && <Alert kind="info">Bài ở trạng thái “{STATUS_LABELS[a.status]}” — bạn chỉ có quyền xem.</Alert>}
        {mode === "correct" && <Alert kind="warning">Bài đã xuất bản. Mọi thay đổi sẽ được lưu dưới dạng <strong>đính chính</strong> và hiển thị ghi chú cuối bài.</Alert>}
        {message && (
          <Alert kind={message.kind}>
            {message.text}
            {message.details && <ul className="mt-1 list-disc pl-5">{message.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </Alert>
        )}

        <div>
          <div className="flex items-center justify-between"><label className={labelCls} htmlFor="title">Tiêu đề</label><Counter value={a.title} max={150} /></div>
          <input id="title" className={`${inputCls} text-xl font-bold`} value={a.title} onChange={(e) => update("title", e.target.value)} disabled={readOnly} placeholder="Nhập tiêu đề bài viết" />
        </div>
        <div>
          <div className="flex items-center justify-between"><label className={labelCls} htmlFor="sapo">Sapo</label><Counter value={a.sapo} max={300} /></div>
          <textarea id="sapo" className={`${inputCls} font-semibold`} rows={3} value={a.sapo} onChange={(e) => update("sapo", e.target.value)} disabled={readOnly} />
        </div>

        {isExternal ? (
          <div>
            <label className={labelCls} htmlFor="externalUrl">Đường dẫn bài gốc (https://, thuộc domain của Nguồn)</label>
            <input id="externalUrl" className={inputCls} value={a.externalUrl} onChange={(e) => update("externalUrl", e.target.value)} disabled={readOnly} placeholder="https://..." />
          </div>
        ) : (
          <div>
            <span className={labelCls}>Nội dung</span>
            <RichEditor
              html={a.contentHtml}
              readOnly={readOnly}
              onChange={(html, json) => {
                contentJson.current = json;
                update("contentHtml", html);
              }}
            />
          </div>
        )}

        {isPhoto && (
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Ảnh trong bộ ảnh ({a.photos.length}) — kéo thả để sắp xếp</span>
              {!readOnly && <button type="button" className={btnCls.default} onClick={() => setPhotoPicker(true)}>+ Thêm ảnh</button>}
            </div>
            <ol className="space-y-2">
              {a.photos.map((p, i) => (
                <li
                  key={`${p.media.id}-${i}`}
                  draggable={!readOnly}
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current !== null) movePhoto(dragIndex.current, i);
                    dragIndex.current = null;
                  }}
                  className="flex gap-3 rounded border border-gray-200 bg-gray-50 p-2"
                >
                  <span className="cursor-move select-none self-center text-gray-400" aria-hidden>⋮⋮</span>
                  <img src={thumbUrl(p.media.key)} alt={p.media.alt ?? ""} className="h-16 w-28 flex-none rounded object-cover" />
                  <textarea
                    className={`${inputCls} text-xs`}
                    rows={2}
                    value={p.caption}
                    disabled={readOnly}
                    placeholder="Chú thích ... Ảnh: Tác giả - TTVN"
                    onChange={(e) => update("photos", a.photos.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                  />
                  {!readOnly && (
                    <div className="flex flex-col gap-1">
                      <button type="button" className={btnCls.ghost} onClick={() => movePhoto(i, Math.max(0, i - 1))} aria-label="Lên">↑</button>
                      <button type="button" className={btnCls.ghost} onClick={() => movePhoto(i, Math.min(a.photos.length - 1, i + 1))} aria-label="Xuống">↓</button>
                      <button type="button" className={`${btnCls.ghost} text-red-600`} onClick={() => update("photos", a.photos.filter((_, j) => j !== i))} aria-label="Xóa">×</button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Cột phải: trạng thái & thuộc tính */}
      <aside className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <StatusBadge status={a.status} />
            <span className="text-xs text-gray-500">Phiên bản {version}{savedAt ? ` · lưu lúc ${savedAt.toLocaleTimeString("vi-VN")}` : ""}{dirty ? " · chưa lưu" : ""}</span>
          </div>
          {a.scheduledAt && a.status === "SCHEDULED" && <p className="mb-3 text-sm text-violet-700">Hẹn đăng: {new Date(a.scheduledAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>}
          <div className="flex flex-col gap-2">
            {mode === "edit" && (
              <button type="button" className={btnCls.default} disabled={pending || !dirty} onClick={() => startTransition(async () => { await save(); })}>
                💾 Lưu nháp
              </button>
            )}
            {mode === "correct" && (
              <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-2">
                <label className={labelCls} htmlFor="correctionNote">Ghi chú đính chính (bắt buộc)</label>
                <textarea id="correctionNote" className={inputCls} rows={2} value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} />
                <button type="button" className={btnCls.primary} disabled={pending} onClick={() => startTransition(async () => { const v = await save({ note: correctionNote }); if (v) { setCorrectionNote(""); router.refresh(); } })}>
                  Lưu đính chính
                </button>
              </div>
            )}
            {actions.filter((b) => b.action !== "CORRECT").map((b) => (
              <button key={b.action} type="button" className={btnCls[b.tone]} disabled={pending || !!lockedBy} onClick={() => onActionClick(b)}>
                {b.label}
              </button>
            ))}
            <a href={`/Admin/articles/${a.id}/preview`} target="_blank" className={btnCls.default}>👁 Xem trước</a>
            <a href={`/Admin/articles/${a.id}/history`} className={btnCls.ghost}>Lịch sử phiên bản →</a>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm"><span className="text-gray-500">Loại bài:</span> <strong>{TYPE_LABELS[a.type]}</strong></div>
          <div>
            <label className={labelCls} htmlFor="primaryCat">Danh mục chính</label>
            <select id="primaryCat" className={inputCls} value={a.primaryCatId} disabled={readOnly} onChange={(e) => update("primaryCatId", Number(e.target.value))}>
              {Object.entries(categoryGroups).map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Danh mục phụ ({a.categoryIds.length})</summary>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {categories.filter((c) => c.id !== a.primaryCatId).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={readOnly} checked={a.categoryIds.includes(c.id)} onChange={(e) => update("categoryIds", e.target.checked ? [...a.categoryIds, c.id] : a.categoryIds.filter((x) => x !== c.id))} />
                  {c.name} <span className="text-xs text-gray-400">{c.group}</span>
                </label>
              ))}
            </div>
          </details>
          <div>
            <label className={labelCls} htmlFor="source">Nguồn</label>
            <select id="source" className={inputCls} value={a.sourceId} disabled={readOnly} onChange={(e) => update("sourceId", Number(e.target.value))}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {!isExternal && (
            <div>
              <label className={labelCls} htmlFor="authorName">Tác giả hiển thị</label>
              <input id="authorName" className={inputCls} value={a.authorName} disabled={readOnly} onChange={(e) => update("authorName", e.target.value)} />
            </div>
          )}
          <div>
            <span className={labelCls}>Ảnh đại diện</span>
            {a.cover ? (
              <div className="space-y-1">
                <img src={thumbUrl(a.cover.key, "stand")} alt={a.cover.alt ?? ""} className="aspect-video w-full rounded object-cover" />
                <p className={`text-xs ${a.cover.caption ? "text-gray-600" : "font-semibold text-red-600"}`}>{a.cover.caption || "Ảnh chưa có chú thích — cập nhật trong Thư viện media."}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Chưa chọn ảnh.</p>
            )}
            {!readOnly && <button type="button" className={`${btnCls.default} mt-2 w-full`} onClick={() => setCoverPicker(true)}>{a.cover ? "Đổi ảnh" : "Chọn ảnh"}</button>}
          </div>
          <div>
            <label className={labelCls} htmlFor="tags">Tags (phân tách bằng dấu phẩy)</label>
            <input id="tags" className={inputCls} defaultValue={a.tags.join(", ")} disabled={readOnly} onBlur={(e) => update("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
          </div>
          {topics.length > 0 && (
            <div>
              <span className={labelCls}>Chuyên đề</span>
              {topics.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={readOnly} checked={a.topicIds.includes(t.id)} onChange={(e) => update("topicIds", e.target.checked ? [...a.topicIds, t.id] : a.topicIds.filter((x) => x !== t.id))} />
                  {t.name}
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-red-700">
            <input type="checkbox" disabled={readOnly} checked={a.isUrgent} onChange={(e) => update("isUrgent", e.target.checked)} /> Tin khẩn
          </label>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">SEO & đường dẫn</summary>
            <div className="mt-2 space-y-2">
              <div>
                <label className={labelCls} htmlFor="slug">Slug</label>
                <input id="slug" className={inputCls} value={a.slug} disabled={readOnly} onChange={(e) => update("slug", e.target.value)} placeholder="Tự sinh từ tiêu đề" />
              </div>
              <div>
                <label className={labelCls} htmlFor="seoTitle">SEO title</label>
                <input id="seoTitle" className={inputCls} value={a.seoTitle} disabled={readOnly} onChange={(e) => update("seoTitle", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="seoDescription">SEO description</label>
                <textarea id="seoDescription" className={inputCls} rows={2} value={a.seoDescription} disabled={readOnly} onChange={(e) => update("seoDescription", e.target.value)} />
              </div>
            </div>
          </details>
        </div>
      </aside>

      <MediaPicker open={coverPicker} onClose={() => setCoverPicker(false)} onSelect={(items: MediaDto[]) => items[0] && update("cover", items[0])} />
      <MediaPicker
        open={photoPicker}
        multiple
        onClose={() => setPhotoPicker(false)}
        onSelect={(items: MediaDto[]) => update("photos", [...a.photos, ...items.map((m) => ({ media: m, caption: m.caption ?? "", takenAt: null }))])}
      />

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold">{dialog.label}</h3>
            {dialog.action === "SCHEDULE" && (
              <div>
                <label className={labelCls} htmlFor="scheduleAt">Giờ đăng (giờ Việt Nam)</label>
                <input id="scheduleAt" type="datetime-local" className={inputCls} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} disabled={!canSchedule} />
              </div>
            )}
            {dialog.requiresReason && (
              <div>
                <label className={labelCls} htmlFor="reason">Lý do (tối thiểu 10 ký tự, hiển thị cho tác giả)</label>
                <textarea id="reason" className={inputCls} rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              </div>
            )}
            {!dialog.requiresReason && dialog.action !== "SCHEDULE" && <p className="text-sm text-gray-600">Bạn chắc chắn muốn thực hiện thao tác này?</p>}
            {message?.kind === "error" && <Alert kind="error">{message.text}{message.details && <ul className="list-disc pl-5">{message.details.map((d) => <li key={d}>{d}</li>)}</ul>}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className={btnCls.default} onClick={() => { setDialog(null); setMessage(undefined); }}>Hủy</button>
              <button type="button" className={btnCls[dialog.tone]} disabled={pending} onClick={() => runTransition(dialog)}>{pending ? "Đang xử lý..." : "Xác nhận"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
