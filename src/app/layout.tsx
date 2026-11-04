import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s - ${SITE_NAME}` },
};

// Không khóa zoom trên mobile.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Không đọc headers() ở đây để trang công khai giữ được ISR; `lang` cho /en được đặt bởi HtmlLang.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-white text-ink antialiased">{children}</body>
    </html>
  );
}
