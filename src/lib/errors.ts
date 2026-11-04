export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "LOCKED"
  | "INVALID_TRANSITION"
  | "SELF_REVIEW_NOT_ALLOWED";

const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Bạn cần đăng nhập để tiếp tục.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  VALIDATION_ERROR: "Dữ liệu không hợp lệ.",
  CONFLICT: "Bài viết đã được người khác cập nhật. Vui lòng tải lại trang.",
  LOCKED: "Bài viết đang được người khác chỉnh sửa.",
  INVALID_TRANSITION: "Thao tác không hợp lệ với trạng thái hiện tại của bài.",
  SELF_REVIEW_NOT_ALLOWED: "Bạn không được duyệt bài do chính mình viết hoặc đã duyệt ở cấp trước.",
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: string[],
  ) {
    super(message ?? MESSAGES[code]);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; details?: string[] };

/** Bọc server action: chuyển AppError thành kết quả hiển thị được ở client. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, code: e.code, message: e.message, details: e.details };
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return { ok: false, code: "VALIDATION_ERROR", message: "Đã có lỗi xảy ra, vui lòng thử lại." };
  }
}
