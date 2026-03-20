import { prisma } from "@/lib/prisma";
import { Prisma, VehicleOperationalStatus } from "@prisma/client";

export function statusFromLabel(
  label?: string | null,
): VehicleOperationalStatus {
  const normalized = label?.toLowerCase() ?? "";

  if (normalized.includes("reserv")) {
    return VehicleOperationalStatus.RESERVED;
  }

  if (normalized.includes("hors") || normalized.includes("mainten")) {
    return VehicleOperationalStatus.OUT_OF_SERVICE;
  }

  return VehicleOperationalStatus.AVAILABLE;
}

export function statusLabelFromOperationalStatus(
  status: VehicleOperationalStatus,
) {
  switch (status) {
    case VehicleOperationalStatus.RESERVED:
      return "Reserve";
    case VehicleOperationalStatus.OUT_OF_SERVICE:
      return "Hors service";
    default:
      return "Disponible";
  }
}

export function parseLocationLabel(locationLabel?: string | null) {
  if (!locationLabel) {
    return {
      parkingArea: null,
      parkingSpot: null,
    };
  }

  if (locationLabel.includes(" / ")) {
    const [parkingArea, parkingSpot] = locationLabel.split(" / ");
    return {
      parkingArea: parkingArea || null,
      parkingSpot: parkingSpot || null,
    };
  }

  const match = locationLabel.match(/^(.*)\s+([A-Za-z0-9-]+)$/);

  if (!match) {
    return {
      parkingArea: locationLabel,
      parkingSpot: null,
    };
  }

  return {
    parkingArea: match[1] || null,
    parkingSpot: match[2] || null,
  };
}

export async function listVehicles() {
  return prisma.vehicle.findMany({
    orderBy: [
      { agency: { brand: "asc" } },
      { model: "asc" },
      { plateNumber: "asc" },
    ],
    include: {
      agency: {
        select: {
          id: true,
          code: true,
          name: true,
          brand: true,
        },
      },
    },
  });
}

export async function updateVehicleRecord(
  vehicleId: string,
  data: {
    parkingArea: string;
    parkingSpot: string;
    operationalStatus: VehicleOperationalStatus;
  },
) {
  return prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      parkingArea: data.parkingArea,
      parkingSpot: data.parkingSpot,
      operationalStatus: data.operationalStatus,
      locationLabel: [data.parkingArea, data.parkingSpot]
        .filter(Boolean)
        .join(" / "),
      statusLabel: statusLabelFromOperationalStatus(data.operationalStatus),
    },
    include: {
      agency: {
        select: {
          id: true,
          code: true,
          name: true,
          brand: true,
        },
      },
    },
  });
}

export type VehicleWithAgency = Prisma.PromiseReturnType<typeof listVehicles>[number];

export async function addParkingOption(
  kind: "AREA" | "SPOT",
  value: string,
) {
  return prisma.parkingOption.upsert({
    where: { kind_value: { kind, value } },
    create: { kind, value },
    update: {},
  });
}

export async function deleteParkingOption(
  kind: "AREA" | "SPOT",
  value: string,
) {
  return prisma.parkingOption.deleteMany({
    where: { kind, value },
  });
}

export async function getParkingOptions(): Promise<{
  areas: string[];
  spots: string[];
}> {
  const options = await prisma.parkingOption.findMany({
    orderBy: { value: "asc" },
  });
  return {
    areas: options
      .filter((o) => o.kind === "AREA")
      .map((o) => o.value),
    spots: options
      .filter((o) => o.kind === "SPOT")
      .map((o) => o.value),
  };
}

export async function upsertParkingOptions(
  area: string,
  spot: string,
) {
  const ops: Promise<unknown>[] = [];
  if (area) {
    ops.push(
      prisma.parkingOption.upsert({
        where: { kind_value: { kind: "AREA", value: area } },
        create: { kind: "AREA", value: area },
        update: {},
      }),
    );
  }
  if (spot) {
    ops.push(
      prisma.parkingOption.upsert({
        where: { kind_value: { kind: "SPOT", value: spot } },
        create: { kind: "SPOT", value: spot },
        update: {},
      }),
    );
  }
  await Promise.all(ops);
}
