import { acceptVendorTeamInvite, VendorTeamError } from "@mlm/domain";
import { VendorTeamAcceptSchema } from "@mlm/shared";
import { prisma } from "@mlm/db";
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = { userId: session.sub };

  const raw = await request.json().catch(() => null);
  const parsed = VendorTeamAcceptSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await acceptVendorTeamInvite(parsed.data.token, auth.userId, user.email);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorTeamError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "EMAIL_MISMATCH" || e.code === "INVALID"
            ? 409
            : e.code === "ALREADY_ACCEPTED"
              ? 409
              : 403;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
