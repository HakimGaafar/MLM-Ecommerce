import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { env } from "./env";

export type SessionPayload = {
  sub: string;
  roles: string[];
  email: string;
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

const accessMaxAgeSeconds = 60 * 15;
const refreshMaxAgeSeconds = 60 * 60 * 24 * 30;

function signToken(
  payload: SessionPayload & { jti?: string },
  tokenType: TokenType,
  expiresIn: string,
  secret: string,
) {
  return new SignJWT({ ...payload, tokenType })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret));
}

function verifyToken(token: string, tokenType: TokenType, secret: string) {
  return jwtVerify(token, encoder.encode(secret)).then(({ payload }) => {
    const tokenPayload = payload as TokenPayload;
    if (tokenPayload.tokenType !== tokenType) {
      throw new Error("Invalid token type");
    }
    return tokenPayload;
  });
}

export async function createAccessToken(payload: SessionPayload) {
  return signToken(payload, "access", "15m", env.JWT_SECRET);
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
  return {
    sub: payload.sub,
    email: payload.email,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
  };
}

export async function verifyAccessToken(token: string) {
  const payload = await verifyToken(token, "access", env.JWT_SECRET);
  return normalizeSessionPayload(payload);
}

export async function verifyRefreshToken(token: string) {
  const payload = await verifyToken(token, "refresh", env.JWT_REFRESH_SECRET ?? env.JWT_SECRET);
  if (!payload.jti || typeof payload.jti !== "string") {
    throw new Error("Invalid refresh token");
  }
  return { ...normalizeSessionPayload(payload), jti: payload.jti };
}

export function getAccessTokenFromRequest(request: NextRequest) {
  return request.cookies.get(env.AUTH_COOKIE_NAME)?.value;
}

export function getRefreshTokenFromRequest(request: NextRequest) {
  return request.cookies.get(env.AUTH_REFRESH_COOKIE_NAME)?.value;
}

export function setAuthCookies(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  accessToken: string,
  refreshToken: string,
) {
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

export function getSessionTokenFromRequest(request: NextRequest) {
  return getAccessTokenFromRequest(request);
}
