import LoginForm from "./LoginForm";
import { getAppLocale } from "@/lib/ui-locale";

export default async function LoginPage() {
  const locale = await getAppLocale();
  return <LoginForm initialLocale={locale} />;
}
