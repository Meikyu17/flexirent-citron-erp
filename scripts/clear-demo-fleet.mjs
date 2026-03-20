#!/usr/bin/env node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquante");
  }

  const result = await prisma.vehicle.deleteMany({
    where: {
      externalId: {
        startsWith: "demo_",
      },
    },
  });

  console.log(`${result.count} faux vehicules supprimes.`);
  console.log("Les agences restent en base si elles sont utilisees ailleurs.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
