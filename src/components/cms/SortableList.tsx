"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reorderAction } from "@/app/Admin/_actions/admin";

/** Danh sách kéo-thả để sắp xếp; lưu thứ tự qua server action. */
export function SortableList({ kind, items }: { kind: "category" | "topic" | "partner" | "ad"; items: { id: number; node: React.ReactNode }[] }) {
  const [list, setList] = useState(items);
  const [saved, setSaved] = useState<string>();
  const [pending, start] = useTransition();
  const drag = useRef<number | null>(null);

  // Server trả dữ liệu mới (thêm/sửa/xóa rồi router.refresh) → hiển thị theo dữ liệu mới.
  useEffect(() => setList(items), [items]);

  const drop = (to: number) => {
    const from = drag.current;
    drag.current = null;
    if (from === null || from === to) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setList(next);
    start(async () => {
      await reorderAction(kind, next.map((i) => i.id));
      setSaved("Đã lưu thứ tự.");
    });
  };

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">Kéo thả để sắp xếp. {pending ? "Đang lưu..." : saved}</p>
      <ul className="divide-y rounded border border-gray-200">
        {list.map((item, i) => (
          <li key={item.id} draggable onDragStart={() => (drag.current = i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} className="flex items-center gap-3 bg-white px-3 py-2">
            <span className="cursor-move select-none text-gray-400" aria-hidden>⋮⋮</span>
            <div className="min-w-0 flex-1">{item.node}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
