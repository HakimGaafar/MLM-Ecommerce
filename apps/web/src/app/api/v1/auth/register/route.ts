import { prisma, type Prisma } from "@mlm/db";
import {
  bindReferralAtRegistration,
  ReferralBindError,
  resolveWalletCurrency,
} from "@mlm/domain";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  internalServerErrorResponse,
  publicErrorMessage,
  PUBLIC_API_ERRORS,
} from "@/lib/api-error-response";
import { sendWelcomeEmail } from "@/lib/mail";
import { resolveRequestMarket } from "@/lib/request-market";
import {
  consumeRateLimit,
  getClientIp,
  isStrongPassword,
  normalizeEmail,
  normalizeReferralCode,
  sanitizeName,
} from "@/lib/security";

const registerSchema = z.object({
  name: z.string().transform(sanitizeName).pipe(
    z
      .string()
      .min(2)
      .max(80)
      .regex(/^[\p{L}\p{N} .'-]+$/u, "Name contains invalid characters"),
  ),
  email: z.string().transform(normalizeEmail).pipe(z.email()),
  password: z
    .string()
    .min(10)
    .max(128)
    .refine(isStrongPassword, "Password must include upper, lower, number, and symbol"),
  accountType: z.enum(["CUSTOMER", "VENDOR", "BOTH"]).optional().default("CUSTOMER"),
  asVendor: z.boolean().optional(),
  referralCode: z
    .string()
    .transform(normalizeReferralCode)
    .pipe(z.string().regex(/^[A-Z0-9]{4,24}$/))
    .optional(),
});

const REFERRAL_COOKIE = "mlm_referral_code";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`register:${ip}`, 8, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, accountType, asVendor, referralCode } = parsed.data;
  const referralFromCookie = normalizeReferralCode(
    request.cookies.get(REFERRAL_COOKIE)?.value ?? "",
  );
  const requestedReferralCode = referralCode ?? referralFromCookie;
  const resolvedAccountType =
    accountType ?? (asVendor === true ? "BOTH" : "CUSTOMER");
  const hasCustomerRole =
    resolvedAccountType === "CUSTOMER" || resolvedAccountType === "BOTH";
  const hasVendorRole = resolvedAccountType === "VENDOR" || resolvedAccountType === "BOTH";
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  try {
    const market = await resolveRequestMarket();
    const walletCurrency = await resolveWalletCurrency(market.id);

    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
      });

      const customerRole = hasCustomerRole
        ? await tx.role.findUnique({ where: { code: "CUSTOMER" } })
        : null;
      const vendorRole = hasVendorRole
        ? await tx.role.findUnique({ where: { code: "VENDOR" } })
        : null;

      if ((hasCustomerRole && !customerRole) || (hasVendorRole && !vendorRole)) {
        throw new Error("ROLES_MISSING");
      }

      await tx.userRole.createMany({
        data: [
          ...(customerRole ? [{ userId: createdUser.id, roleId: customerRole.id }] : []),
          ...(vendorRole ? [{ userId: createdUser.id, roleId: vendorRole.id }] : []),
        ],
        skipDuplicates: true,
      });

      await tx.wallet.create({
        data: {
          userId: createdUser.id,
          marketId: market.id,
          currency: walletCurrency,
        },
      });

      if (requestedReferralCode) {
        await bindReferralAtRegistration(tx, {
          childUserId: createdUser.id,
          childEmail: email,
          referralCode: requestedReferralCode,
        });
      }

      return {
        ...createdUser,
        accountType: resolvedAccountType,
        roles: [customerRole?.code, vendorRole?.code].filter(Boolean),
      };
    });

    const response = NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        roles: user.roles,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(REFERRAL_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    // Best-effort welcome email — do not fail registration if mail is down.
    void sendWelcomeEmail({ to: user.email, name: user.name }).catch((error) => {
      console.error("[auth/register] welcome email failed", error);
    });

    return response;
  } catch (error) {
    if (error instanceof ReferralBindError) {
      if (error.code === "INVALID_REFERRAL_CODE") {
        return NextResponse.json({ error: "Referral code is invalid." }, { status: 400 });
      }
      if (error.code === "SELF_REFERRAL_BLOCKED") {
        return NextResponse.json({ error: "You cannot refer yourself." }, { status: 400 });
      }
      return NextResponse.json(
        { error: publicErrorMessage(error, PUBLIC_API_ERRORS.registrationFailed, "auth/register") },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "ROLES_MISSING") {
      return internalServerErrorResponse(
        "auth/register",
        error,
        PUBLIC_API_ERRORS.registrationFailed,
      );
    }
    return internalServerErrorResponse("auth/register", error, PUBLIC_API_ERRORS.registrationFailed);
  }
}
