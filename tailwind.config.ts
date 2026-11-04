import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#b3121b", dark: "#8a0e15", light: "#fdecec" },
        ink: { DEFAULT: "#1f2328", soft: "#57606a" },
      },
      fontFamily: { sans: ["Arial", "Helvetica", "sans-serif"], serif: ["\"Noto Serif\"", "\"Times New Roman\"", "Times", "serif"] },
    },
  },
  plugins: [],
} satisfies Config;
