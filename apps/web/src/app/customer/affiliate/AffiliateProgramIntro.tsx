"use client";

import { formatAmount, formatCurrencyCode, formatMoney } from "@/lib/format-currency";

export type AffiliateProgramRules = {
  poolPercent: number;
  depth: number;
  levelPercentsOfPool: number[];
  settlementDays: number;
  currency: string;
};

type LevelRow = {
  level: number;
  poolSharePercent: number;
  exampleAmount: string;
};

export type PromoUi = {
  promoHeadline: string;
  promoIntro: string;
  howItWorksTitle: string;
  howItWorks1: string;
  howItWorks2: string;
  howItWorks3: string;
  howItWorks4: string;
  levelsTitle: string;
  levelsColLevel: string;
  levelsColShare: string;
  levelsColExample: string;
  levelsFootnote: string;
  exampleTitle: string;
  exampleBody: string;
  benefitsTitle: string;
  benefit1: string;
  benefit2: string;
  benefit3: string;
  refundsNote: string;
  compactTitle: string;
  compactWhenEarn: string;
  compactRefunds: string;
};

function buildLevelRows(rules: AffiliateProgramRules, locale: "en" | "ar"): LevelRow[] {
  const exampleEligible = 100;
  const pool = (exampleEligible * rules.poolPercent) / 100;

  return rules.levelPercentsOfPool.map((sharePercent, index) => {
    const amount = pool * (sharePercent / 100);
    return {
      level: index + 1,
      poolSharePercent: sharePercent,
      exampleAmount: formatMoney(amount.toFixed(2), rules.currency, locale),
    };
  });
}

function replaceTokens(text: string, rules: AffiliateProgramRules, locale: "en" | "ar"): string {
  const l1 = rules.levelPercentsOfPool[0] ?? 0;
  const l2 = rules.levelPercentsOfPool[1] ?? 0;
  const l3 = rules.levelPercentsOfPool[2] ?? 0;
  const l4 = rules.levelPercentsOfPool[3] ?? 0;
  const exampleEligible = 100;
  const pool = (exampleEligible * rules.poolPercent) / 100;
  const l1Amount = pool * (l1 / 100);

  return text
    .replaceAll("{poolPercent}", String(rules.poolPercent))
    .replaceAll("{depth}", String(rules.depth))
    .replaceAll("{settlementDays}", String(rules.settlementDays))
    .replaceAll("{l1Percent}", String(l1))
    .replaceAll("{l2Percent}", String(l2))
    .replaceAll("{l3Percent}", String(l3))
    .replaceAll("{l4Percent}", String(l4))
    .replaceAll("{l1Example}", formatAmount(l1Amount, locale))
    .replaceAll("{currency}", formatCurrencyCode(rules.currency, locale));
}

function LevelsTable({
  rules,
  locale,
  ui,
}: {
  rules: AffiliateProgramRules;
  locale: "en" | "ar";
  ui: PromoUi;
}) {
  const rows = buildLevelRows(rules, locale);
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <div dir={direction}>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-start text-sm text-[var(--foreground)]">
          <thead className="bg-[var(--table-head-bg)]">
            <tr>
              <th className="px-3 py-2 font-medium">{ui.levelsColLevel}</th>
              <th className="px-3 py-2 font-medium">{ui.levelsColShare}</th>
              <th className="px-3 py-2 font-medium">{ui.levelsColExample}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.level} className="border-t border-[var(--table-row-border)]">
                <td className="px-3 py-2 font-medium">
                  {locale === "ar" ? `المستوى ${row.level}` : `Level ${row.level}`}
                </td>
                <td className="px-3 py-2 tabular-nums">{row.poolSharePercent}%</td>
                <td className="px-3 py-2 tabular-nums text-[var(--muted)]">{row.exampleAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{replaceTokens(ui.levelsFootnote, rules, locale)}</p>
    </div>
  );
}

export function AffiliateProgramIntro({
  variant,
  rules,
  locale,
  ui,
}: {
  variant: "promo" | "compact";
  rules: AffiliateProgramRules;
  locale: "en" | "ar";
  ui: PromoUi;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";

  if (variant === "compact") {
    return (
      <section dir={direction} className="app-callout-primary space-y-3 p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">{ui.compactTitle}</h2>
        <LevelsTable rules={rules} locale={locale} ui={ui} />
        <p className="text-sm text-[var(--foreground)]">{replaceTokens(ui.compactWhenEarn, rules, locale)}</p>
        <p className="text-xs text-[var(--muted)]">{replaceTokens(ui.compactRefunds, rules, locale)}</p>
      </section>
    );
  }

  return (
    <section dir={direction} className="app-callout-primary space-y-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{ui.promoHeadline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {replaceTokens(ui.promoIntro, rules, locale)}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
          {ui.howItWorksTitle}
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-[var(--muted)]">
          <li>{replaceTokens(ui.howItWorks1, rules, locale)}</li>
          <li>{replaceTokens(ui.howItWorks2, rules, locale)}</li>
          <li>{replaceTokens(ui.howItWorks3, rules, locale)}</li>
          <li>{replaceTokens(ui.howItWorks4, rules, locale)}</li>
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {replaceTokens(ui.levelsTitle, rules, locale)}
        </h3>
        <div className="mt-3">
          <LevelsTable rules={rules} locale={locale} ui={ui} />
        </div>
      </div>

      <div className="app-callout-primary-inset p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.exampleTitle}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{replaceTokens(ui.exampleBody, rules, locale)}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{ui.benefitsTitle}</h3>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-[var(--muted)]">
          <li>{ui.benefit1}</li>
          <li>{ui.benefit2}</li>
          <li>{replaceTokens(ui.benefit3, rules, locale)}</li>
        </ul>
      </div>

      <p className="text-xs text-[var(--muted)]">{replaceTokens(ui.refundsNote, rules, locale)}</p>
    </section>
  );
}
