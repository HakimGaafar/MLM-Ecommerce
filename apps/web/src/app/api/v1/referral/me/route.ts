import { prisma } from "@mlm/db";
import { INTERNATIONAL_MARKETING_AGREEMENT_VERSION } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { isSameOriginRequest, normalizeReferralCode } from "@/lib/security";

function buildReferralCodeSeed(email: string) {
  const prefix = (email.split("@")[0] ?? "user")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  return prefix || "USER";
}

async function issueUniqueReferralCode(baseSeed: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const candidate = `${baseSeed}${suffix}`;
    const exists = await prisma.affiliateProfile.findUnique({
      where: { referralCode: candidate },
      select: { userId: true },
    });
    if (!exists) return candidate;
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

const UpdateReferralCodeSchema = z.object({
  referralCode: z
    .string()
    .transform(normalizeReferralCode)
    .pipe(z.string().regex(/^[A-Z0-9]{4,24}$/)),
});

const EnrollAffiliateSchema = z.object({
  internationalMarketingConsent: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: session.sub },
    include: { parent: true },
  });
  const referralUses = profile
    ? await prisma.referralRelation.count({ where: { parentUserId: session.sub } })
    : 0;

  return NextResponse.json({
    referralCode: profile?.referralCode ?? null,
    rankTitle: profile?.rankTitle ?? null,
    isActive: profile?.isActive ?? false,
    parentUserId: profile?.parent?.parentUserId ?? null,
    canEditReferralCode: referralUses === 0,
    referralUseCount: referralUses,
    internationalMarketingConsentAccepted:
      profile?.internationalMarketingConsentVersion ===
      INTERNATIONAL_MARKETING_AGREEMENT_VERSION,
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = EnrollAffiliateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const consentData = parsed.data.internationalMarketingConsent
    ? {
        internationalMarketingConsentAt: new Date(),
        internationalMarketingConsentVersion: INTERNATIONAL_MARKETING_AGREEMENT_VERSION,
      }
    : {};

  let existingProfile = await prisma.affiliateProfile.findUnique({
    where: { userId: session.sub },
    include: { parent: true },
  });
  if (existingProfile) {
    if (parsed.data.internationalMarketingConsent) {
      existingProfile = await prisma.affiliateProfile.update({
        where: { userId: session.sub },
        data: consentData,
        include: { parent: true },
      });
    }
    const referralUses = await prisma.referralRelation.count({ where: { parentUserId: session.sub } });
    return NextResponse.json({
      referralCode: existingProfile.referralCode,
      rankTitle: existingProfile.rankTitle,
      isActive: existingProfile.isActive,
      parentUserId: existingProfile.parent?.parentUserId ?? null,
      canEditReferralCode: referralUses === 0,
      referralUseCount: referralUses,
      internationalMarketingConsentAccepted:
        existingProfile.internationalMarketingConsentVersion ===
        INTERNATIONAL_MARKETING_AGREEMENT_VERSION,
      enrolled: false,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const affiliateRole = await prisma.role.findUnique({
    where: { code: "AFFILIATE" },
    select: { id: true },
  });
  if (!affiliateRole) {
    return NextResponse.json(
      { error: "Affiliate role is missing. Run database seed first." },
      { status: 500 },
    );
  }

  try {
    const referralCode = await issueUniqueReferralCode(buildReferralCodeSeed(user.email));
    const created = await prisma.$transaction(async (tx) => {
      await tx.userRole.createMany({
        data: [{ userId: user.id, roleId: affiliateRole.id }],
        skipDuplicates: true,
      });

      return tx.affiliateProfile.create({
        data: {
          userId: user.id,
          referralCode,
          ...consentData,
        },
      });
    });

    return NextResponse.json({
      referralCode: created.referralCode,
      rankTitle: created.rankTitle,
      isActive: created.isActive,
      parentUserId: null,
      canEditReferralCode: true,
      referralUseCount: 0,
      internationalMarketingConsentAccepted:
        created.internationalMarketingConsentVersion ===
        INTERNATIONAL_MARKETING_AGREEMENT_VERSION,
      enrolled: true,
    });
  } catch {
    return NextResponse.json({ error: "Could not activate affiliate profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateReferralCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Referral code must be 4-24 letters/numbers." }, { status: 400 });
  }

  const existingProfile = await prisma.affiliateProfile.findUnique({
    where: { userId: session.sub },
    include: { parent: true },
  });
  if (!existingProfile) {
    return NextResponse.json({ error: "Activate affiliate profile first." }, { status: 404 });
  }

  const referralUses = await prisma.referralRelation.count({ where: { parentUserId: session.sub } });
  const canEditReferralCode = referralUses === 0;
  if (!canEditReferralCode) {
    return NextResponse.json(
      {
        error: "Referral code can no longer be changed after someone uses it.",
        referralCode: existingProfile.referralCode,
        isActive: existingProfile.isActive,
        parentUserId: existingProfile.parent?.parentUserId ?? null,
        canEditReferralCode: false,
        referralUseCount: referralUses,
      },
      { status: 409 },
    );
  }

  if (parsed.data.referralCode === existingProfile.referralCode) {
    return NextResponse.json({
      referralCode: existingProfile.referralCode,
      isActive: existingProfile.isActive,
      parentUserId: existingProfile.parent?.parentUserId ?? null,
      canEditReferralCode: true,
      referralUseCount: 0,
    });
  }

  try {
    const updated = await prisma.affiliateProfile.update({
      where: { userId: session.sub },
      data: { referralCode: parsed.data.referralCode },
      include: { parent: true },
    });

    return NextResponse.json({
      referralCode: updated.referralCode,
      isActive: updated.isActive,
      parentUserId: updated.parent?.parentUserId ?? null,
      canEditReferralCode: true,
      referralUseCount: 0,
    });
  } catch {
    return NextResponse.json({ error: "Referral code is already in use." }, { status: 409 });
  }
}
