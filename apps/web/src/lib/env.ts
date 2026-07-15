import { z } from "zod";

function isLocalAppBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32).optional(),
    AUTH_COOKIE_NAME: z.string().min(3).default("mlm_session"),
    AUTH_REFRESH_COOKIE_NAME: z.string().min(3).default("mlm_refresh"),
    APP_BASE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_NAME: z.string().default("Fources"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;
    if (!data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET is required in production.",
      });
      return;
    }
    if (data.JWT_REFRESH_SECRET === data.JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must differ from JWT_SECRET in production.",
      });
    }
    // `next build` sets NODE_ENV=production even locally; allow http on localhost.
    if (!isLocalAppBaseUrl(data.APP_BASE_URL) && !data.APP_BASE_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_BASE_URL"],
        message: "APP_BASE_URL must use https for deployed environments.",
      });
    }
  });

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME: process.env.AUTH_REFRESH_COOKIE_NAME,
  APP_BASE_URL: process.env.APP_BASE_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});
