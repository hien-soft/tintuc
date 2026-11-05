import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `CMS – ${SITE_NAME}`, template: `%s – CMS ${SITE_NAME}` },
  robots: { index: false, follow: false },
};

export default function CmsRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
