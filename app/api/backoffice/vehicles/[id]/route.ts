import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  deleteVehicle,
  resolveBackofficeOperationalStatus,
  updateBackofficeVehicle,
} from "@/lib/backoffice";
import { VehicleOperationalStatus } from "@prisma/client";
import { z } from "zod";

const brandLabels = {
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
} as const;

const statusLabels = {
  AVAILABLE: "Disponible",
  RESERVED: "Réservé",
  IN_RENT: "En location",
  OUT_OF_SERVICE: "Hors service",
} as const;

const patchVehicleSchema = z.object({
  model: z.string().trim().min(1).max(100),
  parkingArea: z.string().trim().max(80).default(""),
  parkingSpot: z.string().trim().max(24).default(""),
  operationalStatus: z.enum([
    VehicleOperationalStatus.AVAILABLE,
    VehicleOperationalStatus.OUT_OF_SERVICE,
  ]),
  isCleaned: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = patchVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Donnees invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    const vehicle = await updateBackofficeVehicle(id, parsed.data);
    const operationalStatus = resolveBackofficeOperationalStatus(vehicle);
    return Response.json({
      ok: true,
      vehicle: {
        id: vehicle.id,
        model: vehicle.model,
        plateNumber: vehicle.plateNumber,
        parkingArea: vehicle.parkingArea ?? "",
        parkingSpot: vehicle.parkingSpot ?? "",
        operationalStatus,
        operationalStatusLabel: statusLabels[operationalStatus],
        isCleaned: vehicle.isCleaned,
        agency: {
          id: vehicle.agency.id,
          code: vehicle.agency.code,
          name: vehicle.agency.name,
          brand: vehicle.agency.brand,
          brandLabel: brandLabels[vehicle.agency.brand],
        },
      },
    });
  } catch (error) {
    console.error(`PATCH /api/backoffice/vehicles/${id} failed`, error);
    return Response.json(
      { ok: false, error: "Impossible de mettre a jour le vehicule." },
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
    await deleteVehicle(id);
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Impossible de supprimer le vehicule.";
    console.error(`DELETE /api/backoffice/vehicles/${id} failed`, error);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
