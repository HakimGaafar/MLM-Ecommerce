import Link from "next/link";
import type { LoadedPublicLegalPage } from "@/lib/legal/load-public-legal-page";
import { PUBLIC_LEGAL_SLUGS } from "@/lib/legal/slugs";

type Labels = {
  version: string;
  draftNote: string;
  publishedOn: string;
  otherPolicies: string;
  backHome: string;
  policyLabels: Record<string, string>;
};

export default function LegalPolicyPageView({
  page,
  labels,
  direction,
}: {
  page: LoadedPublicLegalPage;
  labels: Labels;
  direction: "ltr" | "rtl";
}) {
  const publishedLabel = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString(page.locale === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14" dir={direction}>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {labels.version} {page.version}
            {page.isPublished && publishedLabel
              ? ` · ${labels.publishedOn} ${publishedLabel}`
              : ` · ${labels.draftNote}`}
            {` · ${page.marketCode}`}
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-link">
          {labels.backHome}
        </Link>
      </div>

      <article className="space-y-8">
        {page.document.sections.map((section) => (
          <section key={section.id} className="space-y-3">
            {section.heading ? (
              <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            ) : null}
            {section.paragraphs?.map((paragraph, idx) => (
              <p
                key={`${section.id}-p-${idx}`}
                className="text-sm leading-7 text-[color-mix(in_srgb,var(--foreground)_92%,var(--muted))] sm:text-[0.95rem] sm:leading-8"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="list-disc space-y-2 ps-5 text-sm leading-7 sm:text-[0.95rem]">
                {section.bullets.map((bullet, idx) => (
                  <li key={`${section.id}-b-${idx}`}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>

      <nav className="mt-12 border-t border-[var(--border)] pt-6" aria-label={labels.otherPolicies}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {labels.otherPolicies}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm">
          {PUBLIC_LEGAL_SLUGS.filter((slug) => slug !== page.slug).map((slug) => (
            <li key={slug}>
              <Link href={`/${slug}`} className="text-link">
                {labels.policyLabels[slug] ?? slug}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
