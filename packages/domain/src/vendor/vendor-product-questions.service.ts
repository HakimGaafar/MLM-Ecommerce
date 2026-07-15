import type { VendorProductQuestionAnswerInput, VendorProductQuestionListTab } from "@mlm/shared";
import { prisma } from "@mlm/db";

export type VendorProductQuestionListItemDto = {
  id: string;
  productId: string;
  productName: string;
  askerName: string;
  questionText: string;
  answerText: string | null;
  isPublished: boolean;
  answeredAt: string | null;
  createdAt: string;
};

export type VendorProductQuestionListResult = {
  items: VendorProductQuestionListItemDto[];
  page: number;
  pageSize: number;
  total: number;
};

export class VendorProductQuestionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "ALREADY_ANSWERED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorProductQuestionError";
  }
}

export async function listVendorProductQuestions(params: {
  vendorId: string;
  tab: VendorProductQuestionListTab;
  page: number;
  pageSize: number;
}): Promise<VendorProductQuestionListResult> {
  const where = {
    product: { vendorId: params.vendorId },
    ...(params.tab === "unanswered" ? { answerText: null } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.productQuestion.count({ where }),
    prisma.productQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        productId: true,
        questionText: true,
        answerText: true,
        isPublished: true,
        answeredAt: true,
        createdAt: true,
        product: { select: { name: true } },
        asker: { select: { name: true } },
      },
    }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product.name,
      askerName: r.asker.name,
      questionText: r.questionText,
      answerText: r.answerText,
      isPublished: r.isPublished,
      answeredAt: r.answeredAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    page: params.page,
    pageSize: params.pageSize,
    total,
  };
}

export async function answerVendorProductQuestion(
  vendorId: string,
  questionId: string,
  input: VendorProductQuestionAnswerInput,
): Promise<VendorProductQuestionListItemDto> {
  const existing = await prisma.productQuestion.findFirst({
    where: { id: questionId },
    select: {
      id: true,
      answerText: true,
      product: { select: { vendorId: true, name: true } },
      asker: { select: { name: true } },
      productId: true,
      questionText: true,
      isPublished: true,
      answeredAt: true,
      createdAt: true,
    },
  });

  if (!existing) {
    throw new VendorProductQuestionError("NOT_FOUND", "Question not found.");
  }
  if (existing.product.vendorId !== vendorId) {
    throw new VendorProductQuestionError("FORBIDDEN", "This question is not for your store.");
  }
  if (existing.answerText != null) {
    throw new VendorProductQuestionError("ALREADY_ANSWERED", "This question already has an answer.");
  }

  const now = new Date();
  const publish = input.publish ?? true;
  const row = await prisma.productQuestion.update({
    where: { id: questionId },
    data: {
      answerText: input.answerText,
      isPublished: publish,
      answeredAt: now,
    },
    select: {
      id: true,
      productId: true,
      questionText: true,
      answerText: true,
      isPublished: true,
      answeredAt: true,
      createdAt: true,
      product: { select: { name: true } },
      asker: { select: { name: true } },
    },
  });

  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    askerName: row.asker.name,
    questionText: row.questionText,
    answerText: row.answerText,
    isPublished: row.isPublished,
    answeredAt: row.answeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
