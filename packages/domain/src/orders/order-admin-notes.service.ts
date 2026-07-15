import { prisma } from "@mlm/db";

export type OrderAdminNoteDto = {
  id: string;
  body: string;
  createdByName: string;
  createdAt: string;
};

export async function listOrderAdminNotes(orderId: string): Promise<OrderAdminNoteDto[]> {
  const rows = await prisma.orderAdminNote.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdByName: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createOrderAdminNote(input: {
  orderId: string;
  body: string;
  createdByUserId: string;
}): Promise<OrderAdminNoteDto> {
  const body = input.body.trim();
  if (!body) throw new Error("Note body is required.");

  const row = await prisma.orderAdminNote.create({
    data: {
      orderId: input.orderId,
      body,
      createdByUserId: input.createdByUserId,
    },
    include: { createdBy: { select: { name: true } } },
  });

  return {
    id: row.id,
    body: row.body,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
  };
}
