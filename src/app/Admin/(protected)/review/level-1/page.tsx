import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { l1QueueWhere } from "@/lib/cms/queries";
import { loadQueue } from "@/lib/cms/review";
import { PageHeader } from "@/components/cms/ui";
import { ReviewQueue } from "@/components/cms/workflow/ReviewQueue";
import { REVIEW_SLA_L1_MINUTES } from "@/lib/config";

export const metadata = { title: "Duyệt cấp 1" };

export default async function ReviewL1Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  if (!can(user, "review.l1.view")) redirect("/Admin");
  const rows = await loadQueue(l1QueueWhere(user), 1);
  const { error } = await searchParams;
  return (
    <>
      <PageHeader title="Hàng đợi duyệt cấp 1" description={`Kiểm tra nội dung, chính tả, ảnh. Bài chờ quá ${REVIEW_SLA_L1_MINUTES} phút được tô đỏ.`} />
      <ReviewQueue rows={rows} user={user} level={1} error={error} />
    </>
  );
}
