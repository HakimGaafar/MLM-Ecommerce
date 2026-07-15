import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_MARKET_ID, MARKET_IDS, type MarketCode } from "@mlm/shared";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  throw new Error(
    "Refusing to seed a production database. Set ALLOW_PRODUCTION_SEED=true only for an intentional controlled seed.",
  );
}

const prisma = new PrismaClient();

const DEMO_ADMIN_EMAIL = "admin@mlm.seed";
const DEMO_ADMIN_PASSWORD = "SeedDemo123!";
const DEMO_VENDOR_EMAIL = "demo.vendor@mlm.seed";
const DEMO_VENDOR_PASSWORD = "SeedDemo123!";

const VENDOR_KYC_DOCUMENT_TYPES = [
  "COMMERCIAL_REGISTRATION",
  "LICENSE",
  "TAX_CERTIFICATE",
  "REPRESENTATIVE_ID",
  "IBAN",
] as const;

const SEED_DEMO_VENDOR_IBAN = "SA0380000000608010167519";

async function seedRoles() {
  const roles = ["ADMIN", "SUPER_ADMIN", "VENDOR", "CUSTOMER", "AFFILIATE"];

  for (const code of roles) {
    await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
}

function seedSlug(storeName: string, ownerUserId: string) {
  const base = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${base || "store"}-${ownerUserId.slice(-6)}`.slice(0, 48);
}

async function ensureVendor(
  ownerUserId: string,
  storeName: string,
  marketId: string = DEFAULT_MARKET_ID,
  countryCode = "SA",
  city = "Riyadh",
) {
  const existing = await prisma.vendor.findFirst({ where: { ownerUserId, marketId } });
  if (existing) return existing;
  return prisma.vendor.create({
    data: {
      marketId,
      ownerUserId,
      storeName,
      slug: seedSlug(storeName, ownerUserId),
      countryCode,
      addressLine1: "Seed marketplace address",
      city,
      postalCode: countryCode === "EG" ? "11511" : countryCode === "OM" ? "100" : "11564",
      contactPhone: "+966500000001",
      planCode: "FREE",
    },
  });
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

const SEED_CATEGORY_GENERAL = "cat_general";
const SEED_CATEGORY_ELECTRONICS = "cat_electronics";
/** Stable Unsplash asset (previous seed ID returned 404 from upstream). */
const SEED_IMAGE_DEFAULT =
  "https://images.unsplash.com/photo-1505740420922-5e560c06d30d?w=800&auto=format&fit=crop&q=80";
const SEED_VENDOR_LOGO_URL =
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=256&auto=format&fit=crop&q=80";
const SEED_VENDOR_BANNER_URL =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80";

const SEED_SHIPPING_FEE_BY_MARKET: Record<string, number> = {
  [MARKET_IDS.SA]: 15,
  [MARKET_IDS.OM]: 2,
  [MARKET_IDS.EG]: 50,
  [MARKET_IDS.GLOBAL]: 10,
};

const DEMO_VENDOR_STORES: Array<{
  marketId: string;
  storeName: string;
  countryCode: string;
  city: string;
}> = [
  {
    marketId: MARKET_IDS.SA,
    storeName: "Demo Marketplace — seed catalog",
    countryCode: "SA",
    city: "Riyadh",
  },
  {
    marketId: MARKET_IDS.OM,
    storeName: "Demo Oman Store",
    countryCode: "OM",
    city: "Muscat",
  },
  {
    marketId: MARKET_IDS.EG,
    storeName: "Demo Egypt Store",
    countryCode: "EG",
    city: "Cairo",
  },
  {
    marketId: MARKET_IDS.GLOBAL,
    storeName: "Demo Global Store",
    countryCode: "US",
    city: "New York",
  },
];

async function seedPublishedProduct(
  vendorId: string,
  categoryId: string,
  name: string,
  price: number,
  marketId: string = DEFAULT_MARKET_ID,
  currency = "SAR",
  imageUrl: string = SEED_IMAGE_DEFAULT,
) {
  return prisma.product.create({
    data: {
      marketId,
      vendorId,
      categoryId,
      name,
      price,
      currency,
      status: "PUBLISHED",
      isActive: true,
      images: {
        create: {
          url: imageUrl,
          sortOrder: 0,
          isPrimary: true,
        },
      },
    },
  });
}

async function seedCatalogAndOrders() {
  const buyer = await prisma.user.findUnique({ where: { email: "test@example.com" }, select: { id: true } });
  if (!buyer) {
    console.log("Seed orders skipped: test user (test@example.com) not found.");
    return;
  }

  const existingCount = await prisma.order.count({ where: { buyerUserId: buyer.id } });
  if (existingCount > 0) {
    console.log("Seed orders skipped: buyer already has orders.");
    return;
  }

  const vendorUsers = await prisma.user.findMany({
    where: { userRoles: { some: { role: { code: "VENDOR" } } } },
    take: 2,
    select: { id: true, name: true },
  });

  const base = Date.now();

  if (vendorUsers.length === 0) {
    await prisma.order.createMany({
      data: [
        {
          marketId: DEFAULT_MARKET_ID,
          buyerUserId: buyer.id,
          orderNo: `ORD-SEED-${base}-1`,
          status: "NEW",
          subtotal: 100,
          shippingFee: 12,
          discountTotal: 0,
          vatTotal: 16.8,
          totalAmount: 128.8,
          createdAt: new Date(),
        },
        {
          marketId: DEFAULT_MARKET_ID,
          buyerUserId: buyer.id,
          orderNo: `ORD-SEED-${base}-2`,
          status: "SHIPPED",
          subtotal: 250.5,
          shippingFee: 15,
          discountTotal: 25,
          vatTotal: 36.08,
          totalAmount: 276.58,
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          marketId: DEFAULT_MARKET_ID,
          buyerUserId: buyer.id,
          orderNo: `ORD-SEED-${base}-3`,
          status: "COMPLETED",
          subtotal: 49.99,
          shippingFee: 10,
          discountTotal: 0,
          vatTotal: 9,
          totalAmount: 68.99,
          createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        },
      ],
    });
    console.log("Seed complete: header-only sample orders (no vendors in DB).");
    return;
  }

  const v1 = await ensureVendor(vendorUsers[0].id, `${vendorUsers[0].name} — Demo store`);
  const gadget = await seedPublishedProduct(v1.id, SEED_CATEGORY_ELECTRONICS, "Demo gadget", 40);

  let v2 = v1;
  let secondProduct = await seedPublishedProduct(v1.id, SEED_CATEGORY_GENERAL, "Demo accessory", 120);

  if (vendorUsers.length >= 2) {
    v2 = await ensureVendor(vendorUsers[1].id, `${vendorUsers[1].name} — Partner shop`);
    secondProduct = await seedPublishedProduct(v2.id, SEED_CATEGORY_GENERAL, "Partner SKU", 150);
  }

  const line1Total = roundMoney(2 * Number(gadget.price));
  const line2Total = roundMoney(1 * Number(secondProduct.price));
  const subtotal1 = roundMoney(line1Total + line2Total);
  const ship1 = 15;
  const disc1 = 10;
  const taxable1 = roundMoney(subtotal1 + ship1 - disc1);
  const vat1 = roundMoney(taxable1 * 0.15);
  const total1 = roundMoney(taxable1 + vat1);

  await prisma.order.create({
    data: {
      marketId: DEFAULT_MARKET_ID,
      buyerUserId: buyer.id,
      orderNo: `ORD-SEED-${base}-1`,
      status: "NEW",
      subtotal: subtotal1,
      shippingFee: ship1,
      discountTotal: disc1,
      vatTotal: vat1,
      totalAmount: total1,
      createdAt: new Date(),
      items: {
        create: [
          {
            vendorId: v1.id,
            productId: gadget.id,
            productNameSnapshot: gadget.name,
            vendorNameSnapshot: v1.storeName,
            quantity: 2,
            unitPrice: gadget.price,
            lineTotal: line1Total,
          },
          {
            vendorId: v2.id,
            productId: secondProduct.id,
            productNameSnapshot: secondProduct.name,
            vendorNameSnapshot: v2.storeName,
            quantity: 1,
            unitPrice: secondProduct.price,
            lineTotal: line2Total,
          },
        ],
      },
    },
  });

  const ship2 = 15;
  const disc2 = 25;
  const lineShip = roundMoney(1 * Number(secondProduct.price));
  const sub2 = lineShip;
  const taxable2 = roundMoney(sub2 + ship2 - disc2);
  const vat2 = roundMoney(taxable2 * 0.15);
  const total2 = roundMoney(taxable2 + vat2);

  await prisma.order.create({
    data: {
      marketId: DEFAULT_MARKET_ID,
      buyerUserId: buyer.id,
      orderNo: `ORD-SEED-${base}-2`,
      status: "SHIPPED",
      subtotal: sub2,
      shippingFee: ship2,
      discountTotal: disc2,
      vatTotal: vat2,
      totalAmount: total2,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            vendorId: secondProduct.vendorId,
            productId: secondProduct.id,
            productNameSnapshot: secondProduct.name,
            vendorNameSnapshot: v2.storeName,
            quantity: 1,
            unitPrice: secondProduct.price,
            lineTotal: lineShip,
          },
        ],
      },
    },
  });

  const ship3 = 10;
  const line3 = roundMoney(1 * 49.99);
  const sub3 = line3;
  const taxable3 = roundMoney(sub3 + ship3);
  const vat3 = roundMoney(taxable3 * 0.15);
  const total3 = roundMoney(taxable3 + vat3);
  const budget = await seedPublishedProduct(v1.id, SEED_CATEGORY_GENERAL, "Budget item", 49.99);

  await prisma.order.create({
    data: {
      marketId: DEFAULT_MARKET_ID,
      buyerUserId: buyer.id,
      orderNo: `ORD-SEED-${base}-3`,
      status: "COMPLETED",
      subtotal: sub3,
      shippingFee: ship3,
      discountTotal: 0,
      vatTotal: vat3,
      totalAmount: total3,
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            vendorId: v1.id,
            productId: budget.id,
            productNameSnapshot: budget.name,
            vendorNameSnapshot: v1.storeName,
            quantity: 1,
            unitPrice: budget.price,
            lineTotal: line3,
          },
        ],
      },
    },
  });

  console.log("Seed complete: sample vendors, products, and orders with line items.");
}

async function attachRoleByCode(userId: string, roleCode: string) {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new Error(`${roleCode} role missing — run seedRoles first.`);
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
}

function seedMinWithdrawalAmountSar(): number {
  const raw = process.env.MIN_WITHDRAWAL_AMOUNT_SAR;
  if (raw === undefined || raw.trim() === "") return 250;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 250;
  return Math.round(parsed * 100) / 100;
}

async function seedPlatformConfig() {
  const minWithdrawal = seedMinWithdrawalAmountSar();
  const base = {
    cashbackRate: 0.05,
    affiliatePoolRate: 0.1,
    affiliateLevel1Rate: 0.05,
    affiliateLevel2Rate: 0.02,
    affiliateLevel3Rate: 0.02,
    affiliateLevel4Rate: 0.01,
    vendorRate: 0.7,
    platformRate: 0.3,
    vatRate: 0.15,
    minWithdrawalAmount: minWithdrawal,
    returnWindowDays: 15,
  };

  const configs = [
    { id: "config_market_sa", marketId: "market_sa" },
    { id: "config_market_om", marketId: "market_om" },
    { id: "config_market_eg", marketId: "market_eg" },
    { id: "config_market_global", marketId: "market_global" },
  ] as const;

  for (const row of configs) {
    await prisma.platformConfig.upsert({
      where: { marketId: row.marketId },
      create: { id: row.id, marketId: row.marketId, ...base },
      update: { minWithdrawalAmount: minWithdrawal },
    });
  }
  console.log(`Platform config seed: ${configs.length} markets, min withdrawal ${minWithdrawal}.`);
}

async function ensureAdminUser() {
  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (!adminRole) {
    throw new Error("ADMIN role missing — run seedRoles first.");
  }

  const existing = await prisma.user.findUnique({
    where: { email: DEMO_ADMIN_EMAIL },
    include: { userRoles: { where: { roleId: adminRole.id } } },
  });

  if (existing) {
    if (existing.userRoles.length === 0) {
      await prisma.userRole.create({
        data: { userId: existing.id, roleId: adminRole.id },
      });
      console.log(`Admin seed: attached ADMIN role to existing user ${DEMO_ADMIN_EMAIL}.`);
    } else {
      console.log(`Admin seed: ${DEMO_ADMIN_EMAIL} already exists with ADMIN role — skip create.`);
    }
    await attachRoleByCode(existing.id, "SUPER_ADMIN");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      name: "Demo Admin (seed)",
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      userRoles: {
        create: { roleId: adminRole.id },
      },
    },
  });

  await attachRoleByCode(user.id, "SUPER_ADMIN");
  console.log(`Admin seed: created admin user. Login: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

async function ensureDemoVendorUserForCatalog() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_VENDOR_EMAIL } });
  if (existing) return existing;

  const vendorRole = await prisma.role.findUnique({ where: { code: "VENDOR" } });
  if (!vendorRole) {
    throw new Error("VENDOR role missing — run seedRoles first.");
  }

  const passwordHash = await bcrypt.hash(DEMO_VENDOR_PASSWORD, 10);
  return prisma.user.create({
    data: {
      name: "Demo Vendor (seed)",
      email: DEMO_VENDOR_EMAIL,
      passwordHash,
      userRoles: {
        create: { roleId: vendorRole.id },
      },
    },
  });
}

/**
 * Ensures /products always has something to show: reactivates inactive rows,
 * or creates a dedicated demo vendor + 3 SAR products when the catalog is empty.
 */
async function seedBrowseCatalog() {
  const activeCount = await prisma.product.count({
    where: { status: "PUBLISHED", marketId: DEFAULT_MARKET_ID },
  });
  if (activeCount > 0) {
    console.log(`Catalog browse: ${activeCount} published product(s) already — skip.`);
    return;
  }

  const unpublishedCount = await prisma.product.count({ where: { status: { not: "PUBLISHED" } } });
  if (unpublishedCount > 0) {
    await prisma.product.updateMany({
      where: { status: { not: "PUBLISHED" } },
      data: { status: "PUBLISHED", isActive: true },
    });
    console.log(`Catalog browse: published ${unpublishedCount} product(s).`);
    return;
  }

  const vendorUser = await ensureDemoVendorUserForCatalog();
  const vendor = await ensureVendor(vendorUser.id, "Demo Marketplace — seed catalog", DEFAULT_MARKET_ID);

  const demoProducts = [
    { name: "Starter kit", price: 99, categoryId: SEED_CATEGORY_ELECTRONICS },
    { name: "Premium bundle", price: 249.5, categoryId: SEED_CATEGORY_GENERAL },
    { name: "Accessory pack", price: 39.99, categoryId: SEED_CATEGORY_GENERAL },
  ];
  for (const item of demoProducts) {
    await seedPublishedProduct(vendor.id, item.categoryId, item.name, item.price);
  }

  console.log(
    `Catalog browse: created 3 demo products. Vendor login: ${DEMO_VENDOR_EMAIL} / ${DEMO_VENDOR_PASSWORD}`,
  );
}

async function seedVendorBills() {
  const vendors = await prisma.vendor.findMany({ select: { id: true } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  for (const vendor of vendors) {
    const count = await prisma.vendorBill.count({ where: { vendorId: vendor.id } });
    if (count > 0) continue;
    await prisma.vendorBill.createMany({
      data: [
        {
          vendorId: vendor.id,
          type: "PLAN_FEE",
          description: "Marketplace plan — Free tier",
          amount: 0,
          currency: "SAR",
          status: "WAIVED",
          periodStart: monthStart,
          periodEnd: monthEnd,
        },
        {
          vendorId: vendor.id,
          type: "PLATFORM_FEE",
          description: "Platform service fee (stub)",
          amount: 49,
          currency: "SAR",
          status: "PENDING",
          periodStart: monthStart,
          periodEnd: monthEnd,
        },
      ],
    });
  }
  if (vendors.length > 0) {
    console.log(`Seed bills: stub invoices for ${vendors.length} vendor(s).`);
  }
}

async function seedDemoCoupons() {
  const vendors = await prisma.vendor.findMany({ select: { id: true, storeName: true } });
  if (vendors.length === 0) return;

  for (const vendor of vendors) {
    await prisma.coupon.upsert({
      where: { vendorId_code: { vendorId: vendor.id, code: "SAVE10" } },
      create: {
        vendorId: vendor.id,
        code: "SAVE10",
        description: "10% off this store (demo checkout coupon)",
        discountType: "PERCENT",
        discountValue: 10,
        status: "ACTIVE",
        currency: "SAR",
      },
      update: {
        status: "ACTIVE",
        discountType: "PERCENT",
        discountValue: 10,
      },
    });
  }

  console.log(`Seed coupons: SAVE10 (10% off, ACTIVE) for ${vendors.length} vendor(s).`);
}

async function seedDemoVendorKyc() {
  const vendorUser = await ensureDemoVendorUserForCatalog();
  const vendors = await prisma.vendor.findMany({ where: { ownerUserId: vendorUser.id } });
  if (vendors.length === 0) {
    console.log("Demo vendor KYC skipped: vendor profile not found.");
    return;
  }

  const admin = await prisma.user.findUnique({
    where: { email: DEMO_ADMIN_EMAIL },
    select: { id: true },
  });
  const now = new Date();
  const representativeIdExpiry = new Date("2030-12-31T00:00:00.000Z");

  for (const vendor of vendors) {
    const subjectKey = `vendor:${vendor.id}`;
    for (const documentType of VENDOR_KYC_DOCUMENT_TYPES) {
      const storageKey = `kyc-documents/seed/demo-vendor-${vendor.marketId}-${documentType.toLowerCase()}.pdf`;
      await prisma.kycDocument.upsert({
        where: {
          subjectKey_documentType: { subjectKey, documentType },
        },
        create: {
          subjectType: "VENDOR",
          subjectKey,
          vendorId: vendor.id,
          documentType,
          status: "ACCEPTED",
          storageKey,
          originalFileName: `seed-${documentType.toLowerCase()}.pdf`,
          mimeType: "application/pdf",
          fileSizeBytes: 2048,
          documentExpiresAt: documentType === "REPRESENTATIVE_ID" ? representativeIdExpiry : null,
          ibanNumber: documentType === "IBAN" ? SEED_DEMO_VENDOR_IBAN : null,
          submittedAt: now,
          reviewedAt: now,
          reviewedByUserId: admin?.id ?? null,
        },
        update: {
          status: "ACCEPTED",
          storageKey,
          originalFileName: `seed-${documentType.toLowerCase()}.pdf`,
          mimeType: "application/pdf",
          fileSizeBytes: 2048,
          documentExpiresAt: documentType === "REPRESENTATIVE_ID" ? representativeIdExpiry : null,
          ibanNumber: documentType === "IBAN" ? SEED_DEMO_VENDOR_IBAN : null,
          rejectionReason: null,
          submittedAt: now,
          reviewedAt: now,
          reviewedByUserId: admin?.id ?? null,
        },
      });
    }
  }

  console.log(
    `Seed KYC: ${DEMO_VENDOR_EMAIL} — all vendor documents ACCEPTED for ${vendors.length} marketplace(s).`,
  );
}

async function seedDemoVendorSetupComplete() {
  const vendorUser = await ensureDemoVendorUserForCatalog();
  const now = new Date();

  for (const def of DEMO_VENDOR_STORES) {
    await ensureVendor(vendorUser.id, def.storeName, def.marketId, def.countryCode, def.city);
  }

  const vendors = await prisma.vendor.findMany({
    where: { ownerUserId: vendorUser.id },
    select: { id: true, marketId: true, storeName: true },
  });

  for (const vendor of vendors) {
    const shippingFee = SEED_SHIPPING_FEE_BY_MARKET[vendor.marketId] ?? 15;
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        logoUrl: SEED_VENDOR_LOGO_URL,
        bannerUrl: SEED_VENDOR_BANNER_URL,
        shippingMode: "DIRECT",
        indirectFulfillment: null,
        shippingFee,
        defaultShippingFee: shippingFee,
        shippingNotes: "Seed demo — direct fulfillment",
        shippingProfileStatus: "APPROVED",
        shippingApprovedAt: now,
        shippingSetupAt: now,
        shippingFeeSetByAdmin: false,
        payoutAccountHolder: vendor.storeName,
        payoutIban: SEED_DEMO_VENDOR_IBAN,
        payoutSetupAt: now,
      },
    });
  }

  console.log(
    `Seed vendor setup: ${DEMO_VENDOR_EMAIL} — branding, shipping, payout complete for ${vendors.length} marketplace(s).`,
  );
}

async function seedVendorContactPhones() {
  const vendors = await prisma.vendor.findMany({ select: { id: true, contactPhone: true } });
  let i = 1;
  for (const v of vendors) {
    if (v.contactPhone) continue;
    await prisma.vendor.update({
      where: { id: v.id },
      data: { contactPhone: `+9665000000${String(i).padStart(2, "0")}` },
    });
    i += 1;
  }
}

const SEED_MARKETS = [
  {
    id: "market_sa",
    code: "SA",
    subdomain: "sa",
    nameEn: "Saudi Arabia",
    nameAr: "السعودية",
    defaultCurrency: "SAR",
    geoCountryCodes: ["SA"],
    sortOrder: 1,
  },
  {
    id: "market_om",
    code: "OM",
    subdomain: "om",
    nameEn: "Oman",
    nameAr: "عُمان",
    defaultCurrency: "OMR",
    geoCountryCodes: ["OM"],
    sortOrder: 2,
  },
  {
    id: "market_eg",
    code: "EG",
    subdomain: "eg",
    nameEn: "Egypt",
    nameAr: "مصر",
    defaultCurrency: "EGP",
    geoCountryCodes: ["EG"],
    sortOrder: 3,
  },
  {
    id: "market_global",
    code: "GLOBAL",
    subdomain: "global",
    nameEn: "Global",
    nameAr: "عالمي",
    defaultCurrency: "USD",
    geoCountryCodes: [] as string[],
    sortOrder: 4,
  },
] as const;

async function seedMarkets() {
  for (const def of SEED_MARKETS) {
    await prisma.market.upsert({
      where: { code: def.code },
      update: {
        subdomain: def.subdomain,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        defaultCurrency: def.defaultCurrency,
        geoCountryCodes: [...def.geoCountryCodes],
        isActive: true,
        sortOrder: def.sortOrder,
      },
      create: {
        id: def.id,
        code: def.code,
        subdomain: def.subdomain,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        defaultCurrency: def.defaultCurrency,
        geoCountryCodes: [...def.geoCountryCodes],
        isActive: true,
        sortOrder: def.sortOrder,
      },
    });
  }
  console.log("Seed markets: SA, OM, EG, GLOBAL");
}

async function ensureMarketCategory(
  marketId: string,
  id: string,
  slug: string,
  nameEn: string,
  nameAr: string,
  sortOrder: number,
) {
  return prisma.productCategory.upsert({
    where: { marketId_slug: { marketId, slug } },
    create: { id, marketId, slug, nameEn, nameAr, sortOrder, isActive: true },
    update: { nameEn, nameAr, isActive: true },
  });
}

async function seedPilotMarketCatalog() {
  const vendorUser = await ensureDemoVendorUserForCatalog();
  const pilots: Array<{
    code: MarketCode;
    marketId: string;
    currency: string;
    countryCode: string;
    city: string;
    storeName: string;
    bannerEn: string;
    bannerAr: string;
    products: Array<{ name: string; price: number }>;
  }> = [
    {
      code: "OM",
      marketId: MARKET_IDS.OM,
      currency: "OMR",
      countryCode: "OM",
      city: "Muscat",
      storeName: "Demo Oman Store",
      bannerEn: "Shop Oman — OMR marketplace",
      bannerAr: "تسوق عُمان — سوق الريال العُماني",
      products: [
        { name: "Oman starter kit", price: 12.5 },
        { name: "Oman premium bundle", price: 29.99 },
      ],
    },
    {
      code: "EG",
      marketId: MARKET_IDS.EG,
      currency: "EGP",
      countryCode: "EG",
      city: "Cairo",
      storeName: "Demo Egypt Store",
      bannerEn: "Shop Egypt — EGP marketplace",
      bannerAr: "تسوق مصر — سوق الجنيه المصري",
      products: [
        { name: "Egypt starter kit", price: 499 },
        { name: "Egypt premium bundle", price: 1299 },
      ],
    },
    {
      code: "GLOBAL",
      marketId: MARKET_IDS.GLOBAL,
      currency: "USD",
      countryCode: "US",
      city: "New York",
      storeName: "Demo Global Store",
      bannerEn: "Global marketplace — USD",
      bannerAr: "السوق العالمي — دولار أمريكي",
      products: [
        { name: "Global starter kit", price: 29 },
        { name: "Global premium bundle", price: 79 },
      ],
    },
  ];

  for (const pilot of pilots) {
    const published = await prisma.product.count({
      where: { marketId: pilot.marketId, status: "PUBLISHED" },
    });
    if (published > 0) continue;

    const general = await ensureMarketCategory(
      pilot.marketId,
      `cat_general_${pilot.code.toLowerCase()}`,
      "general",
      "General",
      "عام",
      99,
    );
    const vendor = await ensureVendor(
      vendorUser.id,
      pilot.storeName,
      pilot.marketId,
      pilot.countryCode,
      pilot.city,
    );
    for (const item of pilot.products) {
      await seedPublishedProduct(
        vendor.id,
        general.id,
        item.name,
        item.price,
        pilot.marketId,
        pilot.currency,
      );
    }
    await prisma.marketBanner.upsert({
      where: { id: `banner_${pilot.code.toLowerCase()}_hero` },
      create: {
        id: `banner_${pilot.code.toLowerCase()}_hero`,
        marketId: pilot.marketId,
        titleEn: pilot.bannerEn,
        titleAr: pilot.bannerAr,
        subtitleEn: `Featured offers in ${pilot.code} only`,
        subtitleAr: `عروض مميزة في سوق ${pilot.code} فقط`,
        linkUrl: "/products",
        sortOrder: 0,
        isActive: true,
      },
      update: {
        titleEn: pilot.bannerEn,
        titleAr: pilot.bannerAr,
        isActive: true,
      },
    });
    console.log(`Seed pilot catalog: ${pilot.code} (${pilot.products.length} products)`);
  }

  await prisma.marketBanner.upsert({
    where: { id: "banner_sa_hero" },
    create: {
      id: "banner_sa_hero",
      marketId: DEFAULT_MARKET_ID,
      titleEn: "Saudi marketplace — SAR",
      titleAr: "السوق السعودي — ريال سعودي",
      subtitleEn: "Your existing catalog and cashback rules",
      subtitleAr: "كتالوجك الحالي وقواعد الاسترداد النقدي",
      linkUrl: "/products",
      sortOrder: 0,
      isActive: true,
    },
    update: { isActive: true },
  });
}

async function main() {
  await seedRoles();
  await seedMarkets();
  await seedPlatformConfig();
  await ensureAdminUser();
  await seedCatalogAndOrders();
  await seedBrowseCatalog();
  await seedPilotMarketCatalog();
  await seedDemoCoupons();
  await seedVendorBills();
  await seedVendorContactPhones();
  await seedDemoVendorSetupComplete();
  await seedDemoVendorKyc();
  console.log("Seed complete: roles initialized.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
