import { unstable_cache } from "next/cache";
import { getCustomerDashboardOverview } from "@mlm/domain";
import { getQueueRedis } from "@mlm/queue";

const DASHBOARD_TTL_SECONDS = 120;

function dashboardCacheKey(buyerUserId: string, locale: "en" | "ar", marketId: string) {
  return `customer-dashboard:${buyerUserId}:${locale}:${marketId}`;
}

async function fetchDashboard(buyerUserId: string, locale: "en" | "ar", marketId: string) {
  return unstable_cache(
    async () => getCustomerDashboardOverview(buyerUserId, locale, marketId),
    ["customer-dashboard-overview", buyerUserId, locale, marketId],
    { revalidate: DASHBOARD_TTL_SECONDS },
  )();
}

export async function getCachedCustomerDashboardOverview(
  buyerUserId: string,
  locale: "en" | "ar",
  marketId: string,
) {
  const key = dashboardCacheKey(buyerUserId, locale, marketId);

  try {
    const redis = getQueueRedis();
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Awaited<ReturnType<typeof getCustomerDashboardOverview>>;
    }
  } catch {
    // Redis optional locally — fall through to Next cache layer.
  }

  const data = await fetchDashboard(buyerUserId, locale, marketId);

  try {
    const redis = getQueueRedis();
    await redis.setex(key, DASHBOARD_TTL_SECONDS, JSON.stringify(data));
  } catch {
    // ignore
  }

  return data;
}

export async function invalidateCustomerDashboardCache(
  buyerUserId: string,
  locale: "en" | "ar",
  marketId: string,
) {
  try {
    const redis = getQueueRedis();
    await redis.del(dashboardCacheKey(buyerUserId, locale, marketId));
  } catch {
    // ignore
  }
}
