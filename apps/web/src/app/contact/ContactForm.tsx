"use client";

import { FormEvent, useState } from "react";
import { LocalizedFieldError, useLiveCopy, useLiveLocale } from "@/components/ui/live-i18n";
import {
  inputClassName,
  isValidEmail,
  PERSON_NAME_PATTERN,
} from "@/lib/field-validation";

type FieldKey = "firstName" | "lastName" | "email" | "message";
type ErrorKey = "fieldRequired" | "invalidName" | "invalidEmail" | "invalidMessage";

export default function ContactForm({
  locale: _serverLocale,
}: {
  locale: "en" | "ar";
  ui?: unknown;
}) {
  const locale = useLiveLocale();
  const ui = useLiveCopy("contactPage");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, ErrorKey>>>({});

  function validateField(field: FieldKey, nextValue = values[field]): ErrorKey | null {
    const value = nextValue.trim();
    if (!value) return "fieldRequired";

    if (field === "firstName" || field === "lastName") {
      if (value.length > 80 || !PERSON_NAME_PATTERN.test(value)) return "invalidName";
      return null;
    }

    if (field === "email") {
      return isValidEmail(value) ? null : "invalidEmail";
    }

    if (value.length < 10 || value.length > 4000) return "invalidMessage";
    if (/<\/?[a-z][^>]*>/iu.test(value)) return "invalidMessage";
    return null;
  }

  function showFieldError(field: FieldKey, nextValue = values[field]) {
    const key = validateField(field, nextValue);
    setFieldErrors((current) => {
      if (!key) {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      }
      return { ...current, [field]: key };
    });
    return key;
  }

  function setValue(field: FieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) showFieldError(field, value);
  }

  function validateAll() {
    const nextErrors: Partial<Record<FieldKey, ErrorKey>> = {};
    (["firstName", "lastName", "email", "message"] as const).forEach((field) => {
      const key = validateField(field);
      if (key) nextErrors[field] = key;
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!validateAll()) return;

    setSubmitting(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/v1/public/contact-inquiries", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          message: values.message,
          website: data.get("website"),
        }),
      });

      if (!response.ok) {
        setError(response.status === 429 ? ui.rateLimited : ui.error);
        return;
      }

      form.reset();
      setValues({ firstName: "", lastName: "", email: "", message: "" });
      setFieldErrors({});
      setSuccess(true);
    } catch {
      setError(ui.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section
        className="rounded-2xl border border-[color-mix(in_srgb,var(--success)_45%,var(--border))] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface))] p-6 shadow-sm"
        role="status"
        lang={locale}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <h2 className="text-xl font-semibold text-[var(--success)]">{ui.successTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{ui.successMessage}</p>
      </section>
    );
  }

  const required = (
    <span className="text-[var(--danger)]" aria-label={ui.required}>
      *
    </span>
  );

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-7"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <h2 className="text-xl font-semibold">{ui.formTitle}</h2>
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="contact-first-name">
              {ui.firstName} {required}
            </label>
            <input
              id="contact-first-name"
              className={inputClassName(Boolean(fieldErrors.firstName))}
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={80}
              value={values.firstName}
              aria-invalid={Boolean(fieldErrors.firstName)}
              aria-describedby={fieldErrors.firstName ? "contact-first-name-error" : undefined}
              onChange={(event) => setValue("firstName", event.target.value)}
              onBlur={() => showFieldError("firstName")}
            />
            <LocalizedFieldError
              id="contact-first-name-error"
              message={fieldErrors.firstName ? ui[fieldErrors.firstName] : null}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="contact-last-name">
              {ui.lastName} {required}
            </label>
            <input
              id="contact-last-name"
              className={inputClassName(Boolean(fieldErrors.lastName))}
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={80}
              value={values.lastName}
              aria-invalid={Boolean(fieldErrors.lastName)}
              aria-describedby={fieldErrors.lastName ? "contact-last-name-error" : undefined}
              onChange={(event) => setValue("lastName", event.target.value)}
              onBlur={() => showFieldError("lastName")}
            />
            <LocalizedFieldError
              id="contact-last-name-error"
              message={fieldErrors.lastName ? ui[fieldErrors.lastName] : null}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="contact-email">
            {ui.email} {required}
          </label>
          <input
            id="contact-email"
            className={inputClassName(Boolean(fieldErrors.email))}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            value={values.email}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
            dir="ltr"
            onChange={(event) => setValue("email", event.target.value)}
            onBlur={() => showFieldError("email")}
          />
          <LocalizedFieldError
            id="contact-email-error"
            message={fieldErrors.email ? ui[fieldErrors.email] : null}
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="contact-message">
            {ui.message} {required}
          </label>
          <textarea
            id="contact-message"
            className={inputClassName(Boolean(fieldErrors.message), "min-h-40 resize-y")}
            name="message"
            required
            maxLength={4000}
            placeholder={ui.messagePlaceholder}
            value={values.message}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
            onChange={(event) => setValue("message", event.target.value)}
            onBlur={() => showFieldError("message")}
          />
          <LocalizedFieldError
            id="contact-message-error"
            message={fieldErrors.message ? ui[fieldErrors.message] : null}
          />
        </div>

        <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-[var(--muted)]">{ui.privacy}</p>
          <button className="btn-primary min-w-36" type="submit" disabled={submitting}>
            {submitting ? ui.submitting : ui.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
