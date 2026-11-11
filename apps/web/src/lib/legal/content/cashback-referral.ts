import type { PolicyDocument } from "../types";

const en: PolicyDocument = {
  documentType: "CASHBACK_REFERRAL",
  locale: "en",
  sections: [
    {
      id: "coming-soon",
      paragraphs: ["This policy is coming soon."],
    },
  ],
};

const ar: PolicyDocument = {
  documentType: "CASHBACK_REFERRAL",
  locale: "ar",
  sections: [
    {
      id: "coming-soon",
      paragraphs: ["هذه السياسة قريباً."],
    },
  ],
};

export const cashbackReferralPolicy = { en, ar };
