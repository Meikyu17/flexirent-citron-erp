import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  createVehicle,
  listBackofficeVehicles,
  resolveBackofficeOperationalStatus,
} from "@/lib/backoffice";
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

function serializeVehicle(vehicle: {
  id: string;
  model: string;
  plateNumber: string;
  parkingArea: string | null;
  parkingSpot: string | null;
  operationalStatus: "AVAILABLE" | "RESERVED" | "OUT_OF_SERVICE";
  isCleaned: boolean;
  agency: { id: string; code: string; name: string; brand: "CITRON_LOCATION" | "FLEXIRENT" };
  reservations?: { id: string; startsAt: Date; endsAt: Date }[];
  statusLogs?: { id: string; startsAt: Date | null; endsAt: Date | null }[];
}) {
  const operationalStatus = resolveBackofficeOperationalStatus({
    operationalStatus: vehicle.operationalStatus,
    reservations: vehicle.reservations ?? [],
    statusLogs: vehicle.statusLogs ?? [],
  });
  return {
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
  };
}

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const vehicles = await listBackofficeVehicles();
    return Response.json({ ok: true, vehicles: vehicles.map(serializeVehicle) });
  } catch (error) {
    console.error("GET /api/backoffice/vehicles failed", error);
    return Response.json(
      { ok: false, error: "Base de donnees inaccessible." },
      { status: 503 },
    );
  }
}

const createVehicleSchema = z.object({
  model: z.string().trim().min(1).max(100),
  plateNumber: z.string().trim().min(2).max(20),
  parkingArea: z.string().trim().max(80).default(""),
  parkingSpot: z.string().trim().max(24).default(""),
  agencyId: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Donnees invalides", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const vehicle = await createVehicle(parsed.data);
    return Response.json({ ok: true, vehicle: serializeVehicle(vehicle) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/backoffice/vehicles failed", error);
    return Response.json(
      { ok: false, error: "Impossible de creer le vehicule." },
      { status: 503 },
    );
  }
}
