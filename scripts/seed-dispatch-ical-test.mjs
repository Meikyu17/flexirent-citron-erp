#!/usr/bin/env node

import "dotenv/config";
import {
  DispatchIcalOperationType,
  PrismaClient,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

const DEFAULT_EMPLOYEES = ["Nathan", "Louise", "Adrian", "Aimery"];

function hashSuffix(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function slugifyEmployeeName(name) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const safeBase = base || "agent";
  return `${safeBase}-${hashSuffix(name)}`;
}

function extractFakeEmployeesFromPage() {
  try {
    const content = readFileSync("app/page.tsx", "utf8");
    const employeeStatsBlock = content.match(
      /const\s+employeeStats\s*:\s*EmployeeStat\[\]\s*=\s*\[(?<block>[\s\S]*?)\];/,
    )?.groups?.block;

    if (!employeeStatsBlock) {
      return DEFAULT_EMPLOYEES;
    }

    const names = [...employeeStatsBlock.matchAll(/name:\s*"([^"]+)"/g)].map(
      (match) => match[1].trim(),
    );

    return names.length > 0 ? names : DEFAULT_EMPLOYEES;
  } catch {
    return DEFAULT_EMPLOYEES;
  }
}

function testEventAt(index) {
  const start = new Date();
  start.setDate(start.getDate() + 1 + index);
  start.setHours(9 + index, 30, 0, 0);
  const end = new Date(start.getTime() + 45 * 60_000);
  return { start, end };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquante");
  }

  const employees = extractFakeEmployeesFromPage();
  const baseUrl = process.env.ICAL_BASE_URL ?? "http://localhost:3000";
  const locations = ["Jean-Jaures", "Citron Centre", "Parking Q4", "Atelier Flexirent"];
  const vehicles = [
    { model: "Citroen C3", plate: "AA-101-AA" },
    { model: "Peugeot 208", plate: "BB-202-BB" },
    { model: "Renault Clio", plate: "CC-303-CC" },
    { model: "Toyota Yaris", plate: "DD-404-DD" },
  ];

  const links = [];

  for (const [index, employeeName] of employees.entries()) {
    const cleanName = employeeName.trim();
    if (!cleanName) continue;

    const slug = slugifyEmployeeName(cleanName);
    const { start, end } = testEventAt(index);
    const location = locations[index % locations.length];
    const vehicle = vehicles[index % vehicles.length];
    const operationType =
      index % 2 === 0
        ? DispatchIcalOperationType.PICKUP
        : DispatchIcalOperationType.RETURN;

    const employee = await prisma.dispatchIcalEmployee.upsert({
      where: { name: cleanName },
      create: {
        name: cleanName,
        slug,
        token: randomUUID().replace(/-/g, ""),
      },
      update: {
        slug,
      },
      select: {
        id: true,
        name: true,
        token: true,
      },
    });

    await prisma.dispatchIcalEvent.upsert({
      where: {
        employeeId_dispatchRef: {
          employeeId: employee.id,
          dispatchRef: `TEST-ICAL-${slug}`,
        },
      },
      create: {
        employeeId: employee.id,
        dispatchRef: `TEST-ICAL-${slug}`,
        reservationRef: `R-TEST-${index + 1}`,
        missionLabel: `Mission test iCal ${index + 1}`,
        customerName: `Client Test ${index + 1}`,
        operationType,
        agencyLabel: index % 2 === 0 ? "Citron Location" : "Flexirent",
        sourceLabel: index % 2 === 0 ? "Fleetee" : "Getaround",
        vehicleModel: vehicle.model,
        plateNumber: vehicle.plate,
        appointmentLocation: location,
        appointmentAt: start,
        endsAt: end,
        notes:
          operationType === DispatchIcalOperationType.PICKUP
            ? `Le vehicule est a recuperer a ${location}.`
            : `Le vehicule est a retourner a ${location}.`,
      },
      update: {
        reservationRef: `R-TEST-${index + 1}`,
        missionLabel: `Mission test iCal ${index + 1}`,
        customerName: `Client Test ${index + 1}`,
        operationType,
        agencyLabel: index % 2 === 0 ? "Citron Location" : "Flexirent",
        sourceLabel: index % 2 === 0 ? "Fleetee" : "Getaround",
        vehicleModel: vehicle.model,
        plateNumber: vehicle.plate,
        appointmentLocation: location,
        appointmentAt: start,
        endsAt: end,
        notes:
          operationType === DispatchIcalOperationType.PICKUP
            ? `Le vehicule est a recuperer a ${location}.`
            : `Le vehicule est a retourner a ${location}.`,
      },
    });

    links.push({
      employee: employee.name,
      url: `${baseUrl}/api/dispatch/ical?token=${employee.token}`,
    });
  }

  console.log(`Liens iCal de test crees: ${links.length}`);
  for (const link of links) {
    console.log(`${link.employee}: ${link.url}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
