import { Suspense } from "react";
import { redirect } from "next/navigation";
import ResetPasswordForm from "./ResetPasswordForm";
import { getAppLocale } from "@/lib/ui-locale";

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (!token) {
    redirect("/forgot-password");
  }

  const locale = await getAppLocale();
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16">
          <section className="app-card w-full p-6">
            <p className="text-sm text-[var(--muted)]">…</p>
          </section>
        </main>
      }
    >
      <ResetPasswordForm initialLocale={locale} />
    </Suspense>
  );
}
