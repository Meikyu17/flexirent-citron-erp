export type BookingItem = {
  id: string;
  date: string; // ISO "YYYY-MM-DD"
  client: string;
  pickup: string;  // "Lieu / HHhMM"
  dropoff: string; // "Lieu / HHhMM"
  car: string;
  amount: number;
  source: "Fleetee A" | "Fleetee B" | "Getaround" | "Turo";
};

export type VehicleOperationalStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OUT_OF_SERVICE";

export type AgencyBrand = "CITRON_LOCATION" | "FLEXIRENT";

export type FleetVehicle = {
  id: string;
  model: string;
  plateNumber: string;
  parkingArea: string;
  parkingSpot: string;
  operationalStatus: VehicleOperationalStatus;
  operationalStatusLabel: string;
  agency: {
    id: string;
    code: string;
    name: string;
    brand: AgencyBrand;
    brandLabel: string;
  };
};

export type VehicleDraft = {
  parkingArea: string;
  parkingSpot: string;
  operationalStatus: VehicleOperationalStatus;
};

export type DispatchItem = {
  id: string;
  bookingRef: string;
  mission: string;
  members: string[];
  state: "A dispatcher" | "Assigné";
};

export type ParkingOptions = {
  areas: string[];
  spots: string[];
};

export type OpenclawPingStatus = "checking" | "online" | "offline";

export type EmployeeStat = {
  name: string;
  handovers: number;
  returns: number;
};
