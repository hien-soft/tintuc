import { describe, expect, it } from "vitest";
import { adInputSchema, adStatus, fromLocalInput, isPublicAdLive, isSafeAdLink, shouldShowPopup, toLocalInput, type AdInput } from "@/lib/ads";

const base: AdInput = {
  name: "Khuyến mãi tháng 11",
  position: "RIGHT",
  mediaId: "m1",
  linkUrl: "https://example.vn/km",
  openNewTab: true,
  homeOnly: false,
  frequency: "SESSION",
  startAt: "",
  endAt: "",
  isActive: true,
};

describe("isSafeAdLink", () => {
  it.each(["https://example.vn", "http://example.vn/a?b=1", "/vi/tin-tuc/chinh-tri-11"])("chấp nhận %s", (url) => expect(isSafeAdLink(url)).toBe(true));
  it.each(["javascript:alert(1)", "//evil.com", "data:text/html,x", "ftp://x.vn", "example.vn"])("từ chối %s", (url) => expect(isSafeAdLink(url)).toBe(false));
});

describe("adInputSchema", () => {
  it("hợp lệ: liên kết trống thành null, thời gian trống thành null", () => {
    const r = adInputSchema.parse({ ...base, linkUrl: "  " });
    expect(r.linkUrl).toBeNull();
    expect(r.startAt).toBeNull();
    expect(r.endAt).toBeNull();
  });
  it("thiếu tên / ảnh → lỗi", () => {
    expect(adInputSchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(adInputSchema.safeParse({ ...base, mediaId: "" }).success).toBe(false);
  });
  it("liên kết javascript: → lỗi", () => {
    expect(adInputSchema.safeParse({ ...base, linkUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("kết thúc phải sau bắt đầu", () => {
    expect(adInputSchema.safeParse({ ...base, startAt: "2026-11-10T08:00", endAt: "2026-11-09T08:00" }).success).toBe(false);
    expect(adInputSchema.safeParse({ ...base, startAt: "2026-11-10T08:00", endAt: "2026-11-10T09:00" }).success).toBe(true);
  });
  it("thời gian nhập theo giờ Việt Nam (+07:00)", () => {
    const r = adInputSchema.parse({ ...base, startAt: "2026-11-10T08:00" });
    expect(r.startAt?.toISOString()).toBe("2026-11-10T01:00:00.000Z");
  });
});

describe("giờ Việt Nam ↔ ô datetime-local", () => {
  it("chuyển hai chiều", () => {
    const d = fromLocalInput("2026-11-03T23:30");
    expect(d?.toISOString()).toBe("2026-11-03T16:30:00.000Z");
    expect(toLocalInput(d)).toBe("2026-11-03T23:30");
  });
  it("chuỗi sai → null", () => expect(fromLocalInput("abc")).toBeNull());
});

describe("adStatus", () => {
  const now = new Date("2026-11-03T05:00:00Z");
  it("tắt", () => expect(adStatus({ isActive: false, startAt: null, endAt: null }, now)).toBe("OFF"));
  it("chờ đến lịch", () => expect(adStatus({ isActive: true, startAt: new Date("2026-11-04T00:00:00Z"), endAt: null }, now)).toBe("SCHEDULED"));
  it("hết hạn", () => expect(adStatus({ isActive: true, startAt: null, endAt: new Date("2026-11-03T04:59:00Z") }, now)).toBe("EXPIRED"));
  it("đang chạy", () => expect(adStatus({ isActive: true, startAt: new Date("2026-11-01T00:00:00Z"), endAt: new Date("2026-11-30T00:00:00Z") }, now)).toBe("RUNNING"));
  it("isPublicAdLive dùng chuỗi ISO", () => {
    expect(isPublicAdLive({ startAt: "2026-11-04T00:00:00.000Z", endAt: null }, now)).toBe(false);
    expect(isPublicAdLive({ startAt: null, endAt: null }, now)).toBe(true);
  });
});

describe("shouldShowPopup", () => {
  const now = new Date("2026-11-03T10:00:00Z"); // 17:00 giờ VN
  it("mỗi lần mở trang: luôn hiện", () => expect(shouldShowPopup("EVERY_PAGE", { lastShownAt: now, shownThisSession: true }, now)).toBe(true));
  it("mỗi phiên: chỉ khi chưa hiện trong phiên", () => {
    expect(shouldShowPopup("SESSION", { lastShownAt: null, shownThisSession: false }, now)).toBe(true);
    expect(shouldShowPopup("SESSION", { lastShownAt: null, shownThisSession: true }, now)).toBe(false);
  });
  it("mỗi ngày: theo ngày lịch Việt Nam", () => {
    expect(shouldShowPopup("DAILY", { lastShownAt: null, shownThisSession: false }, now)).toBe(true);
    // 08:00 VN cùng ngày → không hiện lại
    expect(shouldShowPopup("DAILY", { lastShownAt: new Date("2026-11-03T01:00:00Z"), shownThisSession: false }, now)).toBe(false);
    // 23:30 VN hôm trước (16:30Z ngày 2/11) → hiện lại
    expect(shouldShowPopup("DAILY", { lastShownAt: new Date("2026-11-02T16:30:00Z"), shownThisSession: false }, now)).toBe(true);
    // 00:30 VN hôm nay (17:30Z ngày 2/11) → cùng ngày VN, không hiện
    expect(shouldShowPopup("DAILY", { lastShownAt: new Date("2026-11-02T17:30:00Z"), shownThisSession: false }, now)).toBe(false);
  });
});
