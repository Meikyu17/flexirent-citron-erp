#!/usr/bin/env node
// Seeds the two default agencies if they don't exist yet.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_AGENCIES = [
  {
    id: "agency-citron-location",
    code: "citron-location",
    name: "Citron Location",
    city: "Toulouse",
    brand: "CITRON_LOCATION",
  },
  {
    id: "agency-flexirent",
    code: "flexirent",
    name: "Flexirent",
    city: "Toulouse",
    brand: "FLEXIRENT",
  },
];

for (const agency of DEFAULT_AGENCIES) {
  await prisma.agency.upsert({
    where: { code: agency.code },
    update: {},
    create: agency,
  });
  console.log(`Agency seeded: ${agency.name}`);
}

await prisma.$disconnect();
