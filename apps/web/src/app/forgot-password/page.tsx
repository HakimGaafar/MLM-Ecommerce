import ForgotPasswordForm from "./ForgotPasswordForm";
import { getAppLocale } from "@/lib/ui-locale";

export default async function ForgotPasswordPage() {
  const locale = await getAppLocale();
  return <ForgotPasswordForm initialLocale={locale} />;
}
