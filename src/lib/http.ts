/**
 * Redirect với `Location` tương đối — dùng trong route handler. Next.js chuẩn hóa host 127.0.0.1 thành
 * "localhost" trong req.url, nên URL tuyệt đối dựng từ req.url có thể đưa người dùng sang host khác (mất cookie phiên).
 */
export function relativeRedirect(location: string, status: 302 | 307 | 308 = 307): Response {
  return new Response(null, { status, headers: { Location: location } });
}
