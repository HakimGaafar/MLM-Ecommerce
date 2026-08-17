import { bootstrapRequiredReferenceData } from "../src/bootstrap";
import { prisma } from "../src/index";

async function main() {
  await bootstrapRequiredReferenceData(prisma);
  console.log("[db:bootstrap] Required reference data is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
