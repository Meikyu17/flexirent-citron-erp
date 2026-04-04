import {
  AgencyBrand,
  RentalPlatform,
  ReservationSource,
  VehicleOperationalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { statusLabelFromOperationalStatus } from "@/lib/vehicles";

export type BackofficeDisplayStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "IN_RENT"
  | "OUT_OF_SERVICE";

export type ReservationOverlapConflict = {
  origin: "STATUS_LOG" | "SYNC_RESERVATION";
  platform: RentalPlatform;
  startsAt: Date;
  endsAt: Date | null;
  customerName: string | null;
  reference: string;
};

function isDateRangeActive(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now = new Date(),
) {
  if (!startsAt) return false;
  if (startsAt > now) return false;
  if (!endsAt) return true;
  return endsAt >= now;
}

export function resolveReservationDisplayStatusFromDates(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
  now = new Date(),
): BackofficeDisplayStatus {
  return isDateRangeActive(startsAt, endsAt, now) ? "IN_RENT" : "RESERVED";
}

function toPlatform(source: ReservationSource): RentalPlatform {
  switch (source) {
    case ReservationSource.FLEETEE_A:
    case ReservationSource.FLEETEE_B:
      return RentalPlatform.FLEETEE;
    case ReservationSource.GETAROUND:
      return RentalPlatform.GETAROUND;
    case ReservationSource.TURO:
      return RentalPlatform.TURO;
    default:
      return RentalPlatform.DIRECT;
  }
}

function normalizePlatform(platform: RentalPlatform | null): RentalPlatform {
  return platform ?? RentalPlatform.DIRECT;
}

function overlaps(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date | null,
) {
  const aEndTs = aEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEndTs = bEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  return aStart.getTime() <= bEndTs && bStart.getTime() <= aEndTs;
}

export async function findOverlappingReservationConflict(data: {
  vehicleId: string;
  startsAt: Date;
  endsAt: Date | null;
  platform: RentalPlatform | null;
  excludeStatusLogId?: string;
}) {
  const incomingPlatform = normalizePlatform(data.platform);

  const [statusLogs, reservations] = await prisma.$transaction([
    prisma.vehicleStatusLog.findMany({
      where: {
        vehicleId: data.vehicleId,
        status: VehicleOperationalStatus.RESERVED,
        startsAt: { not: null },
        ...(data.excludeStatusLogId
          ? { id: { not: data.excludeStatusLogId } }
          : {}),
        OR: [
          { endsAt: null },
          { endsAt: { gte: data.startsAt } },
        ],
      },
      select: {
        id: true,
        platform: true,
        customerName: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.reservation.findMany({
      where: {
        vehicleId: data.vehicleId,
        endsAt: { gte: data.startsAt },
      },
      select: {
        id: true,
        externalId: true,
        source: true,
        customerName: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
  ]);

  const logConflict = statusLogs.find((log) => {
    if (!log.startsAt) return false;
    const existingPlatform = normalizePlatform(log.platform);
    if (existingPlatform === incomingPlatform) return false;
    return overlaps(log.startsAt, log.endsAt, data.startsAt, data.endsAt);
  });

  if (logConflict?.startsAt) {
    return {
      origin: "STATUS_LOG",
      platform: normalizePlatform(logConflict.platform),
      startsAt: logConflict.startsAt,
      endsAt: logConflict.endsAt,
      customerName: logConflict.customerName,
      reference: logConflict.id,
    } satisfies ReservationOverlapConflict;
  }

  const reservationConflict = reservations.find((reservation) => {
    const existingPlatform = toPlatform(reservation.source);
    if (existingPlatform === incomingPlatform) return false;
    return overlaps(
      reservation.startsAt,
      reservation.endsAt,
      data.startsAt,
      data.endsAt,
    );
  });

  if (reservationConflict) {
    return {
      origin: "SYNC_RESERVATION",
      platform: toPlatform(reservationConflict.source),
      startsAt: reservationConflict.startsAt,
      endsAt: reservationConflict.endsAt,
      customerName: reservationConflict.customerName,
      reference: reservationConflict.externalId || reservationConflict.id,
    } satisfies ReservationOverlapConflict;
  }

  return null;
}

export async function listAgencies() {
  return prisma.agency.findMany({
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, brand: true },
  });
}

export async function createAgency(data: {
  name: string;
  code: string;
  city: string;
  brand: AgencyBrand;
}) {
  return prisma.agency.create({
    data: {
      name: data.name,
      code: data.code,
      city: data.city,
      brand: data.brand,
    },
    select: { id: true, code: true, name: true, brand: true },
  });
}

export async function listBackofficeVehicles() {
  const now = new Date();
  return prisma.vehicle.findMany({
    orderBy: [
      { agency: { brand: "asc" } },
      { model: "asc" },
      { plateNumber: "asc" },
    ],
    include: {
      agency: { select: { id: true, code: true, name: true, brand: true } },
      reservations: {
        where: {
          endsAt: { gte: now },
        },
        select: { id: true, startsAt: true, endsAt: true },
        take: 10,
      },
      statusLogs: {
        where: {
          status: VehicleOperationalStatus.RESERVED,
          OR: [
            {
              startsAt: { lte: now },
              OR: [{ endsAt: null }, { endsAt: { gte: now } }],
            },
            { startsAt: { gt: now } },
          ],
        },
        select: { id: true, startsAt: true, endsAt: true },
        take: 10,
      },
    },
  });
}

export function resolveBackofficeOperationalStatus(
  vehicle: {
    operationalStatus: VehicleOperationalStatus;
    reservations: { id: string; startsAt: Date; endsAt: Date }[];
    statusLogs: { id: string; startsAt: Date | null; endsAt: Date | null }[];
  },
): BackofficeDisplayStatus {
  const now = new Date();

  if (vehicle.operationalStatus === VehicleOperationalStatus.OUT_OF_SERVICE) {
    return "OUT_OF_SERVICE";
  }

  const hasActiveReservation =
    vehicle.reservations.some((reservation) =>
      isDateRangeActive(reservation.startsAt, reservation.endsAt, now),
    ) ||
    vehicle.statusLogs.some((log) =>
      isDateRangeActive(log.startsAt, log.endsAt, now),
    );

  if (hasActiveReservation) {
    return "IN_RENT";
  }

  if (vehicle.reservations.length > 0 || vehicle.statusLogs.length > 0) {
    return "RESERVED";
  }

  return "AVAILABLE";
}

export async function createVehicle(data: {
  model: string;
  plateNumber: string;
  parkingArea: string;
  parkingSpot: string;
  agencyId: string;
}) {
  const externalId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.vehicle.create({
    data: {
      externalId,
      model: data.model,
      plateNumber: data.plateNumber,
      parkingArea: data.parkingArea || null,
      parkingSpot: data.parkingSpot || null,
      locationLabel:
        [data.parkingArea, data.parkingSpot].filter(Boolean).join(" / ") ||
        null,
      agencyId: data.agencyId,
      operationalStatus: VehicleOperationalStatus.AVAILABLE,
      statusLabel: statusLabelFromOperationalStatus(
        VehicleOperationalStatus.AVAILABLE,
      ),
      isCleaned: false,
    },
    include: {
      agency: { select: { id: true, code: true, name: true, brand: true } },
    },
  });
}

export async function updateBackofficeVehicle(
  vehicleId: string,
  data: {
    model: string;
    parkingArea: string;
    parkingSpot: string;
    operationalStatus: VehicleOperationalStatus;
    isCleaned: boolean;
  },
) {
  const manualStatus =
    data.operationalStatus === VehicleOperationalStatus.OUT_OF_SERVICE
      ? VehicleOperationalStatus.OUT_OF_SERVICE
      : VehicleOperationalStatus.AVAILABLE;

  return prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      model: data.model,
      parkingArea: data.parkingArea || null,
      parkingSpot: data.parkingSpot || null,
      locationLabel:
        [data.parkingArea, data.parkingSpot].filter(Boolean).join(" / ") ||
        null,
      operationalStatus: manualStatus,
      statusLabel: statusLabelFromOperationalStatus(manualStatus),
      isCleaned: data.isCleaned,
    },
    include: {
      agency: { select: { id: true, code: true, name: true, brand: true } },
      reservations: {
        where: {
          endsAt: { gte: new Date() },
        },
        select: { id: true, startsAt: true, endsAt: true },
        take: 10,
      },
      statusLogs: {
        where: {
          status: VehicleOperationalStatus.RESERVED,
          OR: [
            {
              startsAt: { lte: new Date() },
              OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
            },
            { startsAt: { gt: new Date() } },
          ],
        },
        select: { id: true, startsAt: true, endsAt: true },
        take: 10,
      },
    },
  });
}

export async function upsertSavedAddresses(labels: (string | null | undefined)[]) {
  const valid = [...new Set(labels.filter((l): l is string => Boolean(l?.trim())))];
  for (const label of valid) {
    await prisma.savedAddress.upsert({
      where: { label },
      update: {},
      create: { label },
    });
  }
}

export async function createStatusLog(data: {
  vehicleId: string;
  status: VehicleOperationalStatus;
  customerName: string;
  customerPhone: string;
  startsAt: Date | null;
  endsAt: Date | null;
  agencyBrand: AgencyBrand;
  platform: RentalPlatform | null;
  notes: string;
  pickupAddress: string | null;
  returnAddress: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.vehicleStatusLog.create({
      data: {
        vehicleId: data.vehicleId,
        status: data.status,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        agencyBrand: data.agencyBrand,
        platform: data.platform,
        notes: data.notes || null,
        pickupAddress: data.pickupAddress || null,
        returnAddress: data.returnAddress || null,
      },
      include: {
        vehicle: { select: { model: true, plateNumber: true } },
      },
    });

    if (
      data.status === VehicleOperationalStatus.OUT_OF_SERVICE ||
      data.status === VehicleOperationalStatus.AVAILABLE
    ) {
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: {
          operationalStatus: data.status,
          statusLabel: statusLabelFromOperationalStatus(data.status),
        },
      });
    }

    return log;
  });
}

export async function updateStatusLogReservation(
  logId: string,
  data: {
    vehicleId: string;
    startsAt: Date;
    endsAt: Date | null;
  },
) {
  return prisma.vehicleStatusLog.update({
    where: { id: logId },
    data: {
      vehicleId: data.vehicleId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    },
    include: {
      vehicle: { select: { model: true, plateNumber: true } },
    },
  });
}

export async function deleteVehicle(vehicleId: string) {
  const reservationCount = await prisma.reservation.count({
    where: { vehicleId },
  });
  if (reservationCount > 0) {
    throw new Error(
      "Ce vehicule a des reservations associees et ne peut pas etre supprime.",
    );
  }
  await prisma.$transaction([
    prisma.vehicleStatusLog.deleteMany({ where: { vehicleId } }),
    prisma.vehicle.delete({ where: { id: vehicleId } }),
  ]);
}

export async function listStatusLogs(limit = 15) {
  return prisma.vehicleStatusLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      vehicle: { select: { model: true, plateNumber: true } },
    },
  });
}

export async function deleteStatusLog(logId: string) {
  return prisma.vehicleStatusLog.delete({
    where: { id: logId },
  });
}
