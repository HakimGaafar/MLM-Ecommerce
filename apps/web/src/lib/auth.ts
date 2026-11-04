import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { getSessionAccessMinutes } from "@mlm/domain";
import { env } from "./env";
import { getCurrentTokenVersion } from "./session-invalidation";

export type SessionPayload = {
  sub: string;
  roles: string[];
  email: string;
  /** User.tokenVersion at issue time — must match DB/Redis or token is rejected. */
  tv: number;
};

type TokenType = "access" | "refresh";

type TokenPayload = SessionPayload & {
  tokenType: TokenType;
  jti?: string;
};

export type RefreshTokenResult = {
  token: string;
  jti: string;
};

const encoder = new TextEncoder();

const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "vandsoq";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE?.trim() || "vandsoq-web";

const refreshMaxAgeSeconds = 60 * 60 * 24 * 30;
const DEFAULT_ACCESS_MINUTES = 15;
/** Hard ceiling — platform config must not mint year-long access tokens. */
const MAX_ACCESS_MINUTES_PROD = 60;
const MAX_ACCESS_MINUTES_DEV = 60 * 24;

function signToken(
  payload: SessionPayload & { jti?: string },
  tokenType: TokenType,
  expiresIn: string,
  secret: string,
) {
  return new SignJWT({ ...payload, tokenType })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret));
}

function verifyToken(token: string, tokenType: TokenType, secret: string) {
  return jwtVerify(token, encoder.encode(secret), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }).then(({ payload }) => {
    const tokenPayload = payload as TokenPayload;
    if (tokenPayload.tokenType !== tokenType) {
      throw new Error("Invalid token type");
    }
    return tokenPayload;
  });
}

async function resolveAccessMinutes(): Promise<number> {
  const hardMax =
    process.env.NODE_ENV === "production" ? MAX_ACCESS_MINUTES_PROD : MAX_ACCESS_MINUTES_DEV;
  try {
    const minutes = await getSessionAccessMinutes();
    return Math.min(Math.max(minutes, 5), hardMax);
  } catch {
    const fromEnv = Number.parseInt(process.env.SESSION_ACCESS_MINUTES ?? "", 10);
    if (Number.isFinite(fromEnv) && fromEnv >= 5) return Math.min(fromEnv, hardMax);
    return DEFAULT_ACCESS_MINUTES;
  }
}

export async function createAccessToken(payload: SessionPayload) {
  const minutes = await resolveAccessMinutes();
  return signToken(payload, "access", `${minutes}m`, env.JWT_SECRET);
}

export async function createRefreshToken(payload: SessionPayload): Promise<RefreshTokenResult> {
  const jti = randomUUID();
  const token = await signToken(
    { ...payload, jti },
    "refresh",
    "30d",
    env.JWT_REFRESH_SECRET ?? env.JWT_SECRET,
  );
  return { token, jti };
}

function normalizeSessionPayload(payload: TokenPayload): SessionPayload {
  const tv = typeof payload.tv === "number" && Number.isFinite(payload.tv) ? payload.tv : 0;
  return {
    sub: payload.sub,
    email: payload.email,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    tv,
  };
}

async function assertTokenVersion(session: SessionPayload): Promise<void> {
  const current = await getCurrentTokenVersion(session.sub);
  if (current !== session.tv) {
    throw new Error("Token revoked");
  }
}

export async function verifyAccessToken(token: string) {
  const payload = await verifyToken(token, "access", env.JWT_SECRET);
  const session = normalizeSessionPayload(payload);
  await assertTokenVersion(session);
  return session;
}

export async function verifyRefreshToken(token: string) {
  const payload = await verifyToken(token, "refresh", env.JWT_REFRESH_SECRET ?? env.JWT_SECRET);
  if (!payload.jti || typeof payload.jti !== "string") {
    throw new Error("Invalid refresh token");
  }
  const session = normalizeSessionPayload(payload);
  await assertTokenVersion(session);
  return { ...session, jti: payload.jti };
}

export function getAccessTokenFromRequest(request: NextRequest) {
  return request.cookies.get(env.AUTH_COOKIE_NAME)?.value;
}

export function getRefreshTokenFromRequest(request: NextRequest) {
  return request.cookies.get(env.AUTH_REFRESH_COOKIE_NAME)?.value;
}

export async function setAuthCookies(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  accessToken: string,
  refreshToken: string,
) {
  const accessMinutes = await resolveAccessMinutes();
  const accessMaxAgeSeconds = accessMinutes * 60;
  const commonOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookies.set(env.AUTH_COOKIE_NAME, accessToken, {
    ...commonOptions,
    maxAge: accessMaxAgeSeconds,
  });

  response.cookies.set(env.AUTH_REFRESH_COOKIE_NAME, refreshToken, {
    ...commonOptions,
    maxAge: refreshMaxAgeSeconds,
  });
}

export function clearAuthCookies(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
  };

  response.cookies.set(env.AUTH_COOKIE_NAME, "", options);
  response.cookies.set(env.AUTH_REFRESH_COOKIE_NAME, "", options);
}

// Backward-compatible aliases for existing code.
export const createSessionToken = createAccessToken;

export async function verifySessionToken(token: string) {
  return verifyAccessToken(token);
}
