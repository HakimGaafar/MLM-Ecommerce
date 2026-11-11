import type { Metadata } from "next";
import { PublicLegalPage, publicLegalMetadata } from "@/components/legal/PublicLegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return publicLegalMetadata("pricing-payment");
}

export default function Page() {
  return <PublicLegalPage slug="pricing-payment" />;
}
