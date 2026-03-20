import type { FleetVehicle, VehicleDraft } from "./types";

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export const makeVehicleDrafts = (vehicles: FleetVehicle[]) =>
  Object.fromEntries(
    vehicles.map((vehicle) => [
      vehicle.id,
      {
        parkingArea: vehicle.parkingArea,
        parkingSpot: vehicle.parkingSpot,
        operationalStatus: vehicle.operationalStatus,
      },
    ]),
  ) as Record<string, VehicleDraft>;
