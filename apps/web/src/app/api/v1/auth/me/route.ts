import { prisma } from "@mlm/db";
import { resolveVendorAccessForUser } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = user.userRoles.map((item: (typeof user.userRoles)[number]) => item.role.code);
  const market = await resolveRequestMarket();
  const hasVendorStore =
    roles.includes("VENDOR")
      ? Boolean(await resolveVendorAccessForUser(user.id, market.id))
      : false;

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roles,
    hasVendorStore,
  });
}
