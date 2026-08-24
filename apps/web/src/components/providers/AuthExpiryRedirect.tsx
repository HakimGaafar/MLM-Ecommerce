"use client";

import { useEffect } from "react";
import { isAuthLandingPath, loginPathForRequestPath } from "@/lib/auth-login-path";

const IGNORE_401_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/merchant/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function shouldIgnoreUnauthorized(url: string): boolean {
  return IGNORE_401_PATHS.some((path) => url.includes(path));
}

function isAppApiRequest(url: string): boolean {
  return url.startsWith("/api/") || url.includes("/api/");
}

/** When a session expires mid-page, send the user to the matching login instead of showing "Unauthorized". */
export default function AuthExpiryRedirect() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      if (res.status !== 401) return res;
      const url = requestUrl(input);
      if (!isAppApiRequest(url) || shouldIgnoreUnauthorized(url)) return res;
      const here = window.location.pathname;
      if (isAuthLandingPath(here)) return res;
      window.location.replace(loginPathForRequestPath(here));
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
