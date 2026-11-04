/**
 * Integration test chạy với Postgres thật (dữ liệu seed). Chạy: pnpm test:integration
 * Tạo bài riêng cho test và xóa khi xong.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { publishScheduled, transitionArticle } from "@/lib/workflow/transition";
import { requiresTwoFactor } from "@/lib/rbac/permissions";
import { getPublicArticle } from "@/lib/repo/public";
import { AppError } from "@/lib/errors";
import type { CmsUser } from "@/lib/auth/session";

async function cmsUser(email: string): Promise<CmsUser> {
  const u = await db.user.findUniqueOrThrow({ where: { email }, include: { categoryScopes: true } });
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    roles: u.roles,
    categoryScopes: u.categoryScopes.map((s) => s.categoryId),
    mustChangePassword: false,
    totpEnabled: u.totpEnabled,
    require2fa: requiresTwoFactor(u.roles),
  };
}

let reporter: CmsUser, btvCT: CmsUser, btvKT: CmsUser, tbt: CmsUser;
let articleId: number;
const REASON = "Cần bổ sung số liệu và nguồn trích dẫn.";

async function current() {
  return db.article.findUniqueOrThrow({ where: { id: articleId } });
}

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

beforeAll(async () => {
  [reporter, btvCT, btvKT, tbt] = await Promise.all(["pv2@demo.vn", "btv.chinhtri@demo.vn", "btv.kinhte@demo.vn", "tbt@demo.vn"].map(cmsUser));
  const cat = await db.category.findFirstOrThrow({ where: { slug: "chinh-tri" } });
  const source = await db.source.findFirstOrThrow({ where: { slug: "ttvn" } });
  const cover = await db.media.findFirstOrThrow({ where: { caption: { not: null } } });
  const a = await db.article.create({
    data: {
      type: "NEWS",
      title: "Bài kiểm thử tích hợp quy trình duyệt",
      slug: `bai-kiem-thu-${Date.now()}`,
      sapo: "Sapo của bài kiểm thử tích hợp.",
      contentHtml: `<p>${"nội dung kiểm thử ".repeat(60)}</p>`,
      primaryCatId: cat.id,
      sourceId: source.id,
      authorId: reporter.id,
      authorName: "Phóng viên kiểm thử",
      coverMediaId: cover.id,
    },
  });
  articleId = a.id;
});

afterAll(async () => {
  await db.notification.deleteMany({ where: { link: `/Admin/articles/${articleId}` } });
  await db.auditLog.deleteMany({ where: { entityType: "Article", entityId: String(articleId) } });
  await db.article.delete({ where: { id: articleId } }).catch(() => undefined);
  await db.$disconnect();
});

describe("luồng duyệt 2 cấp", () => {
  it("1. phóng viên gửi duyệt", async () => {
    const a = await transitionArticle({ articleId, action: "SUBMIT", actor: reporter, expectedVersion: (await current()).version });
    expect(a.status).toBe("PENDING_L1");
    const notified = await db.notification.findMany({ where: { link: `/Admin/articles/${articleId}`, type: "REVIEW_L1_REQUEST" } });
    // BTV đúng phạm vi được báo, BTV ngoài phạm vi thì không (tài khoản chủ có phạm vi mọi danh mục cũng được báo).
    const ids = notified.map((n) => n.userId);
    expect(ids).toContain(btvCT.id);
    expect(ids).not.toContain(btvKT.id);
    expect(ids).not.toContain(reporter.id);
  });

  it("2. BTV ngoài phạm vi không nhận được; BTV đúng phạm vi nhận và trả lại kèm lý do", async () => {
    const v = (await current()).version;
    await expectError(transitionArticle({ articleId, action: "CLAIM_L1", actor: btvKT, expectedVersion: v }), "FORBIDDEN");
    await transitionArticle({ articleId, action: "CLAIM_L1", actor: btvCT, expectedVersion: v });
    await expectError(transitionArticle({ articleId, action: "RETURN_L1", actor: btvCT, expectedVersion: v + 1 }), "VALIDATION_ERROR");
    const a = await transitionArticle({ articleId, action: "RETURN_L1", actor: btvCT, reason: REASON, expectedVersion: v + 1 });
    expect(a.status).toBe("RETURNED");
    const comment = await db.articleComment.findFirst({ where: { articleId, kind: "RETURN_REASON" } });
    expect(comment?.body).toBe(REASON);
  });

  it("3. tác giả sửa và gửi lại", async () => {
    await db.article.update({ where: { id: articleId }, data: { sapo: "Sapo đã được bổ sung số liệu.", version: { increment: 1 } } });
    const a = await transitionArticle({ articleId, action: "RESUBMIT", actor: reporter, expectedVersion: (await current()).version });
    expect(a.status).toBe("PENDING_L1");
  });

  it("4. BTV cấp 1 duyệt", async () => {
    const v = (await current()).version;
    await transitionArticle({ articleId, action: "CLAIM_L1", actor: btvCT, expectedVersion: v });
    const a = await transitionArticle({ articleId, action: "APPROVE_L1", actor: btvCT, expectedVersion: v + 1 });
    expect(a.status).toBe("PENDING_L2");
    expect(a.l1ReviewerId).toBe(btvCT.id);
  });

  it("5. cấp 2 hẹn giờ → job xuất bản (idempotent)", async () => {
    const v = (await current()).version;
    await transitionArticle({ articleId, action: "CLAIM_L2", actor: tbt, expectedVersion: v });
    const when = new Date(Date.now() + 2 * 60_000);
    const a = await transitionArticle({ articleId, action: "SCHEDULE", actor: tbt, scheduledAt: when, expectedVersion: v + 1 });
    expect(a.status).toBe("SCHEDULED");
    expect(await getPublicArticle(articleId)).toBeNull();

    await publishScheduled(new Date(when.getTime() + 1000));
    expect((await current()).status).toBe("PUBLISHED");
    await publishScheduled(new Date(when.getTime() + 2000)); // chạy lại không đổi gì
    expect((await current()).status).toBe("PUBLISHED");
    const logs = await db.articleStatusLog.count({ where: { articleId, action: "AUTO_PUBLISH" } });
    expect(logs).toBe(1);
  });

  it("6. gỡ bài → public trả về gone (410)", async () => {
    await db.article.update({ where: { id: articleId }, data: { publishedAt: new Date(Date.now() - 1000) } });
    expect(await getPublicArticle(articleId)).toMatchObject({ article: { id: articleId } });
    await expectError(transitionArticle({ articleId, action: "UNPUBLISH", actor: tbt, expectedVersion: (await current()).version }), "VALIDATION_ERROR");
    const a = await transitionArticle({ articleId, action: "UNPUBLISH", actor: tbt, reason: "Thông tin cần kiểm chứng lại.", expectedVersion: (await current()).version });
    expect(a.status).toBe("UNPUBLISHED");
    expect(await getPublicArticle(articleId)).toEqual({ gone: true });
  });

  it("mọi chuyển trạng thái đều có status log, revision và audit", async () => {
    const [logs, revisions, audits] = await Promise.all([
      db.articleStatusLog.count({ where: { articleId } }),
      db.articleRevision.count({ where: { articleId } }),
      db.auditLog.count({ where: { entityType: "Article", entityId: String(articleId) } }),
    ]);
    expect(logs).toBe(10);
    expect(revisions).toBe(10);
    expect(audits).toBe(10);
  });

  it("optimistic locking: người sau nhận CONFLICT", async () => {
    const v = (await current()).version;
    const results = await Promise.allSettled([
      transitionArticle({ articleId, action: "REQUEUE", actor: tbt, expectedVersion: v }),
      transitionArticle({ articleId, action: "ARCHIVE", actor: tbt, expectedVersion: v }),
    ]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(((rejected[0] as PromiseRejectedResult).reason as AppError).code).toBe("CONFLICT");
  });
});
