"use client";

import { useMemo, useState } from "react";
import type {
  AgencyBrand,
  FleetVehicle,
  ParkingOptions,
  VehicleDraft,
  VehicleOperationalStatus,
} from "../../shared/types";
import "./vehicles.css";

type VehicleStatusFilter = "ALL" | VehicleOperationalStatus;

export function VehiclePanel({
  vehicles,
  drafts,
  selectedBrand,
  fleetLoading,
  fleetError,
  savingVehicleId,
  parkingOptions,
  onBrandChange,
  onDraftChange,
  onSave,
  onAddParkingArea,
  onDeleteParkingArea,
}: {
  vehicles: FleetVehicle[];
  drafts: Record<string, VehicleDraft>;
  selectedBrand: "ALL" | AgencyBrand;
  fleetLoading: boolean;
  fleetError: string | null;
  savingVehicleId: string | null;
  parkingOptions: ParkingOptions;
  onBrandChange: (brand: "ALL" | AgencyBrand) => void;
  onDraftChange: (vehicleId: string, patch: Partial<VehicleDraft>) => void;
  onSave: (vehicleId: string) => void;
  onAddParkingArea: (value: string) => void;
  onDeleteParkingArea: (value: string) => void;
}) {
  const [newAreaInput, setNewAreaInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>("ALL");

  const handleAddArea = () => {
    const trimmed = newAreaInput.trim();
    if (!trimmed) return;
    onAddParkingArea(trimmed);
    setNewAreaInput("");
  };

  const visibleVehicles = useMemo(() => {
    const byStatus =
      statusFilter === "ALL"
        ? vehicles
        : vehicles.filter((vehicle) => vehicle.operationalStatus === statusFilter);

    if (statusFilter !== "ALL") {
      return byStatus;
    }

    const rank: Record<VehicleOperationalStatus, number> = {
      AVAILABLE: 0,
      RESERVED: 1,
      OUT_OF_SERVICE: 2,
    };

    return [...byStatus].sort((a, b) => {
      const statusDelta = rank[a.operationalStatus] - rank[b.operationalStatus];
      if (statusDelta !== 0) return statusDelta;
      return `${a.model} ${a.plateNumber}`.localeCompare(
        `${b.model} ${b.plateNumber}`,
        "fr",
      );
    });
  }, [vehicles, statusFilter]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Véhicules</h2>
          <p className="mt-1 text-sm text-muted">
            Tri par agence, changement d&apos;emplacement et correction d&apos;état
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${selectedBrand === "ALL" ? "vehicle-toggle-active" : ""}`}
            onClick={() => onBrandChange("ALL")}
          >
            Toutes
          </button>
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${selectedBrand === "CITRON_LOCATION" ? "vehicle-toggle-active" : ""}`}
            onClick={() => onBrandChange("CITRON_LOCATION")}
          >
            Citron Location
          </button>
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${selectedBrand === "FLEXIRENT" ? "vehicle-toggle-active" : ""}`}
            onClick={() => onBrandChange("FLEXIRENT")}
          >
            Flexirent
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`vehicle-toggle cursor-pointer ${statusFilter === "ALL" ? "vehicle-toggle-active" : ""}`}
          onClick={() => setStatusFilter("ALL")}
        >
          Tous états
        </button>
        <button
          type="button"
          className={`vehicle-toggle cursor-pointer ${statusFilter === "AVAILABLE" ? "vehicle-toggle-active" : ""}`}
          onClick={() => setStatusFilter("AVAILABLE")}
        >
          Disponible
        </button>
        <button
          type="button"
          className={`vehicle-toggle cursor-pointer ${statusFilter === "RESERVED" ? "vehicle-toggle-active" : ""}`}
          onClick={() => setStatusFilter("RESERVED")}
        >
          Loué
        </button>
        <button
          type="button"
          className={`vehicle-toggle cursor-pointer ${statusFilter === "OUT_OF_SERVICE" ? "vehicle-toggle-active" : ""}`}
          onClick={() => setStatusFilter("OUT_OF_SERVICE")}
        >
          Hors service
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-border bg-card-secondary px-3 py-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Endroits
        </p>
        <div className="flex flex-wrap gap-1.5">
          {parkingOptions.areas.length === 0 && (
            <span className="text-xs text-muted">Aucun endroit configuré</span>
          )}
          {parkingOptions.areas.map((area) => (
            <span key={area} className="chip flex items-center gap-1.5">
              {area}
              <button
                type="button"
                className="cursor-pointer leading-none text-muted transition-colors hover:text-danger"
                aria-label={`Supprimer ${area}`}
                onClick={() => onDeleteParkingArea(area)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-1.5 text-sm outline-none transition focus:border-accent"
            value={newAreaInput}
            onChange={(e) => setNewAreaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddArea();
              }
            }}
            placeholder="Nouvel endroit..."
          />
          <button
            type="button"
            className="chip cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!newAreaInput.trim()}
            onClick={handleAddArea}
          >
            Ajouter
          </button>
        </div>
      </div>

      {fleetError ? (
        <div className="mb-3 rounded-2xl border border-danger/20 bg-card-secondary p-3 text-sm text-danger">
          {fleetError}
        </div>
      ) : null}

      <datalist id="parking-spots-list">
        {parkingOptions.spots.map((spot) => (
          <option key={spot} value={spot} />
        ))}
      </datalist>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
        {fleetLoading ? (
          <div className="card bg-card-secondary p-4 text-sm text-muted">
            Chargement des véhicules...
          </div>
        ) : null}

        {!fleetLoading && visibleVehicles.length === 0 ? (
          <div className="card bg-card-secondary p-4 text-sm text-muted">
            Aucun véhicule pour ce filtre.
          </div>
        ) : null}

        {visibleVehicles.map((vehicle) => {
          const draft = drafts[vehicle.id];
          if (!draft) return null;

          const isDirty =
            draft.parkingArea !== vehicle.parkingArea ||
            draft.parkingSpot !== vehicle.parkingSpot ||
            draft.operationalStatus !== vehicle.operationalStatus;

          return (
            <div key={vehicle.id} className="card bg-card-secondary p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-medium">
                    {vehicle.model} / {vehicle.plateNumber}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="chip">{vehicle.agency.brandLabel}</span>
                    <span className="chip">{vehicle.agency.name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="chip cursor-pointer"
                  disabled={!isDirty || savingVehicleId === vehicle.id}
                  onClick={() => onSave(vehicle.id)}
                >
                  {savingVehicleId === vehicle.id ? "Sauvegarde..." : "Enregistrer"}
                </button>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  État en direct
                </p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`vehicle-status-button ${draft.operationalStatus !== "OUT_OF_SERVICE" ? "vehicle-status-button-active" : ""}`}
                  >
                    {draft.operationalStatus === "AVAILABLE"
                      ? "Disponible"
                      : draft.operationalStatus === "RESERVED"
                        ? "Loué"
                        : "—"}
                  </span>
                  <button
                    type="button"
                    className={`vehicle-status-button cursor-pointer ${draft.operationalStatus === "OUT_OF_SERVICE" ? "vehicle-status-button-active" : ""}`}
                    onClick={() =>
                      onDraftChange(vehicle.id, {
                        operationalStatus:
                          draft.operationalStatus === "OUT_OF_SERVICE"
                            ? "AVAILABLE"
                            : "OUT_OF_SERVICE",
                      })
                    }
                  >
                    Hors service
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Endroit</span>
                  <select
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 outline-none transition focus:border-accent"
                    value={draft.parkingArea}
                    onChange={(event) =>
                      onDraftChange(vehicle.id, { parkingArea: event.target.value })
                    }
                  >
                    <option value="">— Choisir —</option>
                    {draft.parkingArea && !parkingOptions.areas.includes(draft.parkingArea) && (
                      <option value={draft.parkingArea}>{draft.parkingArea}</option>
                    )}
                    {parkingOptions.areas.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted">Place</span>
                  <input
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 outline-none transition focus:border-accent"
                    list="parking-spots-list"
                    value={draft.parkingSpot}
                    onChange={(event) =>
                      onDraftChange(vehicle.id, { parkingSpot: event.target.value })
                    }
                    placeholder="Ex: 14"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!isDirty || savingVehicleId === vehicle.id}
                    onClick={() => onSave(vehicle.id)}
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
