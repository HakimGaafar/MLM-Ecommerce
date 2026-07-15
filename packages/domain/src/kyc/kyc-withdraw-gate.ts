import type { KycSubjectType } from "@mlm/db";
import { getKycStatusSummary } from "./kyc-document.service";

export class KycWithdrawGateError extends Error {
  constructor(
    public readonly code: "KYC_NOT_APPROVED" | "KYC_ID_EXPIRED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "KycWithdrawGateError";
  }
}

export async function assertKycApprovedForWithdraw(params: {
  userId: string;
  subjectType: Extract<KycSubjectType, "CUSTOMER" | "AFFILIATE">;
}): Promise<void> {
  const summary = await getKycStatusSummary({
    subjectType: params.subjectType,
    userId: params.userId,
  });

  if (summary.idExpired) {
    throw new KycWithdrawGateError(
      "KYC_ID_EXPIRED",
      "Your identity document has expired. Upload a valid document and wait for approval.",
    );
  }

  if (!summary.approved) {
    throw new KycWithdrawGateError(
      "KYC_NOT_APPROVED",
      "Complete identity verification before requesting a withdrawal.",
    );
  }
}
