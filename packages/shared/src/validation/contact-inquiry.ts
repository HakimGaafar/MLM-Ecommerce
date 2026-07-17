import { z } from "zod";

const normalizeSingleLine = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ");

const normalizeMessage = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .trim();

const safeName = z
  .string()
  .transform(normalizeSingleLine)
  .pipe(
    z
      .string()
      .min(1, "Name is required.")
      .max(80, "Name is too long.")
      .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, "Name contains invalid characters."),
  );

const safeMessage = z
  .string()
  .transform(normalizeMessage)
  .pipe(
    z
      .string()
      .min(10, "Please provide at least 10 characters.")
      .max(4000, "Message must not exceed 4000 characters.")
      .refine(
        (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value),
        "Message contains invalid control characters.",
      )
      .refine(
        (value) => !/<\/?[a-z][^>]*>/iu.test(value),
        "HTML markup is not allowed.",
      ),
  );

export const ContactInquiryCreateSchema = z
  .object({
    firstName: safeName,
    lastName: safeName,
    email: z
      .string()
      .transform((value) => value.trim().toLowerCase())
      .pipe(
        z
          .email("Enter a valid email address.")
          .max(254, "Email is too long.")
          .refine(
            (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value),
            "Enter a valid email address.",
          ),
      ),
    message: safeMessage,
    // Honeypot: legitimate clients leave this field empty.
    website: z.string().max(200).optional().default(""),
  })
  .strict();

export const ContactInquiryStatusSchema = z.enum(["NEW", "READ", "RESOLVED"]);

export const AdminContactInquiryPatchSchema = z
  .object({
    status: ContactInquiryStatusSchema,
  })
  .strict();

export type ContactInquiryCreateInput = z.infer<typeof ContactInquiryCreateSchema>;
export type ContactInquiryStatusInput = z.infer<typeof ContactInquiryStatusSchema>;
export type AdminContactInquiryPatchInput = z.infer<typeof AdminContactInquiryPatchSchema>;
