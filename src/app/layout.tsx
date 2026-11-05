import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/config";

// Design system: một họ chữ Be Vietnam Pro cho toàn sản phẩm (tự host qua next/font).
const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-be-vietnam",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s - ${SITE_NAME}` },
};

// Không khóa zoom trên mobile.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Không đọc headers() ở đây để trang công khai giữ được ISR; `lang` cho /en được đặt bởi HtmlLang.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="bg-white font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
