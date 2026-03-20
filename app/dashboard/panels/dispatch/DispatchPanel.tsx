"use client";

import type { DispatchItem } from "../../shared/types";
import "./dispatch.css";

export function DispatchPanel({
  dispatchItems,
  dispatchFilter,
  selectedDispatchId,
  operators,
  onFilterChange,
  onSelectDispatch,
  onAssignOperator,
}: {
  dispatchItems: DispatchItem[];
  dispatchFilter: "A dispatcher" | "Assigné" | null;
  selectedDispatchId: string | null;
  operators: string[];
  onFilterChange: (filter: "A dispatcher" | "Assigné" | null) => void;
  onSelectDispatch: (id: string | null) => void;
  onAssignOperator: (name: string) => void;
}) {
  const filtered = dispatchFilter
    ? dispatchItems.filter((d) => d.state === dispatchFilter)
    : dispatchItems;

  const selectedDispatch =
    dispatchItems.find((d) => d.id === selectedDispatchId) ?? null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Dispatch</h2>
          <p className="mt-0.5 text-xs text-muted">
            Affectation des remises et recuperations
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${dispatchFilter === "A dispatcher" ? "vehicle-toggle-active" : ""}`}
            onClick={() =>
              onFilterChange(dispatchFilter === "A dispatcher" ? null : "A dispatcher")
            }
          >
            A assigner
          </button>
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${dispatchFilter === "Assigné" ? "vehicle-toggle-active" : ""}`}
            onClick={() =>
              onFilterChange(dispatchFilter === "Assigné" ? null : "Assigné")
            }
          >
            Assigne
          </button>
        </div>
      </div>

      <div className="mb-3 border-b border-border pb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Operateurs
        </p>
        {!selectedDispatch ? (
          <p className="text-xs text-muted">Selectionnez une mission ci-dessous</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {operators.map((name) => {
              const isAssigned = selectedDispatch.members.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  className={`vehicle-toggle cursor-pointer ${isAssigned ? "vehicle-toggle-active" : ""}`}
                  onClick={() => onAssignOperator(name)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
        {filtered.length === 0 && (
          <div className="card bg-card-secondary p-3 text-sm text-muted">
            Aucune mission pour ce filtre.
          </div>
        )}
        {filtered.map((dispatch) => (
          <div
            key={dispatch.id}
            className={`card bg-card-secondary cursor-pointer p-3 transition-colors ${
              selectedDispatchId === dispatch.id
                ? "ring-2 ring-accent/50"
                : "hover:border-accent/30"
            }`}
            onClick={() =>
              onSelectDispatch(dispatch.id === selectedDispatchId ? null : dispatch.id)
            }
          >
            <p className="text-base font-medium">{dispatch.mission}</p>
            <p className="mt-1 text-sm text-muted">
              {dispatch.bookingRef} · {dispatch.state}
            </p>
            {dispatch.members.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {dispatch.members.map((member) => (
                  <span className="chip" key={`${dispatch.id}-${member}`}>
                    {member}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
