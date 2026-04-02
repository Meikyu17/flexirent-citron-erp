#!/usr/bin/env node
/**
 * Fleetee Sync Bot
 *
 * Se connecte à chaque compte Fleetee configuré (une seule session navigateur par compte),
 * exporte :
 *   1. La liste des biens (véhicules) depuis /vehicles
 *   2. Les réservations à venir depuis /bookings
 * puis upsert tout en base de données.
 *
 * Variables d'environnement requises (par compte) :
 *   FLEETEE_A_EMAIL                Email du compte Fleetee A
 *   FLEETEE_A_PASSWORD             Mot de passe du compte Fleetee A
 *   FLEETEE_A_ACCOUNT_SLUG         Slug de l'organisation (ex: "schmidt-automobiles")
 *   FLEETEE_A_AGENCY_CODE          Code agence dans la base (ex: "citron-centre")
 *   FLEETEE_A_AGENCY_NAME          Nom de l'agence (ex: "Citron Centre")
 *   FLEETEE_A_AGENCY_CITY          Ville de l'agence (ex: "Lyon")
 *   FLEETEE_A_VEHICLE_TYPE_ID      ID du type de véhicule dans Fleetee (ex: "9754")
 *
 *   FLEETEE_B_EMAIL / FLEETEE_B_PASSWORD / ... (même chose pour le compte B)
 *
 * Optionnel :
 *   FLEETEE_HEADLESS=false         Affiche le navigateur (utile pour déboguer)
 */

import { chromium } from "playwright";
import { PrismaClient, AgencyBrand, ReservationSource } from "@prisma/client";
import { readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const prisma = new PrismaClient({ log: ["warn", "error"] });

// ─── Noms de colonnes — réservations ─────────────────────────────────────────
// À adapter si Fleetee modifie les entêtes de son export.
const BOOKING_COL = {
  ID: "Référence",
  CUSTOMER: "Locataire",
  VEHICLE_MODEL: "Véhicule",
  PLATE: "Immatriculation",
  STARTS_AT: "Début",
  ENDS_AT: "Fin",
  PICKUP_AT: "Prise en charge",
  DROPOFF_AT: "Restitution",
  AMOUNT: "Montant TTC",
  STATUS: "Statut",
};

// ─── Noms de colonnes — véhicules (page "Biens") ──────────────────────────────
const VEHICLE_COL = {
  NAME: "Nom",
  PLATE: "N° d'identification",
  STATUS: "Statut",
  CATEGORY: "Catégorie",
  AGENCY: "Agence",
  POWER: "Puissance",
  DESCRIPTION: "Description",
};

// ─── Mapping statut Fleetee → VehicleOperationalStatus ───────────────────────
const VEHICLE_STATUS_MAP = {
  "en location": "RESERVED",
  "loué": "RESERVED",
  "disponible": "AVAILABLE",
  "libre": "AVAILABLE",
  "en attente de préparation": "OUT_OF_SERVICE",
  "hors service": "OUT_OF_SERVICE",
  "en maintenance": "OUT_OF_SERVICE",
  "immobilisé": "OUT_OF_SERVICE",
};

function fleeteeStatusToOperational(raw) {
  if (!raw) return "AVAILABLE";
  const key = raw.toLowerCase().trim();
  return VEHICLE_STATUS_MAP[key] ?? "AVAILABLE";
}

// ─── Config des comptes ───────────────────────────────────────────────────────

function getAccounts() {
  const accounts = [];

  if (process.env.FLEETEE_A_EMAIL) {
    accounts.push({
      key: "A",
      email: process.env.FLEETEE_A_EMAIL,
      password: process.env.FLEETEE_A_PASSWORD ?? "",
      accountSlug: process.env.FLEETEE_A_ACCOUNT_SLUG ?? "schmidt-automobiles",
      agencyCode: process.env.FLEETEE_A_AGENCY_CODE ?? "citron-centre",
      agencyName: process.env.FLEETEE_A_AGENCY_NAME ?? "Citron Centre",
      agencyCity: process.env.FLEETEE_A_AGENCY_CITY ?? "Lyon",
      vehicleTypeId: process.env.FLEETEE_A_VEHICLE_TYPE_ID ?? "",
      source: ReservationSource.FLEETEE_A,
      brand: AgencyBrand.CITRON_LOCATION,
    });
  }

  if (process.env.FLEETEE_B_EMAIL) {
    accounts.push({
      key: "B",
      email: process.env.FLEETEE_B_EMAIL,
      password: process.env.FLEETEE_B_PASSWORD ?? "",
      accountSlug: process.env.FLEETEE_B_ACCOUNT_SLUG ?? "schmidt-automobiles",
      agencyCode: process.env.FLEETEE_B_AGENCY_CODE ?? "jean-jaures",
      agencyName: process.env.FLEETEE_B_AGENCY_NAME ?? "Jean-Jaures",
      agencyCity: process.env.FLEETEE_B_AGENCY_CITY ?? "Villeurbanne",
      vehicleTypeId: process.env.FLEETEE_B_VEHICLE_TYPE_ID ?? "",
      source: ReservationSource.FLEETEE_B,
      brand: AgencyBrand.FLEXIRENT,
    });
  }

  if (accounts.length === 0) {
    throw new Error(
      "Aucun compte Fleetee configuré. Renseignez FLEETEE_A_EMAIL et/ou FLEETEE_B_EMAIL dans .env.",
    );
  }

  return accounts;
}

// ─── Parsing CSV ──────────────────────────────────────────────────────────────

function parseCsv(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], sep).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, sep);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

function splitCsvLine(line, sep) {
  const values = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === sep && !inQuote) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

/** Accepte "DD/MM/YYYY HH:MM", "YYYY-MM-DD HH:MM", "DD/MM/YYYY", "YYYY-MM-DD". */
function parseFleeteeDate(raw) {
  if (!raw) return null;
  const iso = raw.trim().replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function parseAmountCents(raw) {
  if (!raw) return 0;
  const normalized = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const euros = parseFloat(normalized);
  return isNaN(euros) ? 0 : Math.round(euros * 100);
}

// ─── Étapes 1-4 : déclencher la génération d'un export ───────────────────────
// Ne télécharge pas — Fleetee génère le fichier de façon asynchrone.

async function triggerExport(page, account, label, downloadDir) {
  const tag = `[Fleetee ${account.key}] ${label}`;

  // Étape 1 : "Exporter la liste"
  const exportListBtn = page
    .locator(".btn-secondary:has-text('Exporter la liste'), button:has-text('Exporter la liste')")
    .first();

  if (!(await exportListBtn.isVisible({ timeout: 8_000 }).catch(() => false))) {
    const ss = join(downloadDir, `debug-${label}-1.png`);
    await page.screenshot({ path: ss, fullPage: true });
    throw new Error(
      `${tag} — bouton "Exporter la liste" introuvable. Screenshot : ${ss}\n` +
        `Relancez avec FLEETEE_HEADLESS=false pour déboguer.`,
    );
  }
  await exportListBtn.click();
  console.log(`${tag} — clic "Exporter la liste"`);

  // Étape 2 : "Exporter les X éléments"
  const exportAllBtn = page
    .locator(".btn-link:has-text('Exporter les'), span:has-text('Exporter les')")
    .first();
  await exportAllBtn.waitFor({ state: "visible", timeout: 8_000 });
  const exportAllText = await exportAllBtn.textContent();
  console.log(`${tag} — clic "${exportAllText?.trim()}"`);
  await exportAllBtn.click();

  // Étape 3 : panneau "Réglages supplémentaires" — format via #format
  const formatSelect = page.locator("#format");
  await formatSelect.waitFor({ state: "visible", timeout: 8_000 });
  await formatSelect.click();
  console.log(`${tag} — sélecteur de format ouvert`);

  const csvFormatOption = page
    .locator("[role='listbox'] [role='option']:has-text('.csv'), [role='listbox'] li:has-text('.csv')")
    .first();
  await csvFormatOption.waitFor({ state: "visible", timeout: 5_000 });
  await csvFormatOption.click();
  console.log(`${tag} — format .csv sélectionné`);

  // Étape 4 : "Lancer la génération" — génération asynchrone côté Fleetee
  const generateBtn = page
    .locator("button:has-text('Lancer la génération')")
    .first();
  await generateBtn.waitFor({ state: "visible", timeout: 5_000 });
  await generateBtn.click();
  console.log(`${tag} — génération lancée`);
}

// ─── Surveillance de ~/Downloads pour récupérer le fichier téléchargé ────────

const EXPORT_WAIT_MS = 3 * 60 * 1000; // 3 minutes

// ─── Attente + téléchargement depuis la page d'exports ───────────────────────

async function downloadLatestExport(page, context, account, label, downloadDir) {
  const tag = `[Fleetee ${account.key}] ${label}`;

  // Attente de la génération côté serveur Fleetee
  console.log(`${tag} — attente de la génération (3 min)...`);
  await page.waitForTimeout(EXPORT_WAIT_MS);

  // Navigation vers la liste des exports
  const exportsUrl = `https://app.fleetee.io/${account.accountSlug}/exports/list?page=0&limit=20`;
  console.log(`${tag} — navigation vers ${exportsUrl}`);
  await page.goto(exportsUrl);
  await page.waitForLoadState("networkidle");

  // Clic sur le premier bouton "Télécharger" (export le plus récent)
  const downloadBtn = page.locator(".badge:has-text('Télécharger')").first();
  await downloadBtn.waitFor({ state: "visible", timeout: 10_000 });

  // Playwright intercepte le téléchargement directement — pas besoin de ~/Downloads
  console.log(`${tag} — téléchargement en cours...`);
  const [download] = await Promise.all([
    context.waitForEvent("download", { timeout: 60_000 }),
    downloadBtn.click(),
  ]);

  // Sauvegarde dans le répertoire de travail du script
  const csvPath = join(downloadDir, download.suggestedFilename() || `${label}.csv`);
  await download.saveAs(csvPath);
  console.log(`${tag} — fichier sauvegardé : ${csvPath}`);

  return csvPath;
}

// ─── Sync d'un compte (une seule session navigateur) ─────────────────────────

async function syncAccount(account) {
  const headless = process.env.FLEETEE_HEADLESS !== "false";
  const downloadDir = join(tmpdir(), `fleetee-sync-${randomUUID()}`);
  await mkdir(downloadDir, { recursive: true });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  let vehiclesCsvPath = null;
  let bookingsCsvPath = null;

  try {
    // ── Connexion ──────────────────────────────────────────────────────────
    console.log(`[Fleetee ${account.key}] Connexion...`);
    await page.goto("https://app.fleetee.io/login");
    await page.waitForLoadState("domcontentloaded");

    // Champ email — plusieurs sélecteurs possibles selon la version de l'UI
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="mail" i]',
    ];
    let emailField = null;
    for (const sel of emailSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        emailField = el;
        break;
      }
    }
    if (!emailField) {
      const ss = join(downloadDir, "debug-login.png");
      await page.screenshot({ path: ss, fullPage: true });
      throw new Error(`Champ email introuvable sur la page de login. Screenshot : ${ss}`);
    }
    await emailField.fill(account.email);

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]',
    ];
    for (const sel of passwordSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await el.fill(account.password);
        break;
      }
    }

    // Soumettre : bouton submit ou touche Entrée en fallback
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Connexion")',
      'button:has-text("Se connecter")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'input[type="submit"]',
    ];
    let submitted = false;
    for (const sel of submitSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await el.click();
        submitted = true;
        break;
      }
    }
    if (!submitted) {
      // Fallback : Entrée depuis le champ mot de passe
      await page.keyboard.press("Enter");
    }

    await page.waitForLoadState("networkidle");
    console.log(`[Fleetee ${account.key}] Connecté.`);

    // ── Déclenchement export véhicules ────────────────────────────────────
    const vehicleTypeParam = account.vehicleTypeId
      ? `&vehicle_type_id=${account.vehicleTypeId}`
      : "";
    const vehiclesUrl = `https://app.fleetee.io/${account.accountSlug}/vehicles?page=0&limit=500${vehicleTypeParam}`;

    console.log(`[Fleetee ${account.key}] Véhicules — navigation vers ${vehiclesUrl}`);
    await page.goto(vehiclesUrl);
    await page.waitForLoadState("networkidle");
    await triggerExport(page, account, "vehicules", downloadDir);

    // ── Attente + téléchargement véhicules depuis /exports/list ───────────
    vehiclesCsvPath = await downloadLatestExport(page, context, account, "vehicules", downloadDir);

    // ── Déclenchement export réservations ─────────────────────────────────
    const bookingsUrl = `https://app.fleetee.io/${account.accountSlug}/bookings?page=0&limit=500`;

    console.log(`[Fleetee ${account.key}] Réservations — navigation vers ${bookingsUrl}`);
    await page.goto(bookingsUrl);
    await page.waitForLoadState("networkidle");
    await triggerExport(page, account, "reservations", downloadDir);

    // ── Attente + téléchargement réservations depuis /exports/list ────────
    bookingsCsvPath = await downloadLatestExport(page, context, account, "reservations", downloadDir);
  } finally {
    await browser.close();
  }

  // ── Ingestion véhicules ────────────────────────────────────────────────────
  const vehiclesCsv = await readFile(vehiclesCsvPath, "utf-8");
  const vehicleRows = parseCsv(vehiclesCsv);
  console.log(`[Fleetee ${account.key}] Véhicules — ${vehicleRows.length} ligne(s) dans le CSV.`);
  if (vehicleRows.length > 0) {
    console.log(`[Fleetee ${account.key}] Véhicules — colonnes : ${Object.keys(vehicleRows[0]).join(" | ")}`);
    console.log(`[Fleetee ${account.key}] Véhicules — 1ère ligne : ${JSON.stringify(vehicleRows[0])}`);
  }

  const vehicleResult = await ingestVehicles(vehicleRows, account);

  await unlink(vehiclesCsvPath).catch(() => null);

  // ── Ingestion réservations ─────────────────────────────────────────────────
  const bookingsCsv = await readFile(bookingsCsvPath, "utf-8");
  const allBookingRows = parseCsv(bookingsCsv);
  console.log(
    `[Fleetee ${account.key}] Réservations — ${allBookingRows.length} ligne(s) dans le CSV.`,
  );
  if (allBookingRows.length > 0) {
    console.log(`[Fleetee ${account.key}] Réservations — colonnes : ${Object.keys(allBookingRows[0]).join(" | ")}`);
    console.log(`[Fleetee ${account.key}] Réservations — 1ère ligne : ${JSON.stringify(allBookingRows[0])}`);
  }

  const now = new Date();
  const upcoming = allBookingRows.filter((row) => {
    const endsAt = parseFleeteeDate(row[BOOKING_COL.ENDS_AT]);
    const dropoffAt = parseFleeteeDate(row[BOOKING_COL.DROPOFF_AT]);
    // Garde les réservations à venir ET les locations en cours
    // (véhicule déjà remis au locataire mais pas encore rendu)
    return (endsAt !== null && endsAt > now) || (dropoffAt !== null && dropoffAt > now);
  });
  const active = upcoming.filter((row) => {
    const status = (row[BOOKING_COL.STATUS] ?? "").toLowerCase();
    return !status.includes("annul");
  });

  console.log(
    `[Fleetee ${account.key}] Réservations — à venir : ${upcoming.length} / actives : ${active.length} (sur ${allBookingRows.length} total).`,
  );

  const bookingResult = await ingestBookings(active, account);

  await unlink(bookingsCsvPath).catch(() => null);

  return {
    vehicles: vehicleResult,
    bookings: { total: allBookingRows.length, upcoming: upcoming.length, ...bookingResult },
  };
}

// ─── Ingestion véhicules ──────────────────────────────────────────────────────

async function ingestVehicles(rows, account) {
  const agency = await prisma.agency.upsert({
    where: { code: account.agencyCode },
    update: { name: account.agencyName, brand: account.brand },
    create: {
      code: account.agencyCode,
      name: account.agencyName,
      city: account.agencyCity,
      brand: account.brand,
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const plateNumber = (row[VEHICLE_COL.PLATE] ?? "").trim();
    if (!plateNumber) {
      skipped++;
      continue;
    }

    const model = (row[VEHICLE_COL.NAME] ?? "Véhicule Fleetee").trim();
    const operationalStatus = fleeteeStatusToOperational(row[VEHICLE_COL.STATUS]);
    const statusLabel = (row[VEHICLE_COL.STATUS] ?? "").trim();
    const externalId = `fleetee-${account.key}-${plateNumber}`;

    const exists = await prisma.vehicle.findUnique({
      where: { externalId },
      select: { id: true },
    });

    await prisma.vehicle.upsert({
      where: { externalId },
      update: {
        plateNumber,
        model,
        operationalStatus,
        statusLabel,
        agencyId: agency.id,
      },
      create: {
        externalId,
        plateNumber,
        model,
        operationalStatus,
        statusLabel,
        agencyId: agency.id,
      },
    });

    if (exists) updated++;
    else created++;
  }

  console.log(
    `[Fleetee ${account.key}] Véhicules — ${created} créé(s), ${updated} mis à jour, ${skipped} ignoré(s).`,
  );

  await prisma.integrationSyncLog.create({
    data: {
      provider: "fleetee-vehicles",
      agencyCode: account.agencyCode,
      recordsCount: rows.length,
      receivedAt: new Date(),
      status: "SUCCESS",
      message: `${created} créés, ${updated} mis à jour, ${skipped} ignorés`,
      rawPayload: { created, updated, skipped, accountKey: account.key },
    },
  });

  return { total: rows.length, created, updated, skipped };
}

// ─── Ingestion réservations ───────────────────────────────────────────────────

async function ingestBookings(rows, account) {
  const agency = await prisma.agency.findUnique({ where: { code: account.agencyCode } });
  if (!agency) throw new Error(`Agence "${account.agencyCode}" introuvable en base.`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const externalId = row[BOOKING_COL.ID];
    if (!externalId) {
      skipped++;
      continue;
    }

    const startsAt = parseFleeteeDate(row[BOOKING_COL.STARTS_AT]);
    const endsAt = parseFleeteeDate(row[BOOKING_COL.ENDS_AT]);
    const pickupAt = parseFleeteeDate(row[BOOKING_COL.PICKUP_AT]) ?? startsAt;
    const dropoffAt = parseFleeteeDate(row[BOOKING_COL.DROPOFF_AT]) ?? endsAt;

    if (!startsAt || !endsAt || !pickupAt || !dropoffAt) {
      console.warn(
        `[Fleetee ${account.key}] Réservation ignorée (dates invalides) : ${externalId}`,
      );
      skipped++;
      continue;
    }

    // Associe au véhicule créé lors de l'import véhicules (même clé externalId)
    const plateNumber = (row[BOOKING_COL.PLATE] ?? "").trim();
    const vehicleExternalId = `fleetee-${account.key}-${plateNumber || externalId}`;

    const vehicle = await prisma.vehicle.upsert({
      where: { externalId: vehicleExternalId },
      update: {},
      create: {
        externalId: vehicleExternalId,
        plateNumber,
        model: (row[BOOKING_COL.VEHICLE_MODEL] ?? "Véhicule Fleetee").trim(),
        operationalStatus: "AVAILABLE",
        agencyId: agency.id,
      },
    });

    const dbExternalId = `fleetee-${account.key}-${externalId}`;
    const exists = await prisma.reservation.findUnique({
      where: { externalId: dbExternalId },
      select: { id: true },
    });

    await prisma.reservation.upsert({
      where: { externalId: dbExternalId },
      update: {
        source: account.source,
        customerName: row[BOOKING_COL.CUSTOMER] || null,
        startsAt,
        endsAt,
        pickupAt,
        dropoffAt,
        amountCents: parseAmountCents(row[BOOKING_COL.AMOUNT]),
        vehicleId: vehicle.id,
        agencyId: agency.id,
        rawPayload: row,
      },
      create: {
        externalId: dbExternalId,
        source: account.source,
        customerName: row[BOOKING_COL.CUSTOMER] || null,
        startsAt,
        endsAt,
        pickupAt,
        dropoffAt,
        amountCents: parseAmountCents(row[BOOKING_COL.AMOUNT]),
        currency: "EUR",
        vehicleId: vehicle.id,
        agencyId: agency.id,
        rawPayload: row,
      },
    });

    if (exists) updated++;
    else created++;
  }

  console.log(
    `[Fleetee ${account.key}] Réservations — ${created} créée(s), ${updated} mise(s) à jour, ${skipped} ignorée(s).`,
  );

  await prisma.integrationSyncLog.create({
    data: {
      provider: "fleetee",
      agencyCode: account.agencyCode,
      recordsCount: rows.length,
      receivedAt: new Date(),
      status: "SUCCESS",
      message: `${created} créées, ${updated} mises à jour, ${skipped} ignorées`,
      rawPayload: { created, updated, skipped, accountKey: account.key },
    },
  });

  return { created, updated, skipped };
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

async function main() {
  const accounts = getAccounts();
  console.log(`Fleetee Sync — ${accounts.length} compte(s) à synchroniser.\n`);

  const results = [];

  for (const account of accounts) {
    try {
      const result = await syncAccount(account);
      results.push({ account: account.key, ok: true, ...result });
    } catch (err) {
      console.error(`[Fleetee ${account.key}] Erreur :`, err.message);
      results.push({ account: account.key, ok: false, error: err.message });

      await prisma.integrationSyncLog.create({
        data: {
          provider: "fleetee",
          agencyCode: account.agencyCode,
          recordsCount: 0,
          receivedAt: new Date(),
          status: "ERROR",
          message: err.message,
          rawPayload: { error: err.message },
        },
      });
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("                  Résultat sync Fleetee");
  console.log("═══════════════════════════════════════════════════════");
  for (const r of results) {
    if (!r.ok) {
      console.log(`Compte ${r.account} ✗  ERREUR — ${r.error}`);
      continue;
    }
    console.log(`Compte ${r.account} ✓`);
    console.log(
      `  Véhicules   : ${r.vehicles.created} créés · ${r.vehicles.updated} mis à jour (${r.vehicles.total} total)`,
    );
    console.log(
      `  Réservations: ${r.bookings.created} créées · ${r.bookings.updated} mises à jour · ${r.bookings.upcoming} à venir / ${r.bookings.total} total`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Erreur fatale :", err);
  await prisma.$disconnect();
  process.exit(1);
});
