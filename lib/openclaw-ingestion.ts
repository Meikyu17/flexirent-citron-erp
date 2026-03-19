import { prisma } from "@/lib/prisma";
import type { OpenclawPayload } from "@/lib/openclaw";
import { Prisma, ReservationSource } from "@prisma/client";

const sourceMap: Record<string, ReservationSource> = {
  fleetee_a: ReservationSource.FLEETEE_A,
  fleetee_b: ReservationSource.FLEETEE_B,
  getaround: ReservationSource.GETAROUND,
  turo: ReservationSource.TURO,
  other: ReservationSource.OTHER,
};

const agencyNameMap: Record<OpenclawPayload["agencyCode"], string> = {
  "citron-centre": "Citron Centre",
  "jean-jaures": "Jean-Jaures",
};

export async function ingestOpenclawPayload(
  payload: OpenclawPayload,
  options: {
    idempotencyKey?: string | null;
    requestId?: string | null;
  },
) {
  const existingLog = options.idempotencyKey
    ? await prisma.integrationSyncLog.findFirst({
        where: { idempotencyKey: options.idempotencyKey },
      })
    : null;

  if (existingLog) {
    return {
      skippedAsDuplicate: true,
      createdReservations: 0,
      updatedReservations: 0,
      totalAmountCents: 0,
    };
  }

  const agency = await prisma.agency.upsert({
    where: { code: payload.agencyCode },
    update: {},
    create: {
      code: payload.agencyCode,
      city: payload.agencyCode === "citron-centre" ? "Lyon" : "Villeurbanne",
      name: agencyNameMap[payload.agencyCode],
    },
  });

  let createdReservations = 0;
  let updatedReservations = 0;
  let totalAmountCents = 0;

  for (const event of payload.events) {
    totalAmountCents += event.amountCents;
    const vehicle = await prisma.vehicle.upsert({
      where: { externalId: event.vehicleExternalId },
      update: {
        plateNumber: event.plateNumber,
        model: event.model ?? "Modele non renseigne",
        locationLabel: event.locationLabel,
        statusLabel: event.statusLabel,
        agencyId: agency.id,
      },
      create: {
        externalId: event.vehicleExternalId,
        plateNumber: event.plateNumber,
        model: event.model ?? "Modele non renseigne",
        locationLabel: event.locationLabel,
        statusLabel: event.statusLabel,
        agencyId: agency.id,
      },
    });

    const exists = await prisma.reservation.findUnique({
      where: { externalId: event.bookingExternalId },
      select: { id: true },
    });

    await prisma.reservation.upsert({
      where: { externalId: event.bookingExternalId },
      update: {
        source: sourceMap[event.source],
        customerName: event.customerName,
        startsAt: new Date(event.startAt),
        endsAt: new Date(event.endAt),
        pickupAt: new Date(event.pickupAt),
        dropoffAt: new Date(event.dropoffAt),
        amountCents: event.amountCents,
        currency: event.currency.toUpperCase(),
        vehicleId: vehicle.id,
        agencyId: agency.id,
        openclawScannedAt: new Date(payload.scannedAt),
        rawPayload: event as Prisma.InputJsonValue,
      },
      create: {
        externalId: event.bookingExternalId,
        source: sourceMap[event.source],
        customerName: event.customerName,
        startsAt: new Date(event.startAt),
        endsAt: new Date(event.endAt),
        pickupAt: new Date(event.pickupAt),
        dropoffAt: new Date(event.dropoffAt),
        amountCents: event.amountCents,
        currency: event.currency.toUpperCase(),
        vehicleId: vehicle.id,
        agencyId: agency.id,
        openclawScannedAt: new Date(payload.scannedAt),
        rawPayload: event as Prisma.InputJsonValue,
      },
    });

    if (exists) updatedReservations += 1;
    else createdReservations += 1;
  }

  await prisma.integrationSyncLog.create({
    data: {
      provider: "openclaw",
      agencyCode: payload.agencyCode,
      requestId: options.requestId ?? payload.requestId,
      idempotencyKey: options.idempotencyKey ?? undefined,
      recordsCount: payload.events.length,
      receivedAt: new Date(),
      status: "SUCCESS",
      message: "Ingestion terminee",
      rawPayload: payload as Prisma.InputJsonValue,
    },
  });

  return {
    skippedAsDuplicate: false,
    createdReservations,
    updatedReservations,
    totalAmountCents,
  };
}
