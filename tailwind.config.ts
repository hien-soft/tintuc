import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Giao diện theo design system Chợ Tuyển Dụng v2.3 (D:\Dev\Chotuyendung-System):
 * token màu logo (--ds-*), thang 4/8px, bo góc lớn, nút viên thuốc, font Be Vietnam Pro.
 * Giá trị gốc khai báo bằng biến CSS trong src/app/globals.css; ở đây ánh xạ sang lớp Tailwind.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Xanh thương hiệu (#1A5FE6) — thay màu đỏ cũ ở mọi nơi dùng `brand`
        brand: {
          DEFAULT: "#1A5FE6",
          dark: "#154DC2",
          light: "#EEF4FE",
          50: "#EEF4FE",
          100: "#DCE7FD",
          200: "#BAD0FA",
          300: "#8EB2F5",
          400: "#5B8CEF",
          500: "#3373EA",
          600: "#1A5FE6",
          700: "#154DC2",
          800: "#143F9B",
          900: "#12347A",
          950: "#0B1F4D",
        },
        // Cam nhấn — chỉ cho CTA chính & nhãn HOT / Khẩn
        accent: {
          DEFAULT: "#FF8A3D",
          dark: "#F2701F",
          strong: "#C2410C",
          light: "#FFF5EE",
          50: "#FFF5EE",
          100: "#FFE9DA",
          500: "#FF8A3D",
          600: "#F2701F",
          700: "#C9560F",
        },
        // Mực navy
        ink: { DEFAULT: "#101727", soft: "#4A5468", muted: "#6A7386", 950: "#0A101E", 800: "#1C2536" },
        navy: { DEFAULT: "#0A1F7A", 700: "#0B2C9F", 900: "#071457", 950: "#040C38" },
        canvas: { DEFAULT: "#F4F6FB", 2: "#EDF1F8" },
        hairline: "#E9EDF5",
        // Xám trung tính theo bảng slate của design system
        gray: colors.slate,
      },
      fontFamily: {
        sans: ["var(--font-be-vietnam)", "\"Be Vietnam Pro\"", "system-ui", "-apple-system", "\"Segoe UI\"", "Roboto", "sans-serif"],
        // Design system dùng một họ chữ cho toàn sản phẩm — giữ tên `serif` để không phải sửa markup cũ
        serif: ["var(--font-be-vietnam)", "\"Be Vietnam Pro\"", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "6px", // ds-r-xs
        DEFAULT: "10px", // ds-r-sm
        md: "12px", // ô nhập (jb-r-control)
        lg: "16px", // thẻ (ctd-radius-card)
        xl: "20px", // thẻ dashboard (jb-r-card)
        "2xl": "24px", // khối lớn (ctd-radius-block)
        "3xl": "28px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(16, 23, 39, 0.05)",
        sm: "0 1px 2px rgba(16, 23, 39, 0.04), 0 6px 18px -10px rgba(16, 23, 39, 0.12)",
        DEFAULT: "0 4px 24px rgba(17, 30, 60, 0.05)",
        md: "0 18px 40px -22px rgba(16, 23, 39, 0.24)",
        lg: "0 30px 70px -30px rgba(16, 23, 39, 0.32)",
        card: "0 4px 24px rgba(17, 30, 60, 0.05)",
        hover: "0 12px 32px -12px rgba(37, 99, 235, 0.25)",
        brand: "0 12px 24px -10px rgba(26, 95, 230, 0.55)",
        accent: "0 12px 24px -10px rgba(236, 102, 24, 0.55)",
        ring: "0 0 0 4px rgba(26, 95, 230, 0.16)",
      },
      backgroundImage: {
        "grad-primary": "linear-gradient(135deg, #1A5FE6 0%, #3B7CF0 100%)",
        "grad-primary-hover": "linear-gradient(135deg, #154DC2 0%, #2C6EEA 100%)",
        "grad-accent": "linear-gradient(135deg, #EC6618 0%, #FF8A3D 100%)",
        "grad-accent-hover": "linear-gradient(135deg, #D85A10 0%, #F57A2C 100%)",
        "grad-ink": "linear-gradient(135deg, #101727 0%, #24324D 100%)",
        "grad-navy": "linear-gradient(135deg, #061454 0%, #0A1F7A 55%, #1B2F9E 100%)",
        "grad-soft": "linear-gradient(135deg, #EEF4FE 0%, #FFF5EE 100%)",
        "grad-duo": "linear-gradient(90deg, #FF8A3D 0%, #FF8A3D 50%, #1A5FE6 50%, #1A5FE6 100%)",
      },
      maxWidth: { container: "1240px" },
      transitionTimingFunction: { ds: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
} satisfies Config;
