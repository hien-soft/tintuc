"use client";

import { useEffect } from "react";

/** Đặt thuộc tính lang của <html> theo locale (root layout luôn tĩnh là "vi"). */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
