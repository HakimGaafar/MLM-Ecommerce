"use client";

import { FormEvent, useState } from "react";

type ContactUi = {
  formTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successMessage: string;
  error: string;
  rateLimited: string;
  privacy: string;
  required: string;
};

export default function ContactForm({
  locale,
  ui,
}: {
  locale: "en" | "ar";
  ui: ContactUi;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
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
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });

      if (!response.ok) {
        setError(response.status === 429 ? ui.rateLimited : ui.error);
        return;
      }

      form.reset();
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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-semibold">{ui.formTitle}</h2>
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            {ui.firstName} {required}
            <input
              className="app-input mt-1.5"
              name="firstName"
              autoComplete="given-name"
              required
              minLength={1}
              maxLength={80}
              pattern="[\p{L}\p{M}][\p{L}\p{M} .'\-]*"
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </label>
          <label className="text-sm font-medium">
            {ui.lastName} {required}
            <input
              className="app-input mt-1.5"
              name="lastName"
              autoComplete="family-name"
              required
              minLength={1}
              maxLength={80}
              pattern="[\p{L}\p{M}][\p{L}\p{M} .'\-]*"
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          {ui.email} {required}
          <input
            className="app-input mt-1.5"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            dir="ltr"
          />
        </label>

        <label className="block text-sm font-medium">
          {ui.message} {required}
          <textarea
            className="app-input mt-1.5 min-h-40 resize-y"
            name="message"
            required
            minLength={10}
            maxLength={4000}
            placeholder={ui.messagePlaceholder}
            dir={locale === "ar" ? "rtl" : "ltr"}
          />
        </label>

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
