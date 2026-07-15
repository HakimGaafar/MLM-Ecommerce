/** Fetch an invoice PDF API route and trigger a browser download with the correct filename. */
export async function downloadInvoicePdf(url: string): Promise<void> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Could not download invoice.");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    disposition?.match(/filename="([^"]+)"/)?.[1] ??
    (url.includes("summary-pdf")
      ? "order-summary.pdf"
      : url.includes("commission")
        ? "commission-invoice.pdf"
        : "vendor-invoice.pdf");

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
