import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["vi", "en"];

/**
 * Không redirect ở đây: Next.js chuẩn hóa Location 127.0.0.1 → localhost trong middleware, làm mất cookie phiên
 * khi truy cập qua IP. `/` → `/vi` khai báo trong next.config.ts; chặn /Admin chưa đăng nhập do requireUser() ở server.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const adminPath = /^\/admin(?=\/|$)/i.exec(pathname);
  if (adminPath) {
    const allowed = (process.env.CMS_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    if (allowed.length && !allowed.includes(ip)) return new NextResponse("Forbidden", { status: 403 });
    // Route là /Admin (phân biệt hoa thường); /admin, /ADMIN... được rewrite nội bộ thay vì redirect.
    const res =
      adminPath[0] === "/Admin"
        ? NextResponse.next()
        : NextResponse.rewrite(new URL(`/Admin${pathname.slice(adminPath[0].length)}${req.nextUrl.search}`, req.url));
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const first = pathname.split("/")[1];
  if (LOCALES.includes(first)) {
    const headers = new Headers(req.headers);
    headers.set("x-locale", first);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|media|api|favicon.ico|robots.txt|sitemap.xml|news-sitemap.xml).*)"],
};
