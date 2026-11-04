import {
  approveVendorOnboarding,
  getAdminVendorOnboardingDetail,
  rejectVendorOnboarding,
  setOnboardingFieldDecision,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const detail = await getAdminVendorOnboardingDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}

const PatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("field"),
    pageKey: z.string().trim().min(1).max(32),
    fieldKey: z.string().trim().min(1).max(64),
    decision: z.enum(["ACCEPTED", "NEEDS_FIX", "PENDING"]),
    note: z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({
    action: z.literal("approve"),
    note: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal("reject"),
    note: z.string().trim().max(500).optional().nullable(),
  }),
]);

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "field") {
    await setOnboardingFieldDecision({
      vendorId: id,
      pageKey: parsed.data.pageKey,
      fieldKey: parsed.data.fieldKey,
      decision: parsed.data.decision,
      note: parsed.data.note,
      actorUserId: auth.userId,
    });
  } else if (parsed.data.action === "approve") {
    await approveVendorOnboarding({
      vendorId: id,
      actorUserId: auth.userId,
      note: parsed.data.note,
    });
  } else {
    await rejectVendorOnboarding({
      vendorId: id,
      actorUserId: auth.userId,
      note: parsed.data.note,
    });
  }

  const detail = await getAdminVendorOnboardingDetail(id);
  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
