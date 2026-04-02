import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  deleteStatusLog,
  findOverlappingReservationConflict,
  resolveReservationDisplayStatusFromDates,
  updateStatusLogReservation,
} from "@/lib/backoffice";
import { prisma } from "@/lib/prisma";
import { VehicleOperationalStatus } from "@prisma/client";
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

const patchReservationSchema = z.object({
  vehicleId: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = patchReservationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Donnees invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;

  if (endsAt && endsAt < startsAt) {
    return Response.json(
      { ok: false, error: "La date de fin doit etre apres la date de debut." },
      { status: 400 },
    );
  }

  const existingLog = await prisma.vehicleStatusLog.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      platform: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!existingLog) {
    return Response.json(
      { ok: false, error: "Reservation introuvable." },
      { status: 404 },
    );
  }

  const isReservationLog =
    existingLog.status === VehicleOperationalStatus.RESERVED ||
    Boolean(existingLog.startsAt) ||
    Boolean(existingLog.endsAt);
  if (!isReservationLog) {
    return Response.json(
      { ok: false, error: "Seules les reservations peuvent etre modifiees." },
      { status: 400 },
    );
  }

  const conflict = await findOverlappingReservationConflict({
    vehicleId: parsed.data.vehicleId,
    startsAt,
    endsAt,
    platform: existingLog.platform,
    excludeStatusLogId: id,
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

  try {
    const updatedLog = await updateStatusLogReservation(id, {
      vehicleId: parsed.data.vehicleId,
      startsAt,
      endsAt,
    });

    const status =
      updatedLog.status === VehicleOperationalStatus.RESERVED
        ? resolveReservationDisplayStatusFromDates(
            updatedLog.startsAt,
            updatedLog.endsAt,
          )
        : updatedLog.status;

    return Response.json({
      ok: true,
      log: {
        id: updatedLog.id,
        vehicleId: updatedLog.vehicleId,
        vehicle: updatedLog.vehicle,
        status,
        statusLabel: statusLabels[status],
        isReservation: true,
        customerName: updatedLog.customerName,
        customerPhone: updatedLog.customerPhone,
        startsAt: updatedLog.startsAt?.toISOString() ?? null,
        endsAt: updatedLog.endsAt?.toISOString() ?? null,
        agencyBrand: updatedLog.agencyBrand,
        agencyBrandLabel: brandLabels[updatedLog.agencyBrand],
        platform: updatedLog.platform,
        notes: updatedLog.notes,
        createdAt: updatedLog.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(`PATCH /api/backoffice/logs/${id} failed`, error);
    return Response.json(
      { ok: false, error: "Impossible de modifier la reservation." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  try {
    await deleteStatusLog(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/backoffice/logs/${id} failed`, error);
    return Response.json(
      { ok: false, error: "Impossible de supprimer la reservation." },
      { status: 503 },
    );
  }
}
