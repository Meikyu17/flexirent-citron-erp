import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import { listVehicles } from "@/lib/vehicles";

const brandLabels = {
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
} as const;

const statusLabels = {
  AVAILABLE: "Disponible",
  RESERVED: "Reserve",
  OUT_OF_SERVICE: "Hors service",
} as const;

export async function GET() {
  const user = await getAuthUserFromCookie();

  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const vehicles = await listVehicles();

    return Response.json({
      ok: true,
      vehicles: vehicles.map((vehicle) => ({
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
      })),
    });
  } catch (error) {
    console.error("GET /api/vehicles failed", error);

    return Response.json(
      {
        ok: false,
        error:
          "Base de donnees inaccessible. Lancez PostgreSQL puis relancez la migration et le seed.",
      },
      { status: 503 },
    );
  }
}
