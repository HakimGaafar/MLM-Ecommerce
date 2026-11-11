import { renderBundledPolicyDocumentWithAnnex } from "../src/lib/legal/content/index";
import { toMarketAnnexView } from "../src/lib/legal/annex";

const annex = toMarketAnnexView({
  defaultCurrency: "SAR",
  issuer: {
    legalNameEn: "NABD AL-AAMAL Ltd COMPANY",
    legalNameAr: "شركة نبض الأعمال المحدودة",
    commercialRegistration: "1010846637",
    unifiedNumber: "7032197050",
    addressLine1: "Riyadh",
    addressLine2: null,
    city: "Riyadh",
    phone: "+966 552222166",
    email: "infoksa@vandsoq.com",
    consumerProtectionAuthorityEn:
      "The competent consumer-protection authority in the Kingdom of Saudi Arabia",
    consumerProtectionAuthorityAr: "جهة حماية المستهلك المختصة في المملكة العربية السعودية",
    vatTrn: "311492184600003",
    vatPercent: 15,
    currency: "SAR",
  },
});

const about = renderBundledPolicyDocumentWithAnnex("ABOUT", "en", annex);
const terms = renderBundledPolicyDocumentWithAnnex("TERMS", "en", annex);

console.log("ABOUT intro:", about?.sections[0]?.paragraphs?.[0]);
console.log(
  "ABOUT email:",
  about?.sections.find((s) => s.id === "company-details")?.bullets?.find((b) => b.includes("Email")),
);
console.log("TERMS has Nabd hardcode?", terms?.sections[0]?.paragraphs?.[0]?.includes("NABD"));
console.log("TERMS contact:", terms?.sections.find((s) => s.id === "article-19")?.paragraphs?.[0]);
console.log("OK");
