import {
  forbiddenResponse,
  getAuthUserFromCookie,
  unauthorizedResponse,
} from "@/lib/auth";
import { updateVehicleRecord, upsertParkingOptions } from "@/lib/vehicles";
import { VehicleOperationalStatus } from "@prisma/client";
import { z } from "zod";

const updateVehicleSchema = z.object({
  parkingArea: z.string().trim().min(2).max(80),
  parkingSpot: z.string().trim().min(1).max(24),
  operationalStatus: z.nativeEnum(VehicleOperationalStatus),
});

const brandLabels = {
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
} as const;

const statusLabels = {
  AVAILABLE: "Disponible",
  RESERVED: "Loué",
  OUT_OF_SERVICE: "Hors service",
} as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const user = await getAuthUserFromCookie();

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "MANAGER" && user.role !== "OPERATOR") {
    return forbiddenResponse();
  }

  const body = await request.json();
  const parsedBody = updateVehicleSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      {
        ok: false,
        error: "Donnees vehicule invalides",
        issues: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { vehicleId } = await context.params;
  try {
    const vehicle = await updateVehicleRecord(vehicleId, parsedBody.data);

    await upsertParkingOptions(
      parsedBody.data.parkingArea,
      parsedBody.data.parkingSpot,
    );

    return Response.json({
      ok: true,
      vehicle: {
        id: vehicle.id,
        model: vehicle.model,
        plateNumber: vehicle.plateNumber,
        parkingArea: vehicle.parkingArea ?? "",
        parkingSpot: vehicle.parkingSpot ?? "",
        operationalStatus: vehicle.operationalStatus,
        operationalStatusLabel: statusLabels[vehicle.operationalStatus],
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
    console.error(`PATCH /api/vehicles/${vehicleId} failed`, error);

    return Response.json(
      {
        ok: false,
        error:
          "Base de donnees inaccessible. Lancez PostgreSQL avant de modifier un vehicule.",
      },
      { status: 503 },
    );
  }
}
