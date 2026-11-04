import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";
import { l2QueueWhere } from "@/lib/cms/queries";
import { loadQueue } from "@/lib/cms/review";
import { PageHeader } from "@/components/cms/ui";
import { ReviewQueue } from "@/components/cms/workflow/ReviewQueue";
import { REVIEW_SLA_L2_MINUTES } from "@/lib/config";

export const metadata = { title: "Duyệt cấp 2" };

export default async function ReviewL2Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  if (!can(user, "review.l2.view")) redirect("/Admin");
  const rows = await loadQueue(l2QueueWhere(), 2);
  const { error } = await searchParams;
  return (
    <>
      <PageHeader title="Hàng đợi duyệt cấp 2" description={`Duyệt cuối, xuất bản hoặc hẹn giờ. Bài chờ quá ${REVIEW_SLA_L2_MINUTES} phút được tô đỏ.`} />
      <ReviewQueue rows={rows} user={user} level={2} error={error} />
    </>
  );
}
