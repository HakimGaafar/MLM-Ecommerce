import { Prisma } from "@prisma/client";

/** Prisma unique-constraint violation (concurrent create / upsert race). */
export function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Runs an upsert safely when concurrent requests race on the same unique key.
 * Retries the upsert once (second attempt usually hits `update`), then falls back to `findUnique`.
 */
export async function raceSafeUpsert<T>(options: {
  upsert: () => Promise<T>;
  findUnique: () => Promise<T | null>;
}): Promise<T> {
  try {
    return await options.upsert();
  } catch (error) {
    if (!isPrismaUniqueViolation(error)) throw error;

    try {
      return await options.upsert();
    } catch (retryError) {
      if (!isPrismaUniqueViolation(retryError)) throw retryError;
      const existing = await options.findUnique();
      if (!existing) throw retryError;
      return existing;
    }
  }
}
