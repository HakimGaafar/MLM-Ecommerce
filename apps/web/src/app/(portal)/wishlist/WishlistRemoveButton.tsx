"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

export default function WishlistRemoveButton({
  productId,
  label,
  failed,
}: {
  productId: string;
  label: string;
  failed: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/customer/wishlist/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("remove");
      router.refresh();
    } catch {
      toast.error(failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" disabled={busy} className="btn-secondary" onClick={() => void remove()}>
      {label}
    </button>
  );
}
