import type en from "@/i8n/en.json";

type FulfillmentDict = {
  fulfillmentDirect: string;
  fulfillmentWarehouseA: string;
  fulfillmentWarehouseB: string;
};

export function fulfillmentTypeLabel(type: string, dict: FulfillmentDict): string {
  switch (type) {
    case "FORSEIZ_STOCK":
      return dict.fulfillmentWarehouseA;
    case "ON_ORDER":
      return dict.fulfillmentWarehouseB;
    case "DIRECT":
    default:
      return dict.fulfillmentDirect;
  }
}

export function vendorProductFulfillmentOptions(dict: typeof en.vendorProducts) {
  return [
    { value: "DIRECT", label: dict.formFulfillmentDirect },
    { value: "FORSEIZ_STOCK", label: dict.formFulfillmentWarehouseA },
    { value: "ON_ORDER", label: dict.formFulfillmentWarehouseB },
  ] as const;
}
