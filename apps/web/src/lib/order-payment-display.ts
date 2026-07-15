type PaymentUi = {
  paymentCod: string;
  paymentOnlineCard: string;
  paymentWalletCovered: string;
  paymentPending: string;
  paymentPaid: string;
  paymentFailed: string;
  paymentRefunded: string;
};

export function paymentMethodDisplayText(
  ui: PaymentUi,
  method: string,
): string {
  switch (method) {
    case "COD":
      return ui.paymentCod;
    case "ONLINE_CARD":
      return ui.paymentOnlineCard;
    case "WALLET_COVERED":
      return ui.paymentWalletCovered;
    default:
      return method;
  }
}

export function paymentStatusDisplayText(ui: PaymentUi, status: string): string {
  switch (status) {
    case "PENDING":
      return ui.paymentPending;
    case "PAID":
      return ui.paymentPaid;
    case "FAILED":
      return ui.paymentFailed;
    case "REFUNDED":
      return ui.paymentRefunded;
    default:
      return status;
  }
}
