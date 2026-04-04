import type { BookingItem, DispatchItem } from "@/app/dashboard/shared/types";
import { DispatchIcalOperationType } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

const agencyLabel: Record<BookingItem["agency"], string> = {
  CITRON_LOCATION: "Citron Location",
  FLEXIRENT: "Flexirent",
};

const sourceLabel: Record<BookingItem["source"], string> = {
  "Fleetee A": "Fleetee",
  "Fleetee B": "Fleetee",
  Getaround: "Getaround",
  Turo: "Turo",
  Direct: "Direct",
};

const DEFAULT_START_HOUR = 12;
const DEFAULT_START_MINUTE = 0;
const DEFAULT_DURATION_MINUTES = 45;

function parseSlot(rawSlot: string): { location: string; hour: number; minute: number } {
  const [rawLocation, rawTime] = rawSlot.split(" / ").map((part) => part.trim());
  const location = rawLocation || "A definir";

  const match = rawTime?.match(/^(\d{1,2})h(\d{2})$/i);
  if (!match) {
    return {
      location,
      hour: DEFAULT_START_HOUR,
      minute: DEFAULT_START_MINUTE,
    };
  }

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  return {
    location,
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : DEFAULT_START_HOUR,
    minute: Number.isFinite(minute)
      ? Math.min(59, Math.max(0, minute))
      : DEFAULT_START_MINUTE,
  };
}

function buildDateTime(isoDate: string, hour: number, minute: number): Date | null {
  const safeHour = String(hour).padStart(2, "0");
  const safeMinute = String(minute).padStart(2, "0");
  const date = new Date(`${isoDate}T${safeHour}:${safeMinute}:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function hashSuffix(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

export function slugifyEmployeeName(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const safeBase = base || "agent";
  return `${safeBase}-${hashSuffix(name)}`;
}

export function createIcalFeedToken() {
  return randomUUID().replace(/-/g, "");
}

export function operationLabel(operationType: DispatchIcalOperationType) {
  return operationType === DispatchIcalOperationType.PICKUP
    ? "Remise de cle"
    : "Retour";
}

export function formatAppointmentLabel(date: Date) {
  return date.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export type DispatchIcalEventPayload = {
  dispatchRef: string;
  reservationRef: string;
  missionLabel: string;
  customerName: string;
  operationType: DispatchIcalOperationType;
  agencyLabel: string;
  sourceLabel: string;
  vehicleModel: string;
  plateNumber: string;
  appointmentLocation: string;
  appointmentAt: Date;
  endsAt: Date;
  notes: string;
};

export function buildDispatchIcalEvent(
  dispatch: DispatchItem,
  booking: BookingItem,
): DispatchIcalEventPayload | null {
  const isPickup = booking.type === "PICKUP";
  const slot = isPickup ? parseSlot(booking.pickup) : parseSlot(booking.dropoff);
  const eventDate = isPickup ? booking.date : booking.dropoffDate;
  const startAt = buildDateTime(eventDate, slot.hour, slot.minute);

  if (!startAt) {
    return null;
  }

  const endsAt = new Date(startAt.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  const operationType = isPickup
    ? DispatchIcalOperationType.PICKUP
    : DispatchIcalOperationType.RETURN;
  const vehicleLocationSentence = isPickup
    ? `Le vehicule est a recuperer a ${slot.location}.`
    : `Le vehicule est a retourner a ${slot.location}.`;

  return {
    dispatchRef: dispatch.id,
    reservationRef: booking.id,
    missionLabel: dispatch.mission,
    customerName: booking.client,
    operationType,
    agencyLabel: agencyLabel[booking.agency],
    sourceLabel: sourceLabel[booking.source],
    vehicleModel: booking.car,
    plateNumber: booking.plateNumber,
    appointmentLocation: slot.location,
    appointmentAt: startAt,
    endsAt,
    notes: vehicleLocationSentence,
  };
}

export type IcalDescriptionInput = {
  reservationRef: string;
  missionLabel: string;
  customerName: string;
  operationType: DispatchIcalOperationType;
  vehicleModel: string;
  plateNumber: string;
  appointmentLocation: string;
  appointmentAt: Date;
  agencyLabel: string;
  sourceLabel: string;
  notes?: string | null;
};

export function buildIcalDescription(input: IcalDescriptionInput) {
  const lines = [
    `Client: ${input.customerName}`,
    `Operation: ${operationLabel(input.operationType)}`,
    `Vehicule: ${input.vehicleModel}`,
    `Plaque: ${input.plateNumber}`,
    `Rendez-vous: ${formatAppointmentLabel(input.appointmentAt)}`,
    `Emplacement: ${input.appointmentLocation}`,
    `Agence: ${input.agencyLabel}`,
    `Plateforme: ${input.sourceLabel}`,
    `Reservation: ${input.reservationRef}`,
    `Mission dispatch: ${input.missionLabel}`,
  ];

  if (input.notes) {
    lines.push(`Note: ${input.notes}`);
  }

  return lines.join("\n");
}
