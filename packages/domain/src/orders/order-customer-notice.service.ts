import type { OrderCustomerNoticeType } from "@mlm/db";
import { prisma } from "@mlm/db";

export type OrderCustomerNoticeDto = {
  id: string;
  type: OrderCustomerNoticeType;
  body: string;
  createdAt: string;
  dismissedAt: string | null;
};

export async function listOrderCustomerNotices(orderId: string): Promise<OrderCustomerNoticeDto[]> {
  const rows = await prisma.orderCustomerNotice.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    dismissedAt: r.dismissedAt?.toISOString() ?? null,
  }));
}

export async function listActiveCustomerNotices(orderId: string): Promise<OrderCustomerNoticeDto[]> {
  const rows = await prisma.orderCustomerNotice.findMany({
    where: { orderId, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    dismissedAt: null,
  }));
}

export async function createOrderCustomerNotice(input: {
  orderId: string;
  type?: OrderCustomerNoticeType;
  body: string;
  createdByUserId: string;
}): Promise<OrderCustomerNoticeDto> {
  const body = input.body.trim();
  if (!body) throw new Error("Notice body is required.");

  const row = await prisma.orderCustomerNotice.create({
    data: {
      orderId: input.orderId,
      type: input.type ?? "DELAY",
      body,
      createdByUserId: input.createdByUserId,
    },
  });

  return {
    id: row.id,
    type: row.type,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    dismissedAt: null,
  };
}

export async function dismissCustomerNotice(
  buyerUserId: string,
  orderId: string,
  noticeId: string,
): Promise<void> {
  const notice = await prisma.orderCustomerNotice.findFirst({
    where: { id: noticeId, orderId, order: { buyerUserId } },
  });
  if (!notice) return;
  await prisma.orderCustomerNotice.update({
    where: { id: noticeId },
    data: { dismissedAt: new Date() },
  });
}
