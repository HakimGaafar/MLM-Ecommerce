import Script from "next/script";
import type { ThemePreference } from "@/lib/theme-preference";

/** Applies theme class before hydration (root layout). */
export default function ThemeScript({ theme }: { theme: ThemePreference }) {
  const code = `(function(){try{var t=${JSON.stringify(theme)};document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;
  return (
    <Script id="theme-init" strategy="beforeInteractive">
      {code}
    </Script>
  );
}
