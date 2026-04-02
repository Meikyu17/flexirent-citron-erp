import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  createStatusLog,
  listStatusLogs,
  resolveReservationDisplayStatusFromDates,
} from "@/lib/backoffice";
import { AgencyBrand, RentalPlatform, VehicleOperationalStatus } from "@prisma/client";
import { z } from "zod";

const statusLabels = {
  AVAILABLE: "Disponible",
  RESERVED: "Réservé",
  IN_RENT: "En location",
  OUT_OF_SERVICE: "Hors service",
} as const;

const brandLabels = {
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
} as const;

function serializeLog(
  log: Awaited<ReturnType<typeof listStatusLogs>>[number],
) {
  const status =
    log.status === VehicleOperationalStatus.RESERVED
      ? resolveReservationDisplayStatusFromDates(log.startsAt, log.endsAt)
      : log.status;

  return {
    id: log.id,
    vehicle: log.vehicle,
    status,
    statusLabel: statusLabels[status],
    customerName: log.customerName,
    customerPhone: log.customerPhone,
    startsAt: log.startsAt?.toISOString() ?? null,
    endsAt: log.endsAt?.toISOString() ?? null,
    agencyBrand: log.agencyBrand,
    agencyBrandLabel: brandLabels[log.agencyBrand],
    platform: log.platform,
    notes: log.notes,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const logs = await listStatusLogs(15);
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
  const hasReservationWindow = Boolean(startsAt || endsAt);

  // Reservation statuses are fully automatic from dates.
  const normalizedStatus =
    d.status === VehicleOperationalStatus.OUT_OF_SERVICE
      ? VehicleOperationalStatus.OUT_OF_SERVICE
      : hasReservationWindow
        ? VehicleOperationalStatus.RESERVED
        : VehicleOperationalStatus.AVAILABLE;

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
