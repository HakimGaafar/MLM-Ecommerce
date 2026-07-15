import type { ContactInquiryStatus } from "@mlm/db";
import { prisma } from "@mlm/db";
import type { ContactInquiryCreateInput } from "@mlm/shared";

export type ContactInquiryDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  status: ContactInquiryStatus;
  marketCode: string;
  createdAt: string;
  updatedAt: string;
};

export async function createContactInquiry(
  marketId: string,
  input: ContactInquiryCreateInput,
): Promise<{ id: string }> {
  const row = await prisma.contactInquiry.create({
    data: {
      marketId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      message: input.message,
    },
    select: { id: true },
  });
  return row;
}

export async function listContactInquiries(params: {
  page: number;
  pageSize: number;
  status?: ContactInquiryStatus;
}): Promise<{
  items: ContactInquiryDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const where = params.status ? { status: params.status } : {};

  const [rows, total] = await prisma.$transaction([
    prisma.contactInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { market: { select: { code: true } } },
    }),
    prisma.contactInquiry.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      message: row.message,
      status: row.status,
      marketCode: row.market.code,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

export async function updateContactInquiryStatus(
  id: string,
  status: ContactInquiryStatus,
): Promise<ContactInquiryDto | null> {
  const existing = await prisma.contactInquiry.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.contactInquiry.update({
    where: { id },
    data: { status },
    include: { market: { select: { code: true } } },
  });
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    message: row.message,
    status: row.status,
    marketCode: row.market.code,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
