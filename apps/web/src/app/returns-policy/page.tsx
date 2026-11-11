import type { Metadata } from "next";
import { PublicLegalPage, publicLegalMetadata } from "@/components/legal/PublicLegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return publicLegalMetadata("returns-policy");
}

export default function Page() {
  return <PublicLegalPage slug="returns-policy" />;
}
