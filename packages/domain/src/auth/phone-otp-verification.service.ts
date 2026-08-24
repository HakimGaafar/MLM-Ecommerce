import { createHash, randomInt } from "node:crypto";
import { prisma } from "@mlm/db";
import { OtpVerificationError } from "./otp-verification.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 6;

function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 0 ? `+${digits}` : "";
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `***${digits.slice(-4)}`;
}

export async function isUserPhoneVerified(userId: string): Promise<boolean> {
  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { phoneVerifiedAt: true, phone: true },
  });
  return Boolean(profile?.phoneVerifiedAt && profile.phone?.trim());
}

export async function getPhoneVerificationStatus(userId: string): Promise<{
  phoneVerified: boolean;
  phone: string | null;
  maskedPhone: string | null;
}> {
  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { phone: true, phoneVerifiedAt: true },
  });
  const phone = profile?.phone?.trim() || null;
  return {
    phoneVerified: Boolean(profile?.phoneVerifiedAt && phone),
    phone,
    maskedPhone: phone ? maskPhone(phone) : null,
  };
}

export async function createPhoneVerificationOtp(userId: string, phone: string): Promise<{
  code: string;
  maskedPhone: string;
}> {
  const normalized = normalizePhone(phone);
  if (normalized.length < 9) {
    throw new OtpVerificationError("NO_ACTIVE_CHALLENGE", "Enter a valid phone number.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new OtpVerificationError("USER_INACTIVE", "Account is not active.");
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.otpChallenge.count({
    where: {
      userId,
      purpose: "PHONE_VERIFICATION",
      createdAt: { gte: oneHourAgo },
    },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    throw new OtpVerificationError("RATE_LIMITED", "Too many codes sent. Try again later.");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.deleteMany({
      where: { userId, purpose: "PHONE_VERIFICATION", usedAt: null },
    });
    await tx.otpChallenge.create({
      data: {
        userId,
        purpose: "PHONE_VERIFICATION",
        codeHash: hashOtpCode(code),
        expiresAt,
      },
    });
    await tx.customerProfile.upsert({
      where: { userId },
      create: { userId, phone: normalized },
      update: { phone: normalized },
    });
  });

  return { code, maskedPhone: maskPhone(normalized) };
}

export async function verifyPhoneVerificationOtp(userId: string, code: string): Promise<void> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new OtpVerificationError("INVALID_CODE", "Enter the 6-digit code.");
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      userId,
      purpose: "PHONE_VERIFICATION",
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    throw new OtpVerificationError("NO_ACTIVE_CHALLENGE", "Request a new code first.");
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new OtpVerificationError("EXPIRED", "Code expired. Request a new one.");
  }
  if (challenge.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    throw new OtpVerificationError("TOO_MANY_ATTEMPTS", "Too many attempts. Request a new code.");
  }

  const valid = challenge.codeHash === hashOtpCode(trimmed);
  if (!valid) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new OtpVerificationError("INVALID_CODE", "Invalid code.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: now },
    });
    await tx.customerProfile.upsert({
      where: { userId },
      create: { userId, phoneVerifiedAt: now },
      update: { phoneVerifiedAt: now },
    });
  });
}
