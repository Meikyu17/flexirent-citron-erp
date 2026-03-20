"use client";

import { useState } from "react";
import type { AgencyBrand, FleetVehicle, OpenclawPingStatus } from "../../shared/types";
import { formatMoney } from "../../shared/utils";
import "./overview.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Agency = "ALL" | AgencyBrand;

type PeriodData = {
  label: string;       // "Mars 2026"
  startLabel: string;  // "01/03"
  endLabel: string;    // "31/03"
  revenue: number;
  vehiclesRented: number;
  occupancyRate: number;
};

// ─── Mock period data ──────────────────────────────────────────────────────────
// Indexed from oldest to newest — periods[last] = current month

const ALL_PERIODS: PeriodData[] = [
  { label: "Decembre 2025", startLabel: "01/12", endLabel: "31/12", revenue: 27400, vehiclesRented: 9,  occupancyRate: 58 },
  { label: "Janvier 2026",  startLabel: "01/01", endLabel: "31/01", revenue: 31200, vehiclesRented: 11, occupancyRate: 68 },
  { label: "Fevrier 2026",  startLabel: "01/02", endLabel: "28/02", revenue: 29800, vehiclesRented: 10, occupancyRate: 63 },
  { label: "Mars 2026",     startLabel: "01/03", endLabel: "31/03", revenue: 34700, vehiclesRented: 12, occupancyRate: 74 },
];

const AGENCY_PERIODS: Record<AgencyBrand, PeriodData[]> = {
  CITRON_LOCATION: [
    { label: "Decembre 2025", startLabel: "01/12", endLabel: "31/12", revenue: 15200, vehiclesRented: 5, occupancyRate: 54 },
    { label: "Janvier 2026",  startLabel: "01/01", endLabel: "31/01", revenue: 17800, vehiclesRented: 6, occupancyRate: 65 },
    { label: "Fevrier 2026",  startLabel: "01/02", endLabel: "28/02", revenue: 16400, vehiclesRented: 6, occupancyRate: 60 },
    { label: "Mars 2026",     startLabel: "01/03", endLabel: "31/03", revenue: 19500, vehiclesRented: 7, occupancyRate: 72 },
  ],
  FLEXIRENT: [
    { label: "Decembre 2025", startLabel: "01/12", endLabel: "31/12", revenue: 12200, vehiclesRented: 4, occupancyRate: 62 },
    { label: "Janvier 2026",  startLabel: "01/01", endLabel: "31/01", revenue: 13400, vehiclesRented: 5, occupancyRate: 71 },
    { label: "Fevrier 2026",  startLabel: "01/02", endLabel: "28/02", revenue: 13400, vehiclesRented: 4, occupancyRate: 67 },
    { label: "Mars 2026",     startLabel: "01/03", endLabel: "31/03", revenue: 15200, vehiclesRented: 5, occupancyRate: 77 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const agencyLabels: Record<Agency, string> = {
  ALL: "Toutes",
  CITRON_LOCATION: "Citron location",
  FLEXIRENT: "Flexirent",
};

function getPeriodsForAgency(agency: Agency): PeriodData[] {
  if (agency === "ALL") return ALL_PERIODS;
  return AGENCY_PERIODS[agency];
}

function computeVariation(current: number, previous: number): number {
  return ((current - previous) / previous) * 100;
}

function formatVariation(v: number | null): { text: string; colorClass: string } {
  if (v === null) return { text: "—", colorClass: "text-muted" };
  const sign = v >= 0 ? "+" : "";
  return {
    text: `${sign}${v.toFixed(1)} %`,
    colorClass: v >= 0 ? "text-success" : "text-danger",
  };
}

function computeFleetByStatus(vehicles: FleetVehicle[], agency: Agency) {
  const filtered = agency === "ALL" ? vehicles : vehicles.filter((v) => v.agency.brand === agency);
  return {
    available: filtered.filter((v) => v.operationalStatus === "AVAILABLE").length,
    reserved: filtered.filter((v) => v.operationalStatus === "RESERVED").length,
    outOfService: filtered.filter((v) => v.operationalStatus === "OUT_OF_SERVICE").length,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgencyFilter({ selected, onChange }: { selected: Agency; onChange: (a: Agency) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["ALL", "CITRON_LOCATION", "FLEXIRENT"] as Agency[]).map((agency) => (
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

function PeriodSelector({
  periods,
  index,
  onChange,
}: {
  periods: PeriodData[];
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="overview-period-selector">
      <button
        type="button"
        className="overview-period-nav"
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
        aria-label="Periode precedente"
      >
        ‹
      </button>
      <span className="overview-period-label">{periods[index].label}</span>
      <button
        type="button"
        className="overview-period-nav"
        disabled={index === periods.length - 1}
        onClick={() => onChange(index + 1)}
        aria-label="Periode suivante"
      >
        ›
      </button>
    </div>
  );
}

// ─── KPI grid (shared between full and compact) ───────────────────────────────

function KpiGrid({
  current,
  previous,
  compact,
}: {
  current: PeriodData;
  previous: PeriodData | null;
  compact: boolean;
}) {
  const variation = previous ? computeVariation(current.revenue, previous.revenue) : null;
  const { text: variationText, colorClass: variationColor } = formatVariation(variation);
  const textSize = compact ? "text-xl" : "text-2xl";

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
      <article className="card bg-card-secondary px-3 py-2">
        <p className="text-xs text-muted">CA sur la periode</p>
        <p className={`mt-0.5 ${textSize} font-semibold leading-tight`}>
          {formatMoney(current.revenue)}
        </p>
        <p className="text-xs text-muted leading-tight">
          {current.startLabel} → {current.endLabel}
        </p>
      </article>

      <article className="card bg-card-secondary px-3 py-2">
        <p className="text-xs text-muted">Variation CA</p>
        <p className={`mt-0.5 ${textSize} font-semibold leading-tight ${variationColor}`}>
          {variationText}
        </p>
        <p className="text-xs text-muted leading-tight">
          {previous ? `vs ${previous.label}` : "Pas de periode precedente"}
        </p>
      </article>

      <article className="card bg-card-secondary px-3 py-2">
        <p className="text-xs text-muted">Taux d&apos;occupation</p>
        <p className={`mt-0.5 ${textSize} font-semibold leading-tight`}>
          {current.occupancyRate}%
        </p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${current.occupancyRate}%` }} />
        </div>
      </article>

      <article className={`card bg-card-secondary px-3 py-2 ${compact ? "" : "sm:col-span-3 sm:max-w-[calc(33.333%-0.33rem)]"}`}>
        <p className="text-xs text-muted">Vehicules loues</p>
        <p className={`mt-0.5 ${textSize} font-semibold leading-tight`}>
          {current.vehiclesRented}
        </p>
        <p className="text-xs text-muted leading-tight">sur la periode</p>
      </article>
    </div>
  );
}

// ─── Fleet status row ─────────────────────────────────────────────────────────

function FleetStatus({
  fleetByStatus,
  fleetLoading,
  compact,
}: {
  fleetByStatus: { available: number; reserved: number; outOfService: number };
  fleetLoading: boolean;
  compact: boolean;
}) {
  const textSize = compact ? "text-lg" : "text-xl";
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">Disponibles</p>
        <p className={`${textSize} font-semibold leading-tight text-success`}>
          {fleetLoading ? "–" : fleetByStatus.available}
        </p>
      </div>
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">Loues</p>
        <p className={`${textSize} font-semibold leading-tight`}>
          {fleetLoading ? "–" : fleetByStatus.reserved}
        </p>
      </div>
      <div className="card bg-card-secondary px-3 py-1.5 text-center">
        <p className="text-xs text-muted">Hors service</p>
        <p className={`${textSize} font-semibold leading-tight${!fleetLoading && fleetByStatus.outOfService > 0 ? " text-danger" : ""}`}>
          {fleetLoading ? "–" : fleetByStatus.outOfService}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OverviewPanel({
  today,
  fleetVehicles,
  fleetLoading,
  openclawStatus,
  size = "full",
}: {
  today: string;
  fleetVehicles: FleetVehicle[];
  fleetLoading: boolean;
  openclawStatus: OpenclawPingStatus;
  size?: "full" | "compact";
}) {
  const [selectedAgency, setSelectedAgency] = useState<Agency>("ALL");
  const periods = getPeriodsForAgency(selectedAgency);
  const [periodIndex, setPeriodIndex] = useState(periods.length - 1);

  const safeIndex = Math.min(periodIndex, periods.length - 1);
  const currentPeriod = periods[safeIndex];
  const previousPeriod = safeIndex > 0 ? periods[safeIndex - 1] : null;
  const fleetByStatus = computeFleetByStatus(fleetVehicles, selectedAgency);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted capitalize">
          {today}
        </p>
        <h2 className="mt-0.5 text-xl font-semibold tracking-tight">
          Vue d&apos;ensemble
        </h2>
      </div>
      <span className="chip">2 agences</span>
    </div>
  );

  if (size === "compact") {
    return (
      <>
        {header}
        <AgencyFilter selected={selectedAgency} onChange={(a) => { setSelectedAgency(a); setPeriodIndex(getPeriodsForAgency(a).length - 1); }} />
        <PeriodSelector periods={periods} index={safeIndex} onChange={setPeriodIndex} />
        <KpiGrid current={currentPeriod} previous={previousPeriod} compact />
        <div className="mt-2">
          <FleetStatus fleetByStatus={fleetByStatus} fleetLoading={fleetLoading} compact />
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {header}
      <AgencyFilter
        selected={selectedAgency}
        onChange={(a) => {
          setSelectedAgency(a);
          setPeriodIndex(getPeriodsForAgency(a).length - 1);
        }}
      />
      <PeriodSelector periods={periods} index={safeIndex} onChange={setPeriodIndex} />
      <KpiGrid current={currentPeriod} previous={previousPeriod} compact={false} />
      <FleetStatus fleetByStatus={fleetByStatus} fleetLoading={fleetLoading} compact={false} />
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
