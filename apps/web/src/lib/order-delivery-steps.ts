export type OrderDeliveryStepId = "UNDER_REVIEW" | "PREPARING" | "SHIPPED" | "DELIVERED";

export type OrderDeliveryStepState = "complete" | "current" | "upcoming" | "cancelled";

const DELIVERY_STEPS: OrderDeliveryStepId[] = [
  "UNDER_REVIEW",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
];

export function buildOrderDeliverySteps(customerStep: string): {
  id: OrderDeliveryStepId;
  state: OrderDeliveryStepState;
}[] {
  if (customerStep === "CANCELLED") {
    return DELIVERY_STEPS.map((id, index) => ({
      id,
      state: index === 0 ? "cancelled" : "upcoming",
    }));
  }

  const currentIndex = DELIVERY_STEPS.indexOf(customerStep as OrderDeliveryStepId);
  const idx = currentIndex >= 0 ? currentIndex : 0;

  return DELIVERY_STEPS.map((id, index) => ({
    id,
    state: index < idx ? "complete" : index === idx ? "current" : "upcoming",
  }));
}
