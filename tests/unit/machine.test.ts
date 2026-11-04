import { describe, expect, it } from "vitest";
import type { ArticleStatus } from "@prisma/client";
import { availableActions, checkTransition, TRANSITIONS, type WorkflowAction, type WorkflowArticle } from "@/lib/workflow/machine";
import type { RbacUser } from "@/lib/rbac/permissions";

const CAT_POLITICS = 1;
const CAT_ECONOMY = 2;

const author: RbacUser = { id: "author", roles: ["REPORTER"], categoryScopes: [] };
const l1: RbacUser = { id: "l1", roles: ["EDITOR_L1"], categoryScopes: [CAT_POLITICS] };
const l1Other: RbacUser = { id: "l1-other", roles: ["EDITOR_L1"], categoryScopes: [CAT_ECONOMY] };
const l2: RbacUser = { id: "l2", roles: ["EDITOR_L2"], categoryScopes: [] };
const admin: RbacUser = { id: "admin", roles: ["ADMIN"], categoryScopes: [] };

function art(status: ArticleStatus, extra: Partial<WorkflowArticle> = {}): WorkflowArticle {
  return { status, authorId: author.id, primaryCatId: CAT_POLITICS, l1ReviewerId: null, holderId: null, ...extra };
}

const REASON = "Cần bổ sung nguồn số liệu";
const future = new Date(Date.now() + 3600_000);

describe("state machine — các chuyển hợp lệ", () => {
  const cases: [ArticleStatus, WorkflowAction, RbacUser | null, Partial<WorkflowArticle>, ArticleStatus][] = [
    ["DRAFT", "SUBMIT", author, {}, "PENDING_L1"],
    ["PENDING_L1", "WITHDRAW", author, {}, "DRAFT"],
    ["PENDING_L1", "CLAIM_L1", l1, {}, "IN_REVIEW_L1"],
    ["IN_REVIEW_L1", "RELEASE_L1", l1, { holderId: l1.id }, "PENDING_L1"],
    ["IN_REVIEW_L1", "APPROVE_L1", l1, { holderId: l1.id }, "PENDING_L2"],
    ["IN_REVIEW_L1", "RETURN_L1", l1, { holderId: l1.id }, "RETURNED"],
    ["IN_REVIEW_L1", "REJECT_L1", l1, { holderId: l1.id }, "REJECTED"],
    ["PENDING_L2", "CLAIM_L2", l2, { l1ReviewerId: l1.id }, "IN_REVIEW_L2"],
    ["IN_REVIEW_L2", "RELEASE_L2", l2, { holderId: l2.id }, "PENDING_L2"],
    ["IN_REVIEW_L2", "PUBLISH", l2, { holderId: l2.id }, "PUBLISHED"],
    ["IN_REVIEW_L2", "SCHEDULE", l2, { holderId: l2.id }, "SCHEDULED"],
    ["IN_REVIEW_L2", "RETURN_L2", l2, { holderId: l2.id }, "RETURNED"],
    ["IN_REVIEW_L2", "SEND_BACK_L1", l2, { holderId: l2.id }, "PENDING_L1"],
    ["IN_REVIEW_L2", "REJECT_L2", l2, { holderId: l2.id }, "REJECTED"],
    ["RETURNED", "RESUBMIT", author, {}, "PENDING_L1"],
    ["SCHEDULED", "AUTO_PUBLISH", null, {}, "PUBLISHED"],
    ["SCHEDULED", "CANCEL_SCHEDULE", l2, {}, "PENDING_L2"],
    ["PUBLISHED", "UNPUBLISH", l2, {}, "UNPUBLISHED"],
    ["PUBLISHED", "CORRECT", l2, {}, "PUBLISHED"],
    ["UNPUBLISHED", "REQUEUE", l2, {}, "PENDING_L2"],
    ["REJECTED", "ARCHIVE", l2, {}, "ARCHIVED"],
    ["UNPUBLISHED", "ARCHIVE", l2, {}, "ARCHIVED"],
  ];
  it.each(cases)("%s --%s--> %s", (from, action, actor, extra, to) => {
    const res = checkTransition({ article: art(from, extra), action, actor, reason: REASON, scheduledAt: future });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.transition.to).toBe(to);
  });
});

describe("state machine — mọi cặp (trạng thái, hành động) không có trong bảng đều bị từ chối", () => {
  const statuses: ArticleStatus[] = ["DRAFT", "PENDING_L1", "IN_REVIEW_L1", "PENDING_L2", "IN_REVIEW_L2", "RETURNED", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "REJECTED", "ARCHIVED"];
  const actions = [...new Set(TRANSITIONS.map((t) => t.action))];
  const pairs = statuses.flatMap((s) => actions.map((a) => [s, a] as const)).filter(([s, a]) => !TRANSITIONS.some((t) => t.from === s && t.action === a));
  it.each(pairs)("%s + %s => INVALID_TRANSITION", (status, action) => {
    const res = checkTransition({ article: art(status, { holderId: l2.id }), action, actor: l2, reason: REASON, scheduledAt: future });
    expect(res).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });
});

describe("quy tắc tách biệt người duyệt", () => {
  it("tác giả không tự duyệt được bài của mình (dù có vai trò duyệt)", () => {
    const writerEditor: RbacUser = { id: "author", roles: ["REPORTER", "EDITOR_L1", "EDITOR_L2"], categoryScopes: [CAT_POLITICS] };
    expect(checkTransition({ article: art("PENDING_L1"), action: "CLAIM_L1", actor: writerEditor })).toMatchObject({ ok: false, code: "SELF_REVIEW_NOT_ALLOWED" });
    expect(checkTransition({ article: art("PENDING_L2"), action: "CLAIM_L2", actor: writerEditor })).toMatchObject({ ok: false, code: "SELF_REVIEW_NOT_ALLOWED" });
  });

  it("người đã duyệt cấp 1 không được duyệt cấp 2 cùng bài", () => {
    const both: RbacUser = { id: "l1", roles: ["EDITOR_L1", "EDITOR_L2"], categoryScopes: [CAT_POLITICS] };
    expect(checkTransition({ article: art("PENDING_L2", { l1ReviewerId: "l1" }), action: "CLAIM_L2", actor: both })).toMatchObject({ ok: false, code: "SELF_REVIEW_NOT_ALLOWED" });
    expect(checkTransition({ article: art("IN_REVIEW_L2", { l1ReviewerId: "l1", holderId: "l1" }), action: "PUBLISH", actor: both })).toMatchObject({ ok: false, code: "SELF_REVIEW_NOT_ALLOWED" });
  });

  it("chỉ người đang nhận duyệt mới được duyệt", () => {
    const other: RbacUser = { id: "l1b", roles: ["EDITOR_L1"], categoryScopes: [CAT_POLITICS] };
    expect(checkTransition({ article: art("IN_REVIEW_L1", { holderId: l1.id }), action: "APPROVE_L1", actor: other })).toMatchObject({ ok: false, code: "LOCKED" });
  });
});

describe("phạm vi danh mục", () => {
  it("BTV cấp 1 ngoài phạm vi không nhận được bài", () => {
    expect(checkTransition({ article: art("PENDING_L1"), action: "CLAIM_L1", actor: l1Other })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
  it("ADMIN không mặc định có quyền duyệt", () => {
    expect(checkTransition({ article: art("PENDING_L1"), action: "CLAIM_L1", actor: admin })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(checkTransition({ article: art("PENDING_L2"), action: "CLAIM_L2", actor: admin })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
  it("người khác không gửi duyệt hộ tác giả", () => {
    expect(checkTransition({ article: art("DRAFT"), action: "SUBMIT", actor: l2 })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
  it("job hẹn giờ chỉ dành cho hệ thống", () => {
    expect(checkTransition({ article: art("SCHEDULED"), action: "AUTO_PUBLISH", actor: l2 })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("bắt buộc lý do", () => {
  const needReason: [ArticleStatus, WorkflowAction, RbacUser][] = [
    ["IN_REVIEW_L1", "RETURN_L1", l1],
    ["IN_REVIEW_L1", "REJECT_L1", l1],
    ["IN_REVIEW_L2", "RETURN_L2", l2],
    ["IN_REVIEW_L2", "REJECT_L2", l2],
    ["IN_REVIEW_L2", "SEND_BACK_L1", l2],
    ["PUBLISHED", "UNPUBLISH", l2],
    ["PUBLISHED", "CORRECT", l2],
  ];
  it.each(needReason)("%s + %s thiếu lý do => VALIDATION_ERROR", (status, action, actor) => {
    const holder = { holderId: actor.id };
    expect(checkTransition({ article: art(status, holder), action, actor })).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(checkTransition({ article: art(status, holder), action, actor, reason: "quá ngắn" })).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(checkTransition({ article: art(status, holder), action, actor, reason: REASON }).ok).toBe(true);
  });

  it("giờ hẹn đăng phải ở tương lai", () => {
    const a = art("IN_REVIEW_L2", { holderId: l2.id });
    expect(checkTransition({ article: a, action: "SCHEDULE", actor: l2, scheduledAt: new Date(Date.now() - 1000) })).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(checkTransition({ article: a, action: "SCHEDULE", actor: l2 })).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });
});

describe("availableActions", () => {
  it("chỉ trả về hành động hợp lệ cho người dùng", () => {
    expect(availableActions(art("PENDING_L1"), author).map((t) => t.action)).toEqual(["WITHDRAW"]);
    expect(availableActions(art("PENDING_L1"), l1).map((t) => t.action)).toEqual(["CLAIM_L1"]);
    expect(availableActions(art("PENDING_L1"), l1Other)).toEqual([]);
    expect(availableActions(art("IN_REVIEW_L2", { holderId: l2.id }), l2).map((t) => t.action).sort()).toEqual(
      ["PUBLISH", "REJECT_L2", "RELEASE_L2", "RETURN_L2", "SCHEDULE", "SEND_BACK_L1"].sort(),
    );
  });
});
