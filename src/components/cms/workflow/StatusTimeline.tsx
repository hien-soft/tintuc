import type { ArticleStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/time";
import { StatusBadge } from "../ui";

export interface TimelineItem {
  id: string;
  fromStatus: ArticleStatus;
  toStatus: ArticleStatus;
  action: string;
  actorName: string;
  reason: string | null;
  createdAt: Date;
}

export function StatusTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">Chưa có lịch sử trạng thái.</p>;
  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-4">
      {items.map((s) => (
        <li key={s.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand" />
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <StatusBadge status={s.fromStatus} /> <span className="text-gray-400">→</span> <StatusBadge status={s.toStatus} />
          </div>
          <p className="mt-1 text-xs text-gray-500">{s.actorName} · {formatDateTime(s.createdAt)} · {s.action}</p>
          {s.reason && <p className="mt-1 rounded bg-gray-50 p-2 text-sm text-gray-700">“{s.reason}”</p>}
        </li>
      ))}
    </ol>
  );
}
