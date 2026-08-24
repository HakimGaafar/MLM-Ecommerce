import { Resend } from "resend";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Fources";

function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function fromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `${APP_NAME} <onboarding@resend.dev>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Simple plain-looking HTML email (no dark card / CTA buttons). */
function wrapEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111111;background:#ffffff;">
  ${bodyHtml}
</body>
</html>`;
}

async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; mode: "resend" | "console"; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info(
      `[mail:dev] To: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`,
    );
    return { ok: true, mode: "console" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (result.error) {
      console.error("[mail:resend]", result.error);
      // Resend test sender (onboarding@resend.dev) often rejects third-party inboxes.
      // In non-production, fall back to console so wallet/checkout OTP can still be tested.
      if (process.env.NODE_ENV !== "production") {
        console.info(
          `[mail:dev-fallback] Resend failed (${result.error.message}). Logging email instead.\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`,
        );
        return { ok: true, mode: "console", error: result.error.message };
      }
      return { ok: false, mode: "resend", error: result.error.message };
    }
    return { ok: true, mode: "resend" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    console.error("[mail:resend]", message);
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[mail:dev-fallback] Resend threw (${message}). Logging email instead.\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`,
      );
      return { ok: true, mode: "console", error: message };
    }
    return { ok: false, mode: "resend", error: message };
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  rawToken: string;
}): Promise<{ ok: boolean; mode: "resend" | "console"; error?: string }> {
  const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(input.rawToken)}`;
  const safeName = escapeHtml(input.name || "there");
  const subject = `Reset your ${APP_NAME} password`;
  const text = `Hi ${input.name || "there"},

We received a request to reset your ${APP_NAME} password.

Open this link to choose a new password (valid for 60 minutes, one-time use):
${resetUrl}

If you did not request this, you can ignore this email. Your password will stay the same.`;

  const html = wrapEmail(
    `<p>Hi ${safeName},</p>
     <p>We received a request to reset your ${escapeHtml(APP_NAME)} password.</p>
     <p>This link expires in 60 minutes and can be used only once.</p>
     <p>Open this link to choose a new password:</p>
     <p style="word-break:break-all;"><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
     <p>If you did not request this, you can ignore this email. Your password will stay the same.</p>`,
  );

  return sendMail({ to: input.to, subject, html, text });
}

export async function sendPasswordChangedEmail(input: {
  to: string;
  name: string;
}): Promise<{ ok: boolean; mode: "resend" | "console"; error?: string }> {
  const loginUrl = `${appBaseUrl()}/account/customer`;
  const safeName = escapeHtml(input.name || "there");
  const subject = `Your ${APP_NAME} password was changed`;
  const text = `Hi ${input.name || "there"},

Your ${APP_NAME} password was changed successfully.

If this was you, no further action is needed. You can sign in here:
${loginUrl}

If you did not change your password, contact support immediately.`;

  const html = wrapEmail(
    `<p>Hi ${safeName},</p>
     <p>Your ${escapeHtml(APP_NAME)} password was changed successfully.</p>
     <p>If this was you, no further action is needed. Sign in here:</p>
     <p style="word-break:break-all;"><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
     <p>If you did not change your password, contact support immediately.</p>`,
  );

  return sendMail({ to: input.to, subject, html, text });
}

export async function sendOtpVerificationEmail(input: {
  to: string;
  name: string;
  code: string;
}): Promise<{ ok: boolean; mode: "resend" | "console"; error?: string }> {
  const safeName = escapeHtml(input.name || "there");
  const safeCode = escapeHtml(input.code);
  const subject = `${input.code} is your ${APP_NAME} verification code`;
  const text = `Hi ${input.name || "there"},

Your ${APP_NAME} verification code is: ${input.code}

This code expires in 10 minutes. If you did not request it, you can ignore this email.

Regards,
The ${APP_NAME} Team`;

  const html = wrapEmail(
    `<p>Hi ${safeName},</p>
     <p>Your ${escapeHtml(APP_NAME)} verification code is:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:0.2em;color:#2563eb;">${safeCode}</p>
     <p>This code expires in 10 minutes.</p>
     <p>If you did not request it, you can ignore this email.</p>
     <p>Regards,<br/>The ${escapeHtml(APP_NAME)} Team</p>`,
  );

  return sendMail({ to: input.to, subject, html, text });
}

export async function sendWelcomeEmail(input: {
  to: string;
  name: string;
}): Promise<{ ok: boolean; mode: "resend" | "console"; error?: string }> {
  const loginUrl = `${appBaseUrl()}/account/customer`;
  const safeName = escapeHtml(input.name || "there");
  const subject = `Welcome to ${APP_NAME}`;
  const text = `Hi ${input.name || "there"},

Welcome to ${APP_NAME}! Your customer account is ready.

Sign in anytime:
${loginUrl}

You can shop, track orders, and activate your wallet when you are ready.

Thanks for joining us.
The ${APP_NAME} Team`;

  const html = wrapEmail(
    `<p>Hi ${safeName},</p>
     <p>Welcome to ${escapeHtml(APP_NAME)}! Your customer account is ready.</p>
     <p>Sign in anytime:</p>
     <p style="word-break:break-all;"><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
     <p>You can shop, track orders, and activate your wallet when you are ready.</p>
     <p>Thanks for joining us.<br/>The ${escapeHtml(APP_NAME)} Team</p>`,
  );

  return sendMail({ to: input.to, subject, html, text });
}
