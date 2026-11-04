"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  changePasswordAction,
  confirm2faAction,
  disable2faAction,
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  verify2faAction,
  type FormState,
} from "@/app/Admin/_actions/auth";
import { SubmitButton } from "./forms";
import { Alert, inputCls, labelCls } from "./ui";

/** Ô mật khẩu có nút Hiện/Ẩn để kiểm tra ký tự đã gõ. */
function PasswordInput({ id, name = id, autoComplete }: { id: string; name?: string; autoComplete?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input className={`${inputCls} pr-16`} id={id} name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} required />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-controls={id}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-gray-500 hover:text-brand focus:outline-none focus-visible:text-brand"
      >
        {shown ? "Ẩn" : "Hiện"}
      </button>
    </div>
  );
}

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.success && <Alert kind="success">{state.success}</Alert>}
    </>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <div>
        <label className={labelCls} htmlFor="email">Email</label>
        <input className={inputCls} id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className={labelCls} htmlFor="password">Mật khẩu</label>
        <PasswordInput id="password" autoComplete="current-password" />
      </div>
      {state.captcha && (
        <div>
          <label className={labelCls} htmlFor="captchaAnswer">Mã xác nhận: <strong>{state.captcha.question}</strong></label>
          <input type="hidden" name="captchaToken" value={state.captcha.token} />
          <input className={inputCls} id="captchaAnswer" name="captchaAnswer" inputMode="numeric" required />
        </div>
      )}
      <SubmitButton className="w-full">Đăng nhập</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/Admin/forgot-password" className="text-brand hover:underline">Quên mật khẩu?</Link>
      </p>
    </form>
  );
}

export function TwoFactorForm() {
  const [state, action] = useActionState(verify2faAction, {});
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <div>
        <label className={labelCls} htmlFor="code">Mã 6 số từ ứng dụng xác thực, hoặc mã dự phòng</label>
        <input className={`${inputCls} text-center text-lg tracking-[0.4em]`} id="code" name="code" autoComplete="one-time-code" required autoFocus maxLength={12} />
      </div>
      <SubmitButton className="w-full">Xác thực</SubmitButton>
      <p className="text-center text-sm"><Link href="/Admin/login" className="text-gray-500 hover:underline">← Quay lại đăng nhập</Link></p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <div>
        <label className={labelCls} htmlFor="email">Email tài khoản</label>
        <input className={inputCls} id="email" name="email" type="email" required autoFocus />
      </div>
      <SubmitButton className="w-full">Gửi liên kết đặt lại</SubmitButton>
      <p className="text-center text-sm"><Link href="/Admin/login" className="text-gray-500 hover:underline">← Quay lại đăng nhập</Link></p>
    </form>
  );
}

const PASSWORD_HINT = "Tối thiểu 10 ký tự, gồm chữ hoa, chữ thường và chữ số.";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, {});
  if (state.success) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{state.success}</Alert>
        <Link href="/Admin/login" className="block text-center text-sm text-brand hover:underline">Đến trang đăng nhập</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <input type="hidden" name="token" value={token} />
      <div>
        <label className={labelCls} htmlFor="password">Mật khẩu mới</label>
        <PasswordInput id="password" autoComplete="new-password" />
        <p className="mt-1 text-xs text-gray-500">{PASSWORD_HINT}</p>
      </div>
      <div>
        <label className={labelCls} htmlFor="confirm">Nhập lại mật khẩu</label>
        <PasswordInput id="confirm" autoComplete="new-password" />
      </div>
      <SubmitButton className="w-full">Đặt lại mật khẩu</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <div>
        <label className={labelCls} htmlFor="current">Mật khẩu hiện tại</label>
        <PasswordInput id="current" autoComplete="current-password" />
      </div>
      <div>
        <label className={labelCls} htmlFor="password">Mật khẩu mới</label>
        <PasswordInput id="password" autoComplete="new-password" />
        <p className="mt-1 text-xs text-gray-500">{PASSWORD_HINT}</p>
      </div>
      <div>
        <label className={labelCls} htmlFor="confirm">Nhập lại mật khẩu mới</label>
        <PasswordInput id="confirm" autoComplete="new-password" />
      </div>
      <SubmitButton>Đổi mật khẩu</SubmitButton>
    </form>
  );
}

export function Setup2faForm({ qr, secret }: { qr: string; secret: string }) {
  const [state, action] = useActionState(confirm2faAction, {});
  if (state.backupCodes) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{state.success}</Alert>
        <ul className="grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-3 font-mono text-sm">
          {state.backupCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <Link href="/Admin" className="block text-center text-sm font-semibold text-brand hover:underline">Vào trang quản trị →</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <Messages state={state} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
        <li>Mở ứng dụng xác thực (Google Authenticator, Microsoft Authenticator...).</li>
        <li>Quét mã QR hoặc nhập khóa bí mật bên dưới.</li>
        <li>Nhập mã 6 số mà ứng dụng hiển thị.</li>
      </ol>
      <div className="flex flex-col items-center gap-2">
        <img src={qr} alt="Mã QR thiết lập xác thực 2 lớp" width={180} height={180} />
        <code className="break-all rounded bg-gray-100 px-2 py-1 text-xs">{secret}</code>
      </div>
      <div>
        <label className={labelCls} htmlFor="code">Mã 6 số</label>
        <input className={`${inputCls} text-center tracking-[0.4em]`} id="code" name="code" inputMode="numeric" maxLength={6} required />
      </div>
      <SubmitButton className="w-full">Bật xác thực 2 lớp</SubmitButton>
    </form>
  );
}

export function Disable2faForm() {
  const [state, action] = useActionState(disable2faAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="w-full"><Messages state={state} /></div>
      <div>
        <label className={labelCls} htmlFor="pw2fa">Xác nhận mật khẩu</label>
        <PasswordInput id="pw2fa" name="password" />
      </div>
      <SubmitButton variant="default">Tắt 2FA</SubmitButton>
    </form>
  );
}
