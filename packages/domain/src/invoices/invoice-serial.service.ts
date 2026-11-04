import { prisma } from "@mlm/db";

/**
 * Per-issuer sequential invoice numbers (Phase 1 start).
 * issuerKey examples: `commission:market_om`, `vendor-sale:market_sa`, later `issuer:om-vision`.
 */
export async function allocateInvoiceSerial(params: {
  issuerKey: string;
  prefix: string;
}): Promise<string> {
  const issuerKey = params.issuerKey.trim().slice(0, 64);
  const prefix = params.prefix.trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || "INV";

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceSerialCounter.findUnique({ where: { issuerKey } });
    if (!existing) {
      return tx.invoiceSerialCounter.create({
        data: { issuerKey, prefix, nextValue: 2 },
      }).then(() => 1);
    }
    const current = existing.nextValue;
    await tx.invoiceSerialCounter.update({
      where: { issuerKey },
      data: { nextValue: current + 1, prefix },
    });
    return current;
  });

  const year = new Date().getUTCFullYear();
  const serial = String(row).padStart(6, "0");
  return `${prefix}-${year}-${serial}`;
}
