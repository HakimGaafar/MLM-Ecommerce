import { createHash } from "node:crypto";
import { createContactInquiry } from "@mlm/domain";
import { ContactInquiryCreateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestMarket } from "@/lib/request-market";
import { consumeRateLimit, getClientIp, isSameOriginRequest } from "@/lib/security";

const MAX_BODY_BYTES = 12_000;
const RESPONSE_HEADERS = { "Cache-Control": "no-store" };

function acceptedResponse() {
  return NextResponse.json(
    { accepted: true },
    { status: 201, headers: RESPONSE_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Request origin is not allowed." },
      { status: 403, headers: RESPONSE_HEADERS },
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415, headers: RESPONSE_HEADERS },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413, headers: RESPONSE_HEADERS },
    );
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit(`contact:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { ...RESPONSE_HEADERS, "Retry-After": `${ipLimit.retryAfterSeconds}` },
      },
    );
  }

  const raw = await request.text().catch(() => "");
  if (!raw || Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: raw ? "Request body is too large." : "Invalid request body." },
      { status: raw ? 413 : 400, headers: RESPONSE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const parsed = ContactInquiryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  // Silently accept bot honeypot submissions without storing them.
  if (parsed.data.website.trim()) return acceptedResponse();

  const emailFingerprint = createHash("sha256").update(parsed.data.email).digest("hex");
  const emailLimit = await consumeRateLimit(
    `contact:email:${emailFingerprint}`,
    3,
    60 * 60 * 1000,
  );
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { ...RESPONSE_HEADERS, "Retry-After": `${emailLimit.retryAfterSeconds}` },
      },
    );
  }

  const market = await resolveRequestMarket();
  await createContactInquiry(market.id, parsed.data);
  return acceptedResponse();
}
