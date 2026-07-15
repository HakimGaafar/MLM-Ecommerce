import { requirePageAuth } from "@/lib/require-page-auth";

export default async function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePageAuth("CUSTOMER");
  return children;
}
