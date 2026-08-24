"use client";

import { useCallback, useState, type ComponentProps } from "react";
import KycDocumentsPanel from "@/components/kyc/KycDocumentsPanel";
import VendorPhysicalShopPanel from "@/components/kyc/VendorPhysicalShopPanel";

type Locale = "en" | "ar";

export default function VendorKycWorkspace({
  locale,
  kycUi,
  physicalShopUi,
}: {
  locale: Locale;
  kycUi: ComponentProps<typeof KycDocumentsPanel>["ui"];
  physicalShopUi: ComponentProps<typeof VendorPhysicalShopPanel>["ui"];
}) {
  const [reloadKey, setReloadKey] = useState(0);

  const reloadKyc = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  return (
    <div className="space-y-6">
      <VendorPhysicalShopPanel locale={locale} ui={physicalShopUi} onUpdated={reloadKyc} />
      <KycDocumentsPanel
        key={reloadKey}
        apiBase="/api/v1/vendor/kyc"
        locale={locale}
        ui={kycUi}
      />
    </div>
  );
}
