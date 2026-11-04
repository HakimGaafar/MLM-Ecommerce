import { prisma } from "@mlm/db";
import { getQueueRedis } from "@mlm/queue";
import { clearRefreshSession } from "@/lib/refresh-session";

const TOKEN_VERSION_PREFIX = "auth:tv:";
const TOKEN_VERSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function tokenVersionKey(userId: string) {
  return `${TOKEN_VERSION_PREFIX}${userId}`;
}

/** Cache the current DB tokenVersion so access-token checks stay cheap. */
export async function cacheTokenVersion(userId: string, tokenVersion: number): Promise<void> {
  try {
    const redis = getQueueRedis();
    await redis.set(tokenVersionKey(userId), String(tokenVersion), "EX", TOKEN_VERSION_TTL_SECONDS);
  } catch {
    /* Redis optional in some local setups — verify path falls back to DB. */
  }
}

export async function getCurrentTokenVersion(userId: string): Promise<number> {
  try {
    const redis = getQueueRedis();
    const cached = await redis.get(tokenVersionKey(userId));
    if (cached != null && cached !== "") {
      const parsed = Number.parseInt(cached, 10);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    /* fall through to DB */
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new Error("Session revoked");
  }

  await cacheTokenVersion(userId, user.tokenVersion);
  return user.tokenVersion;
}

/**
 * Kill all sessions for a user: bump tokenVersion (invalidates access JWTs)
 * and clear the active refresh jti.
 */
export async function invalidateUserSessions(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });

  try {
    await clearRefreshSession(userId);
  } catch {
    /* Redis may be unavailable; tokenVersion bump still revokes access JWTs. */
  }

  await cacheTokenVersion(userId, updated.tokenVersion);
  return updated.tokenVersion;
}
