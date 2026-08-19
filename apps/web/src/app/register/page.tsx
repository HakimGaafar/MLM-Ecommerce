import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams({ mode: "register" });
  if (params.ref) qs.set("ref", params.ref);
  redirect(`/account/customer?${qs.toString()}`);
}
