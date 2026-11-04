import Link from "next/link";
import {
  listWishlist,
} from "@mlm/domain";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { resolveRequestCatalogDelivery } from "@/lib/catalog-delivery-context";
import { getCustomerPreferredLocale } from "@/lib/customer-locale";
import { formatMoney } from "@/lib/format-currency";
import { getActiveMarket } from "@/lib/market-server";
import { getServerSession } from "@/lib/server-session";
import WishlistRemoveButton from "./WishlistRemoveButton";

export default async function WishlistPage() {
  const session = await getServerSession();
  const locale = await getCustomerPreferredLocale();
  const dict = locale === "ar" ? ar : en;
  const ui = dict.wishlist;
  const catalogUi = dict.productCatalog;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const market = await getActiveMarket();
  const delivery = await resolveRequestCatalogDelivery({ marketCode: market.code });
  const items = session?.sub
    ? await listWishlist(session.sub, market.id, locale, delivery)
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl p-8 animate-page-enter" dir={direction}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ui.title}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{ui.subtitle}</p>
        </div>
        <Link href="/products" className="text-sm font-medium text-link">
          {ui.browseProducts}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--muted)]">{ui.empty}</p>
      ) : (
        <ul className="mt-8 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {items.map((item) => {
            const product = item.product;
            return (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  {product ? (
                    <>
                      <Link
                        href={`/products/${product.slug || product.id}`}
                        className="font-medium text-[var(--foreground)] hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {catalogUi.soldBy}: {product.vendorName}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        {formatMoney(product.price, product.currency, locale)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">{ui.unavailable}</p>
                  )}
                </div>
                <WishlistRemoveButton
                  productId={item.productId}
                  label={ui.remove}
                  failed={ui.removeFailed}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
