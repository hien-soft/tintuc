import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { AD_POSITIONS, AD_STATUS_LABELS, adStatus, FREQUENCY_LABELS, POSITION_LABELS, toLocalInput, type AdStatus } from "@/lib/ads";
import { Card, EmptyState, PageHeader } from "@/components/cms/ui";
import { SortableList } from "@/components/cms/SortableList";
import { AdForm, AdRowActions, EMPTY_AD, type AdFormValue } from "@/components/cms/AdForm";
import { mediaUrl } from "@/lib/storage";

export const metadata = { title: "Quảng cáo" };

const STATUS_COLORS: Record<AdStatus, string> = {
  RUNNING: "bg-emerald-100 text-emerald-800",
  SCHEDULED: "bg-sky-100 text-sky-800",
  EXPIRED: "bg-zinc-200 text-zinc-700",
  OFF: "bg-gray-100 text-gray-600",
};

function schedule(startAt: Date | null, endAt: Date | null): string {
  if (!startAt && !endAt) return "Không giới hạn thời gian";
  return `${startAt ? formatDateTime(startAt) : "ngay"} → ${endAt ? formatDateTime(endAt) : "không giới hạn"}`;
}

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  if (!can(user, "ads.manage")) redirect("/Admin");
  const { edit } = await searchParams;

  const ads = await db.ad.findMany({ orderBy: [{ position: "asc" }, { order: "asc" }, { id: "asc" }], include: { media: { select: { id: true, key: true, width: true, height: true } } } });
  const editing = edit ? ads.find((a) => a.id === Number(edit)) : undefined;
  const initial: AdFormValue = editing
    ? {
        id: editing.id,
        name: editing.name,
        position: editing.position,
        media: editing.media,
        linkUrl: editing.linkUrl ?? "",
        openNewTab: editing.openNewTab,
        homeOnly: editing.homeOnly,
        frequency: editing.frequency,
        startAt: toLocalInput(editing.startAt),
        endAt: toLocalInput(editing.endAt),
        isActive: editing.isActive,
      }
    : EMPTY_AD;
  const now = new Date();

  return (
    <>
      <PageHeader title="Quảng cáo" description="Banner 2 bên trang công khai (màn hình rộng) và popup. Thay đổi hiển thị trên trang công khai trong vòng 1 phút." />
      <Card title={editing ? `Sửa quảng cáo: ${editing.name}` : "Thêm quảng cáo"} className="mb-6">
        <AdForm key={initial.id ?? "new"} initial={initial} />
      </Card>

      {AD_POSITIONS.map((position) => {
        const list = ads.filter((a) => a.position === position);
        return (
          <Card key={position} title={`${POSITION_LABELS[position]} (${list.length})`} className="mb-6">
            {list.length === 0 ? (
              <EmptyState>Chưa có quảng cáo ở vị trí này.</EmptyState>
            ) : (
              <>
                {position === "POPUP" && <p className="mb-2 text-xs text-gray-500">Mỗi lần chỉ hiện 1 popup: popup đang chạy đứng đầu danh sách (và hợp tần suất) được ưu tiên.</p>}
                {position !== "POPUP" && <p className="mb-2 text-xs text-gray-500">Các banner đang chạy được xếp chồng từ trên xuống theo thứ tự này.</p>}
                <SortableList
                  kind="ad"
                  items={list.map((a) => {
                    const status = adStatus(a, now);
                    return {
                      id: a.id,
                      node: (
                        <div className="flex flex-wrap items-center gap-3">
                          <img src={mediaUrl(a.media.key, "thumb")} alt="" className="h-16 w-16 rounded border bg-gray-50 object-contain" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">
                              {a.name}{" "}
                              <span className={`ml-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>{AD_STATUS_LABELS[status]}</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {schedule(a.startAt, a.endAt)}
                              {a.homeOnly && " · chỉ trang chủ"}
                              {position === "POPUP" && ` · ${FREQUENCY_LABELS[a.frequency].toLowerCase()}`}
                              {" · "}
                              {a.clicks.toLocaleString("vi-VN")} lượt bấm
                            </p>
                            {a.linkUrl && <p className="truncate text-xs text-gray-400">{a.linkUrl}</p>}
                          </div>
                          <AdRowActions id={a.id} name={a.name} isActive={a.isActive} />
                        </div>
                      ),
                    };
                  })}
                />
              </>
            )}
          </Card>
        );
      })}
    </>
  );
}
