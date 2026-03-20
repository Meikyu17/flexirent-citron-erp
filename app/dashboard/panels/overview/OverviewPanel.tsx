"use client";

import { useState } from "react";
import type { AgencyBrand, FleetVehicle, OpenclawPingStatus } from "../../shared/types";
import { formatMoney } from "../../shared/utils";
import "./overview.css";

type Agency = "ALL" | AgencyBrand;

const agencyLabels: Record<Agency, string> = {
  ALL: "Toutes",
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
};

function computeFleetByStatus(vehicles: FleetVehicle[], agency: Agency) {
  const filtered = agency === "ALL" ? vehicles : vehicles.filter((v) => v.agency.brand === agency);
  return {
    available: filtered.filter((v) => v.operationalStatus === "AVAILABLE").length,
    reserved: filtered.filter((v) => v.operationalStatus === "RESERVED").length,
    outOfService: filtered.filter((v) => v.operationalStatus === "OUT_OF_SERVICE").length,
  };
}

function AgencyFilter({
  selected,
  onChange,
}: {
  selected: Agency;
  onChange: (agency: Agency) => void;
}) {
  const agencies: Agency[] = ["ALL", "CITRON_LOCATION", "FLEXIRENT"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {agencies.map((agency) => (
        <button
          key={agency}
          type="button"
          className={`vehicle-toggle cursor-pointer ${selected === agency ? "vehicle-toggle-active" : ""}`}
          onClick={() => onChange(agency)}
        >
          {agencyLabels[agency]}
        </button>
      ))}
    </div>
  );
}

export function OverviewPanel({
  today,
  revenue,
  occupancyRate,
  fleetVehicles,
  fleetLoading,
  openclawStatus,
  size = "full",
}: {
  today: string;
  revenue: number;
  occupancyRate: number;
  fleetVehicles: FleetVehicle[];
  fleetLoading: boolean;
  openclawStatus: OpenclawPingStatus;
  size?: "full" | "compact";
}) {
  const [selectedAgency, setSelectedAgency] = useState<Agency>("ALL");
  const fleetByStatus = computeFleetByStatus(fleetVehicles, selectedAgency);

  if (size === "compact") {
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted capitalize">
              {today}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight">
              Vue d&apos;ensemble
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">3 departs</span>
            <span className="chip">2 agences</span>
          </div>
        </div>

        <AgencyFilter selected={selectedAgency} onChange={setSelectedAgency} />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <article className="card bg-card-secondary px-3 py-2">
            <p className="text-xs text-muted">CA en cours</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight">
              {formatMoney(revenue)}
            </p>
            <p className="text-xs text-muted leading-tight">01/03 → 01/04</p>
          </article>
          <article className="card bg-card-secondary px-3 py-2">
            <p className="text-xs text-muted">Taux d&apos;occupation</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight">{occupancyRate}%</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
              <div className="h-full rounded-full bg-accent" style={{ width: `${occupancyRate}%` }} />
            </div>
          </article>
          <article className="card bg-card-secondary px-3 py-2">
            <p className="text-xs text-muted">Retours prevus</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight">6</p>
            <p className="text-xs text-muted leading-tight">avant 18h30</p>
          </article>
          <article className="card bg-card-secondary px-3 py-2">
            <p className="text-xs text-muted">Dispatch prioritaire</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight">1</p>
            <p className="text-xs text-muted leading-tight">mission a confirmer</p>
          </article>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="card bg-card-secondary px-3 py-1.5 text-center">
            <p className="text-xs text-muted">Disponibles</p>
            <p className="text-lg font-semibold leading-tight text-success">
              {fleetLoading ? "–" : fleetByStatus.available}
            </p>
          </div>
          <div className="card bg-card-secondary px-3 py-1.5 text-center">
            <p className="text-xs text-muted">Reserves</p>
            <p className="text-lg font-semibold leading-tight">
              {fleetLoading ? "–" : fleetByStatus.reserved}
            </p>
          </div>
          <div className="card bg-card-secondary px-3 py-1.5 text-center">
            <p className="text-xs text-muted">Hors service</p>
            <p className={`text-lg font-semibold leading-tight${!fleetLoading && fleetByStatus.outOfService > 0 ? " text-danger" : ""}`}>
              {fleetLoading ? "–" : fleetByStatus.outOfService}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted capitalize">
            {today}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight">
            Vue d&apos;ensemble
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">3 departs</span>
          <span className="chip">2 agences</span>
        </div>
      </div>

      <AgencyFilter selected={selectedAgency} onChange={setSelectedAgency} />

      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        <article className="card bg-card-secondary px-3 py-2">
          <p className="text-xs text-muted">CA en cours</p>
          <p className="mt-0.5 text-2xl font-semibold leading-tight">
            {formatMoney(revenue)}
          </p>
          <p className="text-xs text-muted leading-tight">01/03 → 01/04</p>
        </article>
        <article className="card bg-card-secondary px-3 py-2">
          <p className="text-xs text-muted">Taux d&apos;occupation</p>
          <p className="mt-0.5 text-2xl font-semibold leading-tight">{occupancyRate}%</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${occupancyRate}%` }} />
          </div>
        </article>
        <article className="card bg-card-secondary px-3 py-2">
          <p className="text-xs text-muted">Retours prevus</p>
          <p className="mt-0.5 text-2xl font-semibold leading-tight">6</p>
          <p className="text-xs text-muted leading-tight">avant 18h30</p>
        </article>
        <article className="card bg-card-secondary px-3 py-2">
          <p className="text-xs text-muted">Dispatch prioritaire</p>
          <p className="mt-0.5 text-2xl font-semibold leading-tight">1</p>
          <p className="text-xs text-muted leading-tight">mission a confirmer</p>
        </article>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="card bg-card-secondary px-3 py-1.5 text-center">
          <p className="text-xs text-muted">Disponibles</p>
          <p className="text-xl font-semibold leading-tight text-success">
            {fleetLoading ? "–" : fleetByStatus.available}
          </p>
        </div>
        <div className="card bg-card-secondary px-3 py-1.5 text-center">
          <p className="text-xs text-muted">Reserves</p>
          <p className="text-xl font-semibold leading-tight">
            {fleetLoading ? "–" : fleetByStatus.reserved}
          </p>
        </div>
        <div className="card bg-card-secondary px-3 py-1.5 text-center">
          <p className="text-xs text-muted">Hors service</p>
          <p className={`text-xl font-semibold leading-tight${!fleetLoading && fleetByStatus.outOfService > 0 ? " text-danger" : ""}`}>
            {fleetLoading ? "–" : fleetByStatus.outOfService}
          </p>
        </div>
      </div>

      {openclawStatus !== undefined && (
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">
            {openclawStatus === "online"
              ? "Openclaw actif"
              : openclawStatus === "offline"
                ? "Openclaw hors ligne"
                : "Openclaw en verification..."}
          </span>
        </div>
      )}
    </div>
  );
}
