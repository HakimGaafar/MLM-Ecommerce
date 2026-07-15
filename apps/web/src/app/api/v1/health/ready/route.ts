import { prisma } from "@mlm/db";
import { pingQueueRedis } from "@mlm/queue";
import { NextResponse } from "next/server";

/** Readiness — DB + Redis required before accepting traffic. */
export async function GET() {
  const checks = { database: false, redis: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    const pong = await pingQueueRedis();
    checks.redis = pong === "PONG";
  } catch {
    checks.redis = false;
  }

  const ok = checks.database && checks.redis;
  return NextResponse.json(
    {
      ok,
      status: ok ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
