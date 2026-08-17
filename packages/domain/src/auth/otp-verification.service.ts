import { createHash, randomInt } from "node:crypto";
import type { Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 6;

export class OtpVerificationError extends Error {
  constructor(
    public readonly code:
      | "RATE_LIMITED"
      | "INVALID_CODE"
      | "EXPIRED"
      | "TOO_MANY_ATTEMPTS"
      | "NO_ACTIVE_CHALLENGE"
      | "ALREADY_VERIFIED"
      | "USER_INACTIVE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OtpVerificationError";
  }
}

function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local[0] ?? "*" : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return false;
  if (user.emailVerifiedAt) return true;

  const orderCount = await prisma.order.count({ where: { buyerUserId: userId } });
  return orderCount > 0;
}

export async function getEmailVerificationStatus(userId: string): Promise<{
  emailVerified: boolean;
  email: string;
  maskedEmail: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new OtpVerificationError("USER_INACTIVE", "Account is not active.");
  }
  const emailVerified = await isUserEmailVerified(userId);
  return {
    emailVerified,
    email: user.email,
    maskedEmail: maskEmail(user.email),
  };
}

export async function assertEmailVerifiedForSensitiveAction(userId: string): Promise<void> {
  if (!(await isUserEmailVerified(userId))) {
    throw new OtpVerificationError(
      "NO_ACTIVE_CHALLENGE",
      "Verify your email with the one-time code before continuing.",
    );
  }
}

export async function createAccountVerificationOtp(userId: string): Promise<{
  code: string;
  email: string;
  maskedEmail: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true, emailVerifiedAt: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new OtpVerificationError("USER_INACTIVE", "Account is not active.");
  }
  if (user.emailVerifiedAt) {
    throw new OtpVerificationError("ALREADY_VERIFIED", "Email is already verified.");
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await prisma.otpChallenge.count({
    where: {
      userId,
      purpose: "ACCOUNT_VERIFICATION",
      createdAt: { gte: oneHourAgo },
    },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    throw new OtpVerificationError("RATE_LIMITED", "Too many codes sent. Try again later.");
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.deleteMany({
      where: { userId, purpose: "ACCOUNT_VERIFICATION", usedAt: null },
    });
    await tx.otpChallenge.create({
      data: {
        userId,
        purpose: "ACCOUNT_VERIFICATION",
        codeHash,
        expiresAt,
      },
    });
  });

  return {
    code,
    email: user.email,
    maskedEmail: maskEmail(user.email),
  };
}

export async function verifyAccountVerificationOtp(
  userId: string,
  rawCode: string,
): Promise<void> {
  const normalized = rawCode.replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    throw new OtpVerificationError("INVALID_CODE", "Enter the 6-digit code.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, emailVerifiedAt: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new OtpVerificationError("USER_INACTIVE", "Account is not active.");
  }
  if (user.emailVerifiedAt) {
    throw new OtpVerificationError("ALREADY_VERIFIED", "Email is already verified.");
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: { userId, purpose: "ACCOUNT_VERIFICATION", usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    throw new OtpVerificationError("NO_ACTIVE_CHALLENGE", "Request a new code first.");
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new OtpVerificationError("EXPIRED", "This code has expired. Request a new one.");
  }
  if (challenge.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    throw new OtpVerificationError("TOO_MANY_ATTEMPTS", "Too many attempts. Request a new code.");
  }

  const codeHash = hashOtpCode(normalized);
  if (codeHash !== challenge.codeHash) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: { increment: 1 } },
    });
    throw new OtpVerificationError("INVALID_CODE", "Incorrect code. Try again.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const marked = await tx.otpChallenge.updateMany({
      where: { id: challenge.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (marked.count !== 1) {
      throw new OtpVerificationError("EXPIRED", "This code has expired. Request a new one.");
    }
    await tx.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: now },
    });
    await tx.otpChallenge.deleteMany({
      where: { userId, purpose: "ACCOUNT_VERIFICATION", usedAt: null },
    });
  });
}
