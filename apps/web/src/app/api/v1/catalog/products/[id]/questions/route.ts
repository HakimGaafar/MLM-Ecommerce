import { listPublishedProductQuestions } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const result = await listPublishedProductQuestions(id, { page, pageSize });
  return NextResponse.json(
    result,
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
