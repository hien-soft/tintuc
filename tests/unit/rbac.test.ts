import { describe, expect, it } from "vitest";
import { ACTIONS, can, PERMISSIONS, requiresTwoFactor, type Action, type RbacUser } from "@/lib/rbac/permissions";

const reporter: RbacUser = { id: "r", roles: ["REPORTER"], categoryScopes: [] };
const l1: RbacUser = { id: "e1", roles: ["EDITOR_L1"], categoryScopes: [11, 14] };
const l2: RbacUser = { id: "e2", roles: ["EDITOR_L2"], categoryScopes: [] };
const admin: RbacUser = { id: "a", roles: ["ADMIN"], categoryScopes: [] };

/** Ma trận mục 5.2 — true nếu vai trò có quyền (không xét phạm vi). */
const MATRIX: Record<Action, [boolean, boolean, boolean, boolean]> = {
  "article.create": [true, true, true, false],
  "article.editOwnDraft": [true, true, true, false],
  "article.submitOwn": [true, true, true, false],
  "article.withdrawOwn": [true, false, false, false],
  "review.l1.view": [false, true, true, false],
  "review.l1.act": [false, true, false, false],
  "review.l1.edit": [false, true, false, false],
  "review.l2.view": [false, false, true, false],
  "review.l2.act": [false, false, true, false],
  "article.unpublish": [false, false, true, false],
  "article.correct": [false, false, true, false],
  "article.pin": [false, false, true, false],
  "home.layout": [false, false, true, false],
  "media.manageOwn": [true, true, true, true],
  "media.manageAll": [false, true, true, true],
  "taxonomy.manage": [false, false, true, true],
  "ads.manage": [false, false, true, true],
  "user.manage": [false, false, false, true],
  "audit.viewArticle": [false, false, true, true],
  "audit.viewAll": [false, false, false, true],
};

describe("can() theo ma trận quyền", () => {
  it("bao phủ mọi action", () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...ACTIONS].sort());
  });
  const users = [reporter, l1, l2, admin];
  for (const action of ACTIONS) {
    users.forEach((u, i) => {
      it(`${u.roles[0]} ${MATRIX[action][i] ? "được" : "không được"} ${action}`, () => {
        expect(can(u, action)).toBe(MATRIX[action][i]);
      });
    });
  }
});

describe("phạm vi danh mục", () => {
  it("EDITOR_L1 chỉ duyệt trong danh mục được phân công", () => {
    expect(can(l1, "review.l1.act", { categoryId: 11 })).toBe(true);
    expect(can(l1, "review.l1.act", { categoryId: 4 })).toBe(false);
    expect(can(l1, "review.l1.view", { categoryId: 4 })).toBe(false);
  });
  it("EDITOR_L2 xem hàng đợi cấp 1 ở mọi danh mục", () => {
    expect(can(l2, "review.l1.view", { categoryId: 4 })).toBe(true);
  });
  it("quyền trên bài của mình kiểm tra chủ sở hữu", () => {
    expect(can(reporter, "article.editOwnDraft", { ownerId: "r" })).toBe(true);
    expect(can(reporter, "article.editOwnDraft", { ownerId: "khac" })).toBe(false);
  });
  it("nhiều vai trò: hợp quyền", () => {
    const multi: RbacUser = { id: "m", roles: ["REPORTER", "ADMIN"], categoryScopes: [] };
    expect(can(multi, "user.manage")).toBe(true);
    expect(can(multi, "article.create")).toBe(true);
  });
});

describe("2FA bắt buộc", () => {
  it("bắt buộc với duyệt cấp 1, cấp 2, admin", () => {
    expect(requiresTwoFactor(["REPORTER"])).toBe(false);
    expect(requiresTwoFactor(["EDITOR_L1"])).toBe(true);
    expect(requiresTwoFactor(["EDITOR_L2"])).toBe(true);
    expect(requiresTwoFactor(["ADMIN"])).toBe(true);
  });
  it("PERMISSIONS không cấp quyền duyệt cho ADMIN", () => {
    expect(PERMISSIONS.ADMIN.some((a) => a.startsWith("review."))).toBe(false);
  });
});
