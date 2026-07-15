"use client";

import Image from "next/image";
import { ProductImageUrlSchema } from "@mlm/shared";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ar from "@/i8n/ar.json";
import en from "@/i8n/en.json";
import { useAppLocale } from "@/components/providers/LocaleProvider";
import { catalogCategoriesUrl } from "@/lib/locale-shared";
import { useToast } from "@/components/toast/ToastProvider";
import { getToastDict } from "@/lib/toast-messages";
import { vendorProductFormUi } from "./vendor-product-form-ui";
import { vendorProductFulfillmentOptions } from "@/lib/fulfillment-labels";

type Category = { id: string; name: string };

type ImageItem = { clientId: string; url: string };

function newImageItem(url: string): ImageItem {
  const clientId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { clientId, url };
}

/** Strip invisible chars so DB junk does not count as “has an image”. */
function cleanImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function isValidImageUrl(url: string): boolean {
  return ProductImageUrlSchema.safeParse(url).success;
}

export default function VendorProductForm({ productId }: { productId?: string }) {
  const locale = useAppLocale();
  const ui = useMemo(
    () =>
      vendorProductFormUi(
        (locale === "ar" ? ar : en).vendorProducts,
        productId ? "edit" : "create",
      ),
    [locale, productId],
  );
  const router = useRouter();
  const toast = useToast();
  const toastDict = getToastDict(locale);
  const fileRef = useRef<HTMLInputElement>(null);
  const direction = locale === "ar" ? "rtl" : "ltr";

  const fulfillmentOptions = useMemo(
    () => vendorProductFulfillmentOptions(locale === "ar" ? ar.vendorProducts : en.vendorProducts),
    [locale],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [categoryId, setCategoryId] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("DIRECT");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [primaryClientId, setPrimaryClientId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEditRequestId, setPendingEditRequestId] = useState<string | null>(null);
  const [latestEditRejectionReason, setLatestEditRejectionReason] = useState<string | null>(null);
  const [productStatus, setProductStatus] = useState<string | null>(null);
  const [latestProductRejectionReason, setLatestProductRejectionReason] = useState<string | null>(null);
  /** Per-thumbnail: Next/Image blocked URL or failed load — show placeholder instead of a blank tile. */
  const [imgLoadFailed, setImgLoadFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(catalogCategoriesUrl(locale), {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Category[] };
        setCategories(data.items);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        /* ignore */
      }
    })();
    return () => ac.abort();
  }, [locale]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/vendor/products/${productId}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(ui.loadError);
        const data = (await res.json()) as {
          product: {
            name: string;
            price: string;
            currency: string;
            categoryId: string;
            fulfillmentType: string;
            metaTitle: string | null;
            metaDescription: string | null;
            images: { id: string; url: string; isPrimary: boolean }[];
            status: string;
            pendingEditRequestId: string | null;
            latestEditRejectionReason: string | null;
            latestProductRejectionReason: string | null;
          };
        };
        if (cancelled) return;
        setName(data.product.name);
        setPrice(data.product.price);
        setCurrency(data.product.currency);
        setCategoryId(data.product.categoryId);
        setFulfillmentType(data.product.fulfillmentType ?? "DIRECT");
        setMetaTitle(data.product.metaTitle ?? "");
        setMetaDescription(data.product.metaDescription ?? "");
        const imgs = data.product.images
          .map((i) => ({ clientId: i.id, url: cleanImageUrl(i.url) }))
          .filter((i) => isValidImageUrl(i.url));
        setImageItems(imgs);
        const primaryRow = data.product.images.find((i) => i.isPrimary);
        const primaryId =
          primaryRow && imgs.some((x) => x.clientId === primaryRow.id)
            ? primaryRow.id
            : (imgs[0]?.clientId ?? null);
        setPrimaryClientId(primaryId);
        setPendingEditRequestId(data.product.pendingEditRequestId ?? null);
        setLatestEditRejectionReason(data.product.latestEditRejectionReason ?? null);
        setProductStatus(data.product.status ?? null);
        setLatestProductRejectionReason(data.product.latestProductRejectionReason ?? null);
        setImgLoadFailed({});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ui.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, ui.loadError]);

  /** If cover was removed or invalid, default to first image with a URL. */
  useEffect(() => {
    const withUrl = imageItems.filter((i) => isValidImageUrl(i.url));
    if (withUrl.length === 0) {
      setPrimaryClientId(null);
      return;
    }
    setPrimaryClientId((pid) => {
      if (pid && withUrl.some((i) => i.clientId === pid)) return pid;
      return withUrl[0].clientId;
    });
  }, [imageItems]);

  async function uploadOneFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/v1/vendor/products/upload", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const payload = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res.ok || !payload?.url) throw new Error(payload?.error ?? ui.saveError);
    return payload.url;
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of files) {
        urls.push(await uploadOneFile(file));
      }
      setImageItems((prev) => {
        const cleaned = prev.filter((p) => isValidImageUrl(p.url));
        const added = urls.map((url) => newImageItem(url));
        return [...cleaned, ...added];
      });
      toast.success(toastDict.uploaded);
    } catch (e) {
      const msg = e instanceof Error ? e.message : toastDict.uploadFailed;
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function addUrl() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    try {
      if (!trimmed.startsWith("/")) {
        new URL(trimmed);
      }
    } catch {
      setError(ui.saveError);
      return;
    }
    setImageItems((prev) => [...prev.filter((p) => isValidImageUrl(p.url)), newImageItem(trimmed)]);
    setNewUrl("");
  }

  function removeImage(clientId: string) {
    setImageItems((prev) => prev.filter((i) => i.clientId !== clientId));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const validItems = imageItems.filter((i) => isValidImageUrl(i.url));
    const images = validItems.map((item, sortOrder) => ({
      url: item.url.trim(),
      sortOrder,
      isPrimary: item.clientId === primaryClientId,
    }));
    if (images.length === 0) {
      setError(ui.imagesHint);
      setSaving(false);
      return;
    }
    if (!images.some((img) => img.isPrimary)) {
      images[0].isPrimary = true;
    }
    try {
      const body = {
        name,
        price: Number.parseFloat(price),
        currency,
        categoryId,
        fulfillmentType,
        images,
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
      };
      const res = await fetch(productId ? `/api/v1/vendor/products/${productId}` : "/api/v1/vendor/products", {
        method: productId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? ui.saveError);
      }
      toast.success(productId ? toastDict.productUpdated : toastDict.productCreated);
      router.replace("/vendor/products");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : ui.saveError;
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{ui.loadingProduct}</p>;
  }

  const displayedItems = imageItems.filter((i) => isValidImageUrl(i.url));

  return (
    <form className="app-card mt-6 max-w-lg space-y-4 p-5" onSubmit={onSubmit} dir={direction}>
      {error ? (
        <p className="app-alert-error">
          {error}
        </p>
      ) : null}

      {productId && pendingEditRequestId ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          {ui.editPendingNote}
        </p>
      ) : null}

      {productId && !pendingEditRequestId && latestEditRejectionReason ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <span className="font-medium">{ui.editRejectedReasonLabel}:</span> {latestEditRejectionReason}
        </p>
      ) : null}

      {productId && productStatus === "REJECTED" && latestProductRejectionReason ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          <span className="font-medium">{ui.productRejectedReasonLabel}:</span> {latestProductRejectionReason}
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.name}</span>
        <input required maxLength={200} className="app-input" value={name} onChange={(ev) => setName(ev.target.value)} />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.category}</span>
        <select required className="app-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{ui.categoryPlaceholder}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">{ui.formFulfillment}</span>
        <select
          required
          className="app-input"
          value={fulfillmentType}
          onChange={(e) => setFulfillmentType(e.target.value)}
        >
          {fulfillmentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--muted)]">{ui.formFulfillmentHint}</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.price}</span>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            className="app-input"
            value={price}
            onChange={(ev) => setPrice(ev.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.currency}</span>
          <input
            maxLength={3}
            readOnly={!productId}
            disabled={!productId}
            className={`app-input uppercase ${!productId ? "cursor-not-allowed opacity-70" : ""}`}
            value={currency}
            onChange={(ev) => setCurrency(ev.target.value.toUpperCase())}
          />
        </label>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <legend className="px-1 text-sm font-medium">{ui.seoSection}</legend>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.metaTitle}</span>
          <input
            maxLength={70}
            className="app-input"
            value={metaTitle}
            onChange={(ev) => setMetaTitle(ev.target.value)}
          />
          <span className="text-xs text-[var(--muted)]">{ui.metaTitleHint}</span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{ui.metaDescription}</span>
          <textarea
            maxLength={160}
            rows={3}
            className="app-input min-h-[4.5rem] resize-y"
            value={metaDescription}
            onChange={(ev) => setMetaDescription(ev.target.value)}
          />
          <span className="text-xs text-[var(--muted)]">{ui.metaDescriptionHint}</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <legend className="px-1 text-sm font-medium">{ui.images}</legend>
        <p className="text-xs text-[var(--muted)]">{ui.imagesHint}</p>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {displayedItems.map((item) => {
            const isCover = item.clientId === primaryClientId;
            const failed = imgLoadFailed[item.clientId] === true;
            const useUnoptimized =
              item.url.startsWith("/uploads/") || /^https?:\/\//i.test(item.url);
            return (
              <li key={item.clientId} className="relative aspect-square overflow-hidden rounded-lg border border-[var(--border)]">
                {!failed ? (
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="120px"
                    unoptimized={useUnoptimized}
                    onError={() => setImgLoadFailed((m) => ({ ...m, [item.clientId]: true }))}
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-[var(--table-head-bg)] text-3xl opacity-60"
                    aria-hidden
                  >
                    🛒
                  </div>
                )}
                {isCover ? (
                  <span className="absolute start-1 top-1 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary-foreground)]">
                    {ui.coverBadge}
                  </span>
                ) : null}
                <div className="absolute bottom-1 start-1 end-1 flex flex-wrap gap-1">
                  {!isCover ? (
                    <button
                      type="button"
                      className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/85"
                      onClick={() => setPrimaryClientId(item.clientId)}
                    >
                      {ui.setCover}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ms-auto rounded bg-black/60 px-1.5 py-0.5 text-xs text-white hover:bg-black/75"
                    onClick={() => removeImage(item.clientId)}
                  >
                    {ui.removeImage}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            className="app-input min-w-[12rem] flex-1"
            placeholder={ui.imageUrl}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <button type="button" className="btn-secondary btn-press" onClick={addUrl}>
            {ui.addImage}
          </button>
          <button
            type="button"
            className="btn-secondary btn-press"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? ui.uploading : ui.uploadImages}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            aria-label={ui.uploadImages}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) void uploadFiles(files);
            }}
          />
        </div>
      </fieldset>

      <button type="submit" disabled={saving || uploading} className="btn-primary btn-press w-full">
        {saving ? ui.submitting : ui.submit}
      </button>
    </form>
  );
}
