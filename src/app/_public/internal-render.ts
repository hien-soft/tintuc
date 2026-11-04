/**
 * Render nội bộ cho trang chi tiết bài.
 *
 * App Router không cho page đặt mã trạng thái tùy ý (410). Vì vậy URL công khai của bài viết do route handler
 * phục vụ: handler kiểm tra trạng thái bài, trả 410 cho bài đã gỡ, còn lại lấy HTML từ trang nội bộ
 * `/{locale}/render/...` (chỉ truy cập được khi có header bí mật) và trả nguyên văn về cho trình duyệt.
 */
import { headers } from "next/headers";

export const INTERNAL_HEADER = "x-ttvn-internal-render";

const TOKEN_KEY = "__ttvnInternalRenderToken";

/** Token dùng chung trong cùng tiến trình Node; có thể cố định qua INTERNAL_RENDER_TOKEN khi chạy nhiều instance. */
export function internalToken(): string {
  if (process.env.INTERNAL_RENDER_TOKEN) return process.env.INTERNAL_RENDER_TOKEN;
  const g = globalThis as typeof globalThis & { [TOKEN_KEY]?: string };
  g[TOKEN_KEY] ??= crypto.randomUUID();
  return g[TOKEN_KEY];
}

/** Dùng trong layout của trang nội bộ: true nếu request đến từ route handler. */
export async function isInternalRequest(): Promise<boolean> {
  return (await headers()).get(INTERNAL_HEADER) === internalToken();
}

function internalOrigin(): string {
  return (process.env.INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
}

const FORWARD_RESPONSE_HEADERS = ["content-type", "cache-control", "vary", "link", "x-robots-tag"];

/** Lấy HTML của trang nội bộ và trả về với mã trạng thái mong muốn (mặc định giữ mã của trang). */
export async function proxyRender(req: Request, internalPath: string, status?: number): Promise<Response> {
  const upstream = await fetch(`${internalOrigin()}${internalPath}`, {
    headers: {
      [INTERNAL_HEADER]: internalToken(),
      accept: "text/html",
      "accept-language": req.headers.get("accept-language") ?? "vi",
      "user-agent": req.headers.get("user-agent") ?? "",
    },
    cache: "no-store",
    redirect: "manual",
  });
  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: status ?? upstream.status, headers: out });
}
