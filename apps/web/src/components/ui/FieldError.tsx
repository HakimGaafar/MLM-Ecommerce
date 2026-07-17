"use client";

import { useAppLocale } from "@/components/providers/LocaleProvider";

export default function FieldError({ id, message }: { id?: string; message?: string | null }) {
  const locale = useAppLocale();
  if (!message) return null;
  return (
    <p
      id={id}
      className="app-field-error"
      role="alert"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {message}
    </p>
  );
}
