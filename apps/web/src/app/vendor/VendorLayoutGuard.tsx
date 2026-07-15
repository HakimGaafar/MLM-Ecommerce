"use client";

import { canAccessVendorPath, type VendorPermissionCode } from "@mlm/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import VendorAccessDenied from "./VendorAccessDenied";

export default function VendorLayoutGuard({
  permissions,
  fallbackHref,
  deniedTitle,
  deniedBody,
  deniedLinkLabel,
  children,
}: {
  permissions: VendorPermissionCode[];
  fallbackHref: string;
  deniedTitle: string;
  deniedBody: string;
  deniedLinkLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessVendorPath(permissions, pathname);

  useEffect(() => {
    if (!allowed) {
      router.replace(fallbackHref);
    }
  }, [allowed, fallbackHref, router]);

  if (!allowed) {
    return (
      <VendorAccessDenied
        fallbackHref={fallbackHref}
        title={deniedTitle}
        body={deniedBody}
        linkLabel={deniedLinkLabel}
      />
    );
  }

  return children;
}
