"use client";

import { useState } from "react";
import { useToast } from "@/components/toast/ToastProvider";

type Ui = {
  add: string;
  remove: string;
  added: string;
  removed: string;
  failed: string;
  loginRequired: string;
};

export default function WishlistButton({
  productId,
  initialInWishlist,
  canUse,
  loginHref,
  ui,
}: {
  productId: string;
  initialInWishlist: boolean;
  canUse: boolean;
  loginHref: string;
  ui: Ui;
}) {
  const toast = useToast();
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [busy, setBusy] = useState(false);

  if (!canUse) {
    return (
      <a href={loginHref} className="btn-secondary mt-3 inline-flex">
        {ui.loginRequired}
      </a>
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      if (inWishlist) {
        const res = await fetch(`/api/v1/customer/wishlist/${productId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("remove");
        setInWishlist(false);
        toast.success(ui.removed);
      } else {
        const res = await fetch("/api/v1/customer/wishlist", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        if (!res.ok) throw new Error("add");
        setInWishlist(true);
        toast.success(ui.added);
      }
    } catch {
      toast.error(ui.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      className="btn-secondary mt-3"
      aria-pressed={inWishlist}
    >
      {inWishlist ? ui.remove : ui.add}
    </button>
  );
}
