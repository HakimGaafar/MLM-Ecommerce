import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";

export type ToastLocale = "en" | "ar";
export type ToastDict = (typeof en)["toast"];

export function getToastDict(locale: ToastLocale): ToastDict {
  return locale === "ar" ? ar.toast : en.toast;
}

export function apiErrorMessage(
  payload: { error?: string } | null | undefined,
  fallback: string,
): string {
  const msg = payload?.error?.trim();
  return msg || fallback;
}

export async function readApiError(res: Response, fallback: string): Promise<string> {
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  return apiErrorMessage(payload, fallback);
}
