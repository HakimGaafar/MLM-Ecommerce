import type { Metadata } from "next";
import { PublicLegalPage, publicLegalMetadata } from "@/components/legal/PublicLegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return publicLegalMetadata("shipping-policy");
}

export default function Page() {
  return <PublicLegalPage slug="shipping-policy" />;
}
