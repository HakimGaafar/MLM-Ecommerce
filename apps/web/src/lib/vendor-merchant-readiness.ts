import { getMerchantReadiness, resolveVendorAccessForUser } from "@mlm/domain";
import { getActiveMarket } from "@/lib/market-server";
import { getServerSession } from "@/lib/server-session";

export async function getCurrentVendorMerchantReadiness() {
  const session = await getServerSession();
  if (!session?.sub) return null;
  const market = await getActiveMarket();
  const access = await resolveVendorAccessForUser(session.sub, market.id);
  if (!access) return null;
  return getMerchantReadiness(access.vendorId);
}
