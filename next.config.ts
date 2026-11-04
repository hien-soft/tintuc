import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://video.tintucvietnam.vn",
      "connect-src 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  // Không redirect trong middleware: Next chuẩn hóa Location 127.0.0.1 → localhost ở đó (mất cookie phiên).
  async redirects() {
    return [
      { source: "/", destination: "/vi", permanent: false },
      // CMS chuyển từ /cms sang /Admin: giữ link cũ (bookmark, thông báo đã lưu) hoạt động.
      { source: "/cms", destination: "/Admin", permanent: true },
      { source: "/cms/:path*", destination: "/Admin/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/Admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
