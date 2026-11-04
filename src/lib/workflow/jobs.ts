import { db } from "@/lib/db";
import { kv } from "@/lib/kv";
import { emailUsers, notifyUsers } from "@/lib/notify";
import { REVIEW_SLA_L1_MINUTES, REVIEW_SLA_L2_MINUTES } from "@/lib/config";
import { publishScheduled } from "./transition";

/** Gửi nhắc bài chờ duyệt quá hạn — mỗi bài chỉ nhắc một lần cho mỗi lượt chờ. */
export async function remindOverdue(now = new Date()): Promise<number> {
  const store = await kv();
  const l1Deadline = new Date(now.getTime() - REVIEW_SLA_L1_MINUTES * 60000);
  const l2Deadline = new Date(now.getTime() - REVIEW_SLA_L2_MINUTES * 60000);
  const [l1, l2] = await Promise.all([
    db.article.findMany({ where: { status: "PENDING_L1", submittedAt: { lt: l1Deadline } }, select: { id: true, title: true, primaryCatId: true, submittedAt: true } }),
    db.article.findMany({ where: { status: "PENDING_L2", l1ApprovedAt: { lt: l2Deadline } }, select: { id: true, title: true, l1ApprovedAt: true } }),
  ]);
  let sent = 0;
  for (const a of l1) {
    if (!(await store.set(`overdue:l1:${a.id}:${a.submittedAt?.getTime()}`, "1", 7 * 86400, { nx: true }))) continue;
    const users = await db.user.findMany({ where: { isActive: true, roles: { has: "EDITOR_L1" }, categoryScopes: { some: { categoryId: a.primaryCatId } } }, select: { id: true } });
    const input = { type: "OVERDUE_L1", title: `Quá hạn duyệt cấp 1: "${a.title}"`, link: `/Admin/articles/${a.id}` };
    const ids = await notifyUsers(db, users.map((u) => u.id), input);
    await emailUsers(ids, input);
    sent++;
  }
  for (const a of l2) {
    if (!(await store.set(`overdue:l2:${a.id}:${a.l1ApprovedAt?.getTime()}`, "1", 7 * 86400, { nx: true }))) continue;
    const users = await db.user.findMany({ where: { isActive: true, roles: { has: "EDITOR_L2" } }, select: { id: true } });
    const input = { type: "OVERDUE_L2", title: `Quá hạn duyệt cấp 2: "${a.title}"`, link: `/Admin/articles/${a.id}` };
    const ids = await notifyUsers(db, users.map((u) => u.id), input);
    await emailUsers(ids, input);
    sent++;
  }
  return sent;
}

export async function runScheduledJobs(): Promise<{ published: number; reminded: number }> {
  const published = await publishScheduled();
  const reminded = await remindOverdue();
  return { published, reminded };
}
