import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  createStatusLog,
  findOverlappingReservationConflict,
  listStatusLogs,
  resolveReservationDisplayStatusFromDates,
  upsertSavedAddresses,
} from "@/lib/backoffice";
import { AgencyBrand, RentalPlatform, VehicleOperationalStatus } from "@prisma/client";
import { z } from "zod";

const statusLabels = {
  AVAILABLE: "Disponible",
  RESERVED: "Reserve",
  IN_RENT: "En location",
  OUT_OF_SERVICE: "Hors service",
} as const;

const brandLabels = {
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
} as const;

const platformLabels = {
  GETAROUND: "Getaround",
  FLEETEE: "Fleetee",
  TURO: "Turo",
  DIRECT: "Direct",
} as const;

function formatDateTime(date: Date | null) {
  if (!date) return "ouverte";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function serializeLog(
  log: Awaited<ReturnType<typeof listStatusLogs>>[number],
) {
  const status =
    log.status === VehicleOperationalStatus.RESERVED
      ? resolveReservationDisplayStatusFromDates(log.startsAt, log.endsAt)
      : log.status;

  const isReservation =
    log.status === VehicleOperationalStatus.RESERVED ||
    Boolean(log.startsAt) ||
    Boolean(log.endsAt);

  return {
    id: log.id,
    vehicleId: log.vehicleId,
    vehicle: log.vehicle,
    status,
    statusLabel: statusLabels[status],
    isReservation,
    customerName: log.customerName,
    customerPhone: log.customerPhone,
    startsAt: log.startsAt?.toISOString() ?? null,
    endsAt: log.endsAt?.toISOString() ?? null,
    agencyBrand: log.agencyBrand,
    agencyBrandLabel: brandLabels[log.agencyBrand],
    platform: log.platform,
    notes: log.notes,
    pickupAddress: log.pickupAddress ?? null,
    returnAddress: log.returnAddress ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 1000)
        : 15;
    const logs = await listStatusLogs(limit);
    return Response.json({ ok: true, logs: logs.map(serializeLog) });
  } catch (error) {
    console.error("GET /api/backoffice/logs failed", error);
    return Response.json(
      { ok: false, error: "Base de donnees inaccessible." },
      { status: 503 },
    );
  }
}

const createLogSchema = z.object({
  vehicleId: z.string().min(1),
  status: z.enum([
    VehicleOperationalStatus.AVAILABLE,
    VehicleOperationalStatus.RESERVED,
    "IN_RENT",
    VehicleOperationalStatus.OUT_OF_SERVICE,
  ]),
  customerName: z.string().trim().max(100).default(""),
  customerPhone: z.string().trim().max(30).default(""),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  agencyBrand: z.nativeEnum(AgencyBrand),
  platform: z.nativeEnum(RentalPlatform).nullable().optional(),
  notes: z.string().trim().max(500).default(""),
  pickupAddress: z.string().trim().max(300).nullable().optional(),
  returnAddress: z.string().trim().max(300).nullable().optional(),
  customerId: z.string().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createLogSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Donnees invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const startsAt = d.startsAt ? new Date(d.startsAt) : null;
  const endsAt = d.endsAt ? new Date(d.endsAt) : null;

  if (!startsAt && endsAt) {
    return Response.json(
      { ok: false, error: "La date de debut est requise pour une reservation." },
      { status: 400 },
    );
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    return Response.json(
      { ok: false, error: "La date de fin doit etre apres la date de debut." },
      { status: 400 },
    );
  }

  const hasReservationWindow = Boolean(startsAt);
  const normalizedStatus =
    d.status === VehicleOperationalStatus.OUT_OF_SERVICE
      ? VehicleOperationalStatus.OUT_OF_SERVICE
      : hasReservationWindow
        ? VehicleOperationalStatus.RESERVED
        : VehicleOperationalStatus.AVAILABLE;

  if (normalizedStatus === VehicleOperationalStatus.RESERVED && startsAt) {
    const conflict = await findOverlappingReservationConflict({
      vehicleId: d.vehicleId,
      startsAt,
      endsAt,
      platform: d.platform ?? null,
    });

    if (conflict) {
      const platformLabel = platformLabels[conflict.platform];
      const startLabel = formatDateTime(conflict.startsAt);
      const endLabel = formatDateTime(conflict.endsAt);
      const customer = conflict.customerName
        ? ` (client: ${conflict.customerName})`
        : "";
      return Response.json(
        {
          ok: false,
          error:
            `Chevauchement detecte avec la reservation ${platformLabel} ` +
            `[${conflict.reference}] du ${startLabel} au ${endLabel}${customer}.`,
        },
        { status: 409 },
      );
    }
  }

  const pickupAddress = d.pickupAddress || null;
  const returnAddress = d.returnAddress || null;
  const customerId = d.customerId || null;

  // Persist new addresses for future autocomplete
  await upsertSavedAddresses([pickupAddress, returnAddress]).catch(() => {});

  try {
    const log = await createStatusLog({
      vehicleId: d.vehicleId,
      status: normalizedStatus,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      startsAt,
      endsAt,
      agencyBrand: d.agencyBrand,
      platform: d.platform ?? null,
      notes: d.notes,
      pickupAddress,
      returnAddress,
      customerId,
    });
    return Response.json({ ok: true, log: serializeLog(log) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/backoffice/logs failed", error);
    return Response.json(
      { ok: false, error: "Impossible d'enregistrer le changement." },
      { status: 503 },
    );
  }
}
