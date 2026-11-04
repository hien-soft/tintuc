import { describe, expect, it } from "vitest";
import { parseSlugId, removeDiacritics, slugify } from "@/lib/slug";
import { formatClock, formatDateTime, formatRelative, toIsoVN } from "@/lib/time";
import { checkBeforeSubmit } from "@/lib/workflow/checks";
import { imagesMissingMeta, sanitizeContent } from "@/lib/content/sanitize";
import { detectImageMime } from "@/lib/storage";

describe("slug tiếng Việt", () => {
  it("bỏ dấu và đ", () => {
    expect(removeDiacritics("Đường phố Hà Nội")).toBe("Duong pho Ha Noi");
    expect(slugify("Quốc hội thảo luận Luật Đất đai (sửa đổi)!")).toBe("quoc-hoi-thao-luan-luat-dat-dai-sua-doi");
    expect(slugify("  --Xin chào--  ")).toBe("xin-chao");
    expect(slugify("Ảnh thời sự quốc tế")).toBe("anh-thoi-su-quoc-te");
  });
  it("cắt theo ranh giới từ", () => {
    const s = slugify("một hai ba bốn năm sáu bảy tám", 12);
    expect(s.length).toBeLessThanOrEqual(12);
    expect(s.endsWith("-")).toBe(false);
  });
  it("tách id", () => {
    expect(parseSlugId("chinh-tri-11")).toEqual({ slug: "chinh-tri", id: 11 });
    expect(parseSlugId("bai-viet-moi-123.html")).toEqual({ slug: "bai-viet-moi", id: 123 });
    expect(parseSlugId("khong-co-id")).toBeNull();
  });
});

describe("thời gian", () => {
  const now = new Date("2026-11-01T05:00:00Z"); // 12:00 giờ VN
  it("tương đối dưới 24 giờ", () => {
    expect(formatRelative(new Date(now.getTime() - 30_000), now)).toBe("Vừa xong");
    expect(formatRelative(new Date(now.getTime() - 47 * 60_000), now)).toBe("47 phút trước");
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000), now)).toBe("3 giờ trước");
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000), now, "en")).toBe("3 hours ago");
  });
  it("từ 24 giờ trở lên hiển thị ngày giờ theo giờ Việt Nam", () => {
    expect(formatRelative(new Date("2026-10-30T17:30:00Z"), now)).toBe("31/10/2026 00:30");
    expect(formatDateTime(new Date("2026-10-31T23:05:00Z"))).toBe("01/11/2026 06:05");
  });
  it("đồng hồ và ISO +07:00", () => {
    expect(formatClock(now)).toBe("01/11/2026 - 12:00’ (GMT +7)");
    expect(toIsoVN(now)).toBe("2026-11-01T12:00:00+07:00");
  });
});

describe("kiểm tra trước khi gửi duyệt", () => {
  const base = {
    type: "NEWS" as const,
    title: "Tiêu đề hợp lệ",
    sapo: "Sapo hợp lệ",
    contentHtml: `<p>${"từ ".repeat(120)}</p>`,
    primaryCatId: 1,
    sourceId: 1,
    authorName: "Minh Anh",
    externalUrl: null,
    cover: { caption: "Chú thích. Ảnh: A - TTVN" },
    photoCount: 0,
  };
  it("bài đủ điều kiện", () => expect(checkBeforeSubmit(base)).toEqual([]));
  it("thiếu nội dung / ảnh / chú thích", () => {
    const errs = checkBeforeSubmit({ ...base, title: "x".repeat(151), contentHtml: "<p>ngắn</p>", cover: { caption: "" }, sapo: "" });
    expect(errs).toHaveLength(4);
  });
  it("bộ ảnh cần ít nhất 1 ảnh", () => {
    expect(checkBeforeSubmit({ ...base, type: "PHOTO_STORY", contentHtml: "", photoCount: 0 })).toContain("Bộ ảnh cần ít nhất 1 ảnh.");
    expect(checkBeforeSubmit({ ...base, type: "PHOTO_STORY", contentHtml: "", photoCount: 3 })).toEqual([]);
  });
});

describe("sanitize nội dung", () => {
  it("loại bỏ script, sự kiện và iframe lạ", () => {
    const out = sanitizeContent(`<p onclick="x()">a<script>alert(1)</script></p><iframe src="https://evil.com/x"></iframe><img src="javascript:alert(1)">`);
    expect(out).not.toMatch(/script|onclick|evil\.com|javascript:/);
  });
  it("giữ iframe YouTube và bọc ảnh có chú thích", () => {
    const out = sanitizeContent(`<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe><img src="/media/a/stand.webp" alt="A" title="Chú thích">`);
    expect(out).toContain("youtube-nocookie.com/embed/abc");
    expect(out).toContain("<figcaption>Chú thích</figcaption>");
  });
  it("đếm ảnh thiếu alt/chú thích", () => {
    expect(imagesMissingMeta(`<img src="a" alt="x" title="y"><img src="b" alt="">`)).toBe(1);
  });
});

describe("magic bytes", () => {
  it("nhận diện ảnh thật, từ chối file giả", () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageMime(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "binary"))).toBe("image/webp");
    expect(detectImageMime(Buffer.from("<?php echo 1; ?>....."))).toBeNull();
  });
});
