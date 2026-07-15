#!/usr/bin/env node
/**
 * Phase XII6 load smoke — run against staging when accounts are ready.
 * Usage: BASE_URL=https://staging.example.com CONCURRENT=200 npm run test:load:xii6
 */
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const concurrent = Math.max(1, Number.parseInt(process.env.CONCURRENT ?? "200", 10));
const durationSec = Math.max(10, Number.parseInt(process.env.DURATION_SEC ?? "60", 10));
const p95MaxMs = Number.parseInt(process.env.P95_MAX_MS ?? "2000", 10);
const errorRateMax = Number.parseFloat(process.env.ERROR_RATE_MAX ?? "0.02");

const paths = [
  "/api/v1/health/live",
  "/api/v1/catalog/categories",
  "/api/v1/catalog/products?page=1&pageSize=12",
  "/login",
];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function oneRequest(path) {
  const start = performance.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
    const ms = performance.now() - start;
    return { ok: res.ok, ms, status: res.status };
  } catch {
    return { ok: false, ms: performance.now() - start, status: 0 };
  }
}

async function worker(results, stopAt) {
  let i = 0;
  while (Date.now() < stopAt) {
    const path = paths[i % paths.length];
    i += 1;
    results.push(await oneRequest(path));
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function main() {
  console.log(`Load test → ${baseUrl} | concurrent=${concurrent} | duration=${durationSec}s`);

  const results = [];
  const stopAt = Date.now() + durationSec * 1000;
  const workers = Array.from({ length: concurrent }, () => worker(results, stopAt));
  await Promise.all(workers);

  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const failures = results.filter((r) => !r.ok).length;
  const errorRate = results.length > 0 ? failures / results.length : 1;
  const p95 = percentile(latencies, 95);

  const report = {
    baseUrl,
    concurrent,
    durationSec,
    totalRequests: results.length,
    failures,
    errorRate: Number(errorRate.toFixed(4)),
    p95Ms: Math.round(p95),
    thresholds: { p95MaxMs, errorRateMax },
    pass: p95 <= p95MaxMs && errorRate <= errorRateMax,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
