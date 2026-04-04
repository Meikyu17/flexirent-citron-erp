import {
  DispatchStatus,
  RentalPlatform,
  ReservationSource,
  VehicleOperationalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BookingItem, DispatchItem } from "@/app/dashboard/shared/types";

function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toHourLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${hh}h${min}`;
}

const sourceFromReservation: Record<ReservationSource, BookingItem["source"]> = {
  FLEETEE_A: "Fleetee A",
  FLEETEE_B: "Fleetee B",
  GETAROUND: "Getaround",
  TURO: "Turo",
  OTHER: "Direct",
};

const sourceFromPlatform: Record<RentalPlatform, BookingItem["source"]> = {
  FLEETEE: "Fleetee A",
  GETAROUND: "Getaround",
  TURO: "Turo",
  DIRECT: "Direct",
};

// ── Dispatch records (from Reservation) ─────────────────────────────────────

export type DispatchRow = Awaited<ReturnType<typeof listActiveDispatches>>[number];

export async function listActiveDispatches() {
  return prisma.dispatch.findMany({
    where: { status: { not: DispatchStatus.DONE } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      reservation: {
        include: {
          vehicle: { select: { model: true, plateNumber: true } },
          agency: { select: { brand: true } },
        },
      },
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export function serializeDispatchRow(row: DispatchRow): {
  dispatchItem: DispatchItem;
  booking: BookingItem;
} {
  const res = row.reservation;
  const now = new Date();
  const isOngoing = res.startsAt <= now && res.endsAt >= now;
  const type: BookingItem["type"] = isOngoing ? "RETURN" : "PICKUP";

  const booking: BookingItem = {
    id: res.id,
    date: toIsoDate(res.pickupAt),
    type,
    client: res.customerName ?? "Client",
    pickup: `Backoffice / ${toHourLabel(res.pickupAt)}`,
    dropoff: `Backoffice / ${toHourLabel(res.dropoffAt)}`,
    dropoffDate: toIsoDate(res.dropoffAt),
    car: res.vehicle.model,
    plateNumber: res.vehicle.plateNumber,
    amount: res.amountCents / 100,
    source: sourceFromReservation[res.source],
    agency: res.agency.brand,
    startAtIso: res.startsAt.toISOString(),
    endAtIso: res.endsAt.toISOString(),
  };

  const memberName = row.assignedUser
    ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`.trim()
    : null;

  const dispatchItem: DispatchItem = {
    id: row.id,
    bookingRef: res.id,
    mission: row.missionLabel,
    members: memberName ? [memberName] : [],
    state: row.status === DispatchStatus.ASSIGNED ? "Assigné" : "À assigner",
  };

  return { dispatchItem, booking };
}

export async function setDispatchAssignment(dispatchId: string, userId: string | null) {
  return prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      assignedUserId: userId,
      status: userId ? DispatchStatus.ASSIGNED : DispatchStatus.TODO,
    },
  });
}

// ── Status log missions (from VehicleStatusLog RESERVED) ────────────────────

export type StatusLogRow = Awaited<ReturnType<typeof listActiveStatusLogMissions>>[number];

export async function listActiveStatusLogMissions() {
  const now = new Date();
  return prisma.vehicleStatusLog.findMany({
    where: {
      status: VehicleOperationalStatus.RESERVED,
      startsAt: { not: null },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: "asc" },
    include: {
      vehicle: {
        select: {
          model: true,
          plateNumber: true,
          agency: { select: { brand: true } },
        },
      },
    },
  });
}

export function serializeStatusLogMission(row: StatusLogRow): {
  dispatchItem: DispatchItem;
  booking: BookingItem;
} {
  const now = new Date();
  const startsAt = row.startsAt!;
  const endsAt = row.endsAt;
  const isOngoing = startsAt <= now && (!endsAt || endsAt >= now);
  const type: BookingItem["type"] = isOngoing ? "RETURN" : "PICKUP";
  const operation = type === "PICKUP" ? "Remise de clé" : "Retour véhicule";
  const plateShort = row.vehicle.plateNumber.split("-").slice(0, 2).join("-");
  const dateShort = `${String(startsAt.getDate()).padStart(2, "0")}/${String(startsAt.getMonth() + 1).padStart(2, "0")}`;
  const missionLabel = `${operation} · ${row.vehicle.model} · ${plateShort} · ${dateShort}`;

  const booking: BookingItem = {
    id: `log-${row.id}`,
    date: toIsoDate(startsAt),
    type,
    client: row.customerName ?? "Client",
    pickup: `Backoffice / ${toHourLabel(startsAt)}`,
    dropoff: endsAt ? `Backoffice / ${toHourLabel(endsAt)}` : "Backoffice / —",
    dropoffDate: endsAt ? toIsoDate(endsAt) : toIsoDate(startsAt),
    car: row.vehicle.model,
    plateNumber: row.vehicle.plateNumber,
    amount: 0,
    source: row.platform ? sourceFromPlatform[row.platform] : "Direct",
    agency: row.vehicle.agency.brand,
    startAtIso: startsAt.toISOString(),
    endAtIso: endsAt?.toISOString(),
  };

  const dispatchItem: DispatchItem = {
    id: `log-${row.id}`,
    bookingRef: `log-${row.id}`,
    mission: missionLabel,
    members: [],
    state: "À assigner",
  };

  return { dispatchItem, booking };
}

// ── Operators ────────────────────────────────────────────────────────────────

export async function listActiveOperators(): Promise<{ id: string; name: string }[]> {
  const [users, icalEmployees] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.dispatchIcalEmployee.findMany({
      where: { isAvailableForDispatch: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const fromUsers = users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
  }));

  // Inclure les employés iCal qui ne sont pas déjà couverts par un User
  const userNames = new Set(fromUsers.map((u) => u.name.toLowerCase()));
  const fromIcal = icalEmployees
    .filter((e) => !userNames.has(e.name.toLowerCase()))
    .map((e) => ({ id: `ical-${e.id}`, name: e.name }));

  return [...fromUsers, ...fromIcal].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
