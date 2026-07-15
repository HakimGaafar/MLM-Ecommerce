import { cookies } from "next/headers";

export type ThemePreference = "light" | "dark";

export const THEME_COOKIE = "mlm_theme";

export async function getThemePreference(): Promise<ThemePreference> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === "light" ? "light" : "dark";
}
