import {
  findCustomerOrderHomeMarket,
  getCustomerOrderForBuyer,
  type CustomerOrderDetailDto,
  type CustomerOrderHomeMarket,
} from "@mlm/domain";

export type CustomerOrderAccess =
  | { kind: "ok"; order: CustomerOrderDetailDto }
  | { kind: "wrong_market"; homeMarket: CustomerOrderHomeMarket }
  | { kind: "not_found" };

export async function resolveCustomerOrderAccess(params: {
  buyerUserId: string;
  orderId: string;
  marketId: string;
  defaultCurrency: string;
}): Promise<CustomerOrderAccess> {
  const order = await getCustomerOrderForBuyer(
    params.buyerUserId,
    params.orderId,
    params.marketId,
    params.defaultCurrency,
  );
  if (order) return { kind: "ok", order };

  const homeMarket = await findCustomerOrderHomeMarket(params.buyerUserId, params.orderId);
  if (homeMarket && homeMarket.marketId !== params.marketId) {
    return { kind: "wrong_market", homeMarket };
  }

  return { kind: "not_found" };
}
