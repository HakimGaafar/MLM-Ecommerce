import { requirePageAuth } from "@/lib/require-page-auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requirePageAuth("ADMIN");
  return children;
}
