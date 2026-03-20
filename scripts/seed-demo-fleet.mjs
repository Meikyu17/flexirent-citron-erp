#!/usr/bin/env node

import "dotenv/config";
import {
  AgencyBrand,
  PrismaClient,
  VehicleOperationalStatus,
} from "@prisma/client";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

const demoAgencies = [
  {
    code: "citron-centre",
    name: "Citron Centre",
    city: "Lyon",
    brand: AgencyBrand.CITRON_LOCATION,
  },
  {
    code: "jean-jaures",
    name: "Jean-Jaures",
    city: "Villeurbanne",
    brand: AgencyBrand.FLEXIRENT,
  },
];

const demoVehicles = [
  {
    externalId: "demo_citron_c3_001",
    plateNumber: "AA-101-AA",
    model: "Citroen C3",
    parkingArea: "Citron location",
    parkingSpot: "14",
    operationalStatus: VehicleOperationalStatus.AVAILABLE,
    agencyCode: "citron-centre",
  },
  {
    externalId: "demo_citron_c3_002",
    plateNumber: "AA-102-AA",
    model: "Citroen C3",
    parkingArea: "Citron location",
    parkingSpot: "18",
    operationalStatus: VehicleOperationalStatus.RESERVED,
    agencyCode: "citron-centre",
  },
  {
    externalId: "demo_clio_001",
    plateNumber: "BB-203-BB",
    model: "Renault Clio",
    parkingArea: "Atelier",
    parkingSpot: "A2",
    operationalStatus: VehicleOperationalStatus.OUT_OF_SERVICE,
    agencyCode: "citron-centre",
  },
  {
    externalId: "demo_208_001",
    plateNumber: "CC-304-CC",
    model: "Peugeot 208",
    parkingArea: "Flexirent",
    parkingSpot: "07",
    operationalStatus: VehicleOperationalStatus.AVAILABLE,
    agencyCode: "jean-jaures",
  },
  {
    externalId: "demo_206_001",
    plateNumber: "DD-405-DD",
    model: "Peugeot 206",
    parkingArea: "Flexirent",
    parkingSpot: "08",
    operationalStatus: VehicleOperationalStatus.RESERVED,
    agencyCode: "jean-jaures",
  },
  {
    externalId: "demo_yaris_001",
    plateNumber: "EE-506-EE",
    model: "Toyota Yaris",
    parkingArea: "Retour lavage",
    parkingSpot: "03",
    operationalStatus: VehicleOperationalStatus.AVAILABLE,
    agencyCode: "jean-jaures",
  },
];

function statusLabel(status) {
  switch (status) {
    case VehicleOperationalStatus.RESERVED:
      return "Reserve";
    case VehicleOperationalStatus.OUT_OF_SERVICE:
      return "Hors service";
    default:
      return "Disponible";
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquante");
  }

  for (const agency of demoAgencies) {
    await prisma.agency.upsert({
      where: { code: agency.code },
      update: {
        name: agency.name,
        city: agency.city,
        brand: agency.brand,
      },
      create: agency,
    });
  }

  for (const vehicle of demoVehicles) {
    const agency = await prisma.agency.findUniqueOrThrow({
      where: { code: vehicle.agencyCode },
      select: { id: true },
    });

    await prisma.vehicle.upsert({
      where: { externalId: vehicle.externalId },
      update: {
        plateNumber: vehicle.plateNumber,
        model: vehicle.model,
        parkingArea: vehicle.parkingArea,
        parkingSpot: vehicle.parkingSpot,
        operationalStatus: vehicle.operationalStatus,
        locationLabel: `${vehicle.parkingArea} / ${vehicle.parkingSpot}`,
        statusLabel: statusLabel(vehicle.operationalStatus),
        agencyId: agency.id,
      },
      create: {
        externalId: vehicle.externalId,
        plateNumber: vehicle.plateNumber,
        model: vehicle.model,
        parkingArea: vehicle.parkingArea,
        parkingSpot: vehicle.parkingSpot,
        operationalStatus: vehicle.operationalStatus,
        locationLabel: `${vehicle.parkingArea} / ${vehicle.parkingSpot}`,
        statusLabel: statusLabel(vehicle.operationalStatus),
        agencyId: agency.id,
      },
    });
  }

  console.log(`${demoVehicles.length} faux vehicules en base.`);
  console.log("Identifiant demo utilise: externalId commence par 'demo_'.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
