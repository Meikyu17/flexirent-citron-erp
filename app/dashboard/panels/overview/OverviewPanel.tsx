"use client";

import { useMemo, useState } from "react";
import type { AgencyBrand } from "../../shared/types";
import "./overview.css";

type Agency = "ALL" | AgencyBrand;

type OverviewVehicle = {
  operationalStatus: "AVAILABLE" | "RESERVED" | "IN_RENT" | "OUT_OF_SERVICE";
  agency: { brand: AgencyBrand };
};

const agencyLabels: Record<Agency, string> = {
  ALL: "Toutes",
  CITRON_LOCATION: "Citron Location",
  FLEXIRENT: "Flexirent",
};

function computeFleetByStatus(vehicles: OverviewVehicle[], agency: Agency) {
  const filtered =
    agency === "ALL" ? vehicles : vehicles.filter((v) => v.agency.brand === agency);
  return {
    total: filtered.length,
    available: filtered.filter((v) => v.operationalStatus === "AVAILABLE").length,
    inRent: filtered.filter((v) => v.operationalStatus === "IN_RENT").length,
    reserved: filtered.filter((v) => v.operationalStatus === "RESERVED").length,
    outOfService: filtered.filter((v) => v.operationalStatus === "OUT_OF_SERVICE").length,
  };
}

function occupancyRateFromFleet(fleetByStatus: {
  available: number;
  inRent: number;
  reserved: number;
  outOfService: number;
}) {
  const activeFleet =
    fleetByStatus.available + fleetByStatus.inRent + fleetByStatus.reserved;
  if (activeFleet <= 0) return 0;
  return Math.round((fleetByStatus.inRent / activeFleet) * 100);
}

function AgencyFilter({
  selected,
  onChange,
}: {
  selected: Agency;
  onChange: (a: Agency) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["ALL", "CITRON_LOCATION", "FLEXIRENT"] as Agency[]).map((agency) => (
        <button
          key={agency}
          type="button"
          className={`vehicle-toggle cursor-pointer ${
            selected === agency ? "vehicle-toggle-active" : ""
          }`}
          onClick={() => onChange(agency)}
        >
          {agencyLabels[agency]}
        </button>
      ))}
    </div>
  );
}

function KpiGrid({
  occupancyRate,
  inRent,
  activeFleet,
  compact,
}: {
  occupancyRate: number;
  inRent: number;
  activeFleet: number;
  compact: boolean;
}) {
  const textSize = compact ? "text-2xl" : "text-3xl";
  return (
    <div className="grid gap-2">
      <article className="card bg-card-secondary px-3 py-3">
        <p className="text-xs text-muted">Taux d&apos;occupation réel</p>
        <p className={`mt-0.5 ${textSize} font-semibold leading-tight`}>
          {occupancyRate}%
        </p>
        <p className="text-xs text-muted leading-tight">
          {inRent} en location / {activeFleet} véhicules exploitables
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
      </article>
    </div>
  );
}

function FleetStatus({
  fleetByStatus,
  fleetLoading,
  compact,
}: {
  fleetByStatus: {
    available: number;
    inRent: number;
    reserved: number;
    outOfService: number;
  };
  fleetLoading: boolean;
  compact: boolean;
}) {
  const textSize = compact ? "text-lg" : "text-xl";
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">Disponibles</p>
        <p className={`${textSize} font-semibold leading-tight text-success`}>
          {fleetLoading ? "-" : fleetByStatus.available}
        </p>
      </div>
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">En location</p>
        <p className={`${textSize} font-semibold leading-tight`}>
          {fleetLoading ? "-" : fleetByStatus.inRent}
        </p>
      </div>
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">Réservés</p>
        <p className={`${textSize} font-semibold leading-tight`}>
          {fleetLoading ? "-" : fleetByStatus.reserved}
        </p>
      </div>
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">Hors service</p>
        <p
          className={`${textSize} font-semibold leading-tight${
            !fleetLoading && fleetByStatus.outOfService > 0 ? " text-danger" : ""
          }`}
        >
          {fleetLoading ? "-" : fleetByStatus.outOfService}
        </p>
      </div>
    </div>
  );
}

export function OverviewPanel({
  today,
  fleetVehicles,
  fleetLoading,
  size = "full",
}: {
  today: string;
  fleetVehicles: OverviewVehicle[];
  fleetLoading: boolean;
  size?: "full" | "compact";
}) {
  const [selectedAgency, setSelectedAgency] = useState<Agency>("ALL");

  const fleetByStatus = useMemo(
    () => computeFleetByStatus(fleetVehicles, selectedAgency),
    [fleetVehicles, selectedAgency],
  );
  const occupancyRate = occupancyRateFromFleet(fleetByStatus);
  const activeFleet =
    fleetByStatus.available + fleetByStatus.inRent + fleetByStatus.reserved;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted capitalize">
          {today}
        </p>
        <div className="overview-title-row">
          <h2 className="text-xl font-semibold tracking-tight">Vue d&apos;ensemble</h2>
        </div>
      </div>
      <AgencyFilter selected={selectedAgency} onChange={setSelectedAgency} />
    </div>
  );

  if (size === "compact") {
    return (
      <>
        {header}
        <KpiGrid
          occupancyRate={occupancyRate}
          inRent={fleetByStatus.inRent}
          activeFleet={activeFleet}
          compact
        />
        <div className="mt-2">
          <FleetStatus
            fleetByStatus={fleetByStatus}
            fleetLoading={fleetLoading}
            compact
          />
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {header}
      <KpiGrid
        occupancyRate={occupancyRate}
        inRent={fleetByStatus.inRent}
        activeFleet={activeFleet}
        compact={false}
      />
      <FleetStatus
        fleetByStatus={fleetByStatus}
        fleetLoading={fleetLoading}
        compact={false}
      />
    </div>
  );
}
