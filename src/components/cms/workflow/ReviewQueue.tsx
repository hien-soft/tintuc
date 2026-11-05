import Link from "next/link";
import type { Article } from "@prisma/client";
import { claimFromQueueAction } from "@/app/Admin/_actions/articles";
import { formatWaiting, overdueInfo } from "@/lib/cms/queries";
import { checkTransition, type WorkflowAction } from "@/lib/workflow/machine";
import type { CmsUser } from "@/lib/auth/session";
import { Alert, btnCls, EmptyState, StatusBadge } from "../ui";

type Row = Article & { author: { fullName: string }; primaryCat: { name: string }; holder: string | null };

export function ReviewQueue({ rows, user, level, error }: { rows: Row[]; user: CmsUser; level: 1 | 2; error?: string }) {
  const claim: WorkflowAction = level === 1 ? "CLAIM_L1" : "CLAIM_L2";
  const back = `/Admin/review/level-${level}`;
  return (
    <>
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {rows.length === 0 ? (
        <EmptyState>Không có bài nào trong hàng đợi.</EmptyState>
      ) : (
        <div className="ds-card--dash overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold text-[#2A3560]">
              <tr>
                <th className="px-4 py-3">Tiêu đề</th>
                <th className="px-4 py-3">Danh mục</th>
                <th className="px-4 py-3">Tác giả</th>
                <th className="px-4 py-3">Thời gian chờ</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Người đang giữ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((a) => {
                const { waitingMin, overdue } = overdueInfo(a);
                const canClaim = checkTransition({ article: a, action: claim, actor: user }).ok;
                const isMine = a.holderId === user.id;
                return (
                  <tr key={a.id} className={overdue ? "bg-red-50" : a.isUrgent ? "bg-amber-50/60" : ""}>
                    <td className="max-w-md px-3 py-2">
                      {a.isUrgent && <span className="mr-1 inline-flex h-5 items-center rounded-full bg-accent-50 px-2 text-[10px] font-bold text-accent-strong">KHẨN</span>}
                      <Link href={`/Admin/articles/${a.id}`} className="font-medium hover:text-brand">{a.title}</Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{a.primaryCat.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{a.author.fullName}</td>
                    <td className={`whitespace-nowrap px-3 py-2 ${overdue ? "font-bold text-red-700" : "text-gray-600"}`}>
                      {formatWaiting(waitingMin)}{overdue && " ⚠ quá hạn"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{a.holder ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {canClaim ? (
                        <form action={claimFromQueueAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="version" value={a.version} />
                          <input type="hidden" name="action" value={claim} />
                          <input type="hidden" name="back" value={back} />
                          <button className={btnCls.primary}>Nhận duyệt</button>
                        </form>
                      ) : (
                        <Link href={`/Admin/articles/${a.id}`} className={isMine ? btnCls.primary : btnCls.default}>{isMine ? "Tiếp tục duyệt" : "Xem"}</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
