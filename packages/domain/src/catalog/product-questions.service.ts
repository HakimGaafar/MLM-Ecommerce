import type { PaginatedResult, ProductQuestionCreateInput } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma } from "@mlm/db";

export type PublishedProductQuestionDto = {
  id: string;
  questionText: string;
  answerText: string;
  answeredAt: string;
  createdAt: string;
  askerDisplayName: string;
};

export class ProductQuestionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NOT_ELIGIBLE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ProductQuestionError";
  }
}

function askerDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Customer";
  const first = trimmed.split(/\s+/)[0];
  return first || "Customer";
}

export async function listPublishedProductQuestions(
  productId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<PublishedProductQuestionDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = {
    productId,
    isPublished: true,
    answerText: { not: null },
    answeredAt: { not: null },
  };
  const [rows, total] = await prisma.$transaction([
    prisma.productQuestion.findMany({
      where,
      orderBy: [{ answeredAt: "desc" }, { createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        questionText: true,
        answerText: true,
        answeredAt: true,
        createdAt: true,
        asker: { select: { name: true } },
      },
    }),
    prisma.productQuestion.count({ where }),
  ]);

  const items = rows
    .filter((r): r is typeof r & { answerText: string; answeredAt: Date } => r.answerText != null && r.answeredAt != null)
    .map((r) => ({
      id: r.id,
      questionText: r.questionText,
      answerText: r.answerText,
      answeredAt: r.answeredAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      askerDisplayName: askerDisplayName(r.asker.name),
    }));

  return buildPaginatedResult(items, total, page, pageSize);
}

export async function createProductQuestion(
  askerUserId: string,
  productId: string,
  input: ProductQuestionCreateInput,
): Promise<{ id: string; createdAt: string }> {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!product) {
    throw new ProductQuestionError("NOT_FOUND", "Product not found.");
  }

  const row = await prisma.productQuestion.create({
    data: {
      productId,
      askerUserId,
      questionText: input.questionText,
    },
    select: { id: true, createdAt: true },
  });

  return { id: row.id, createdAt: row.createdAt.toISOString() };
}
