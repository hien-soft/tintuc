"use client";

import { useFormStatus } from "react-dom";
import { btnCls } from "./ui";

export function SubmitButton({ children, variant = "primary", className = "", name, value }: { children: React.ReactNode; variant?: keyof typeof btnCls; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${btnCls[variant]} ${className}`}>
      {pending ? "Đang xử lý..." : children}
    </button>
  );
}

export function ConfirmSubmit({ children, message, variant = "default" }: { children: React.ReactNode; message: string; variant?: keyof typeof btnCls }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={btnCls[variant]}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
