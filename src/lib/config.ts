export const SITE_NAME = process.env.SITE_NAME ?? "Tin Tức Việt Nam";
export const SITE_SHORT = "TTVN";
export const SITE_DOMAIN = "tintucvietnam.vn";
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const MEDIA_BASE_URL = (process.env.PUBLIC_MEDIA_BASE_URL ?? "/media").replace(/\/$/, "");
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export const REVIEW_SLA_L1_MINUTES = Number(process.env.REVIEW_SLA_L1_MINUTES ?? 120);
export const REVIEW_SLA_L2_MINUTES = Number(process.env.REVIEW_SLA_L2_MINUTES ?? 60);

/** Domain được phép nhúng iframe trong nội dung bài. */
export const IFRAME_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "video.tintucvietnam.vn"];
