import { getQueueRedis } from "@mlm/queue";

const REFRESH_SESSION_PREFIX = "auth:refresh:";
const REFRESH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function refreshSessionKey(userId: string) {
  return `${REFRESH_SESSION_PREFIX}${userId}`;
}

export async function setActiveRefreshJti(userId: string, jti: string): Promise<void> {
  const redis = getQueueRedis();
  await redis.set(refreshSessionKey(userId), jti, "EX", REFRESH_SESSION_TTL_SECONDS);
}

export async function getActiveRefreshJti(userId: string): Promise<string | null> {
  const redis = getQueueRedis();
  return redis.get(refreshSessionKey(userId));
}

/** Returns true when the presented jti matches the active session. */
export async function verifyActiveRefreshJti(userId: string, jti: string): Promise<boolean> {
  const active = await getActiveRefreshJti(userId);
  return active === jti;
}

/** Clears rotation state (logout or suspected token reuse). */
export async function clearRefreshSession(userId: string): Promise<void> {
  const redis = getQueueRedis();
  await redis.del(refreshSessionKey(userId));
}
