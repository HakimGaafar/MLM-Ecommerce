import { ensureLegalFoundationsData, prisma } from "../src/index";

async function main() {
  await ensureLegalFoundationsData();
  const [policies, rules, fees, markets] = await Promise.all([
    prisma.legalPolicyVersion.count(),
    prisma.marketInvoicingRule.count(),
    prisma.refundFeeRule.count(),
    prisma.market.findMany({
      select: { code: true, isActive: true, paymentCurrencies: true, defaultCurrency: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  console.log(
    JSON.stringify(
      {
        policies,
        rules,
        fees,
        markets,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
