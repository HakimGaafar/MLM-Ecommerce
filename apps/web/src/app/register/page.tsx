import RegisterForm from "./RegisterForm";
import { getAppLocale } from "@/lib/ui-locale";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const locale = await getAppLocale();
  const params = await searchParams;
  return <RegisterForm initialLocale={locale} initialReferralCode={params.ref} />;
}
