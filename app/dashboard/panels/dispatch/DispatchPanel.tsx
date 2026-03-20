"use client";

import { useMemo, useState } from "react";
import type {
  BookingItem,
  DispatchIcalFeedLink,
  DispatchItem,
} from "../../shared/types";
import "./dispatch.css";

function formatIsoDay(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function appointmentLabel(booking: BookingItem) {
  if (booking.type === "PICKUP") {
    const [place, time] = booking.pickup.split(" / ");
    return `${formatIsoDay(booking.date)} · ${time ?? ""} · ${place ?? ""}`;
  }

  const [place, time] = booking.dropoff.split(" / ");
  return `${formatIsoDay(booking.dropoffDate)} · ${time ?? ""} · ${place ?? ""}`;
}

const sourceLabel: Record<BookingItem["source"], string> = {
  "Fleetee A": "Fleetee",
  "Fleetee B": "Fleetee",
  Getaround: "Getaround",
  Turo: "Turo",
};

const agencyLabel: Record<BookingItem["agency"], string> = {
  CITRON_LOCATION: "Citron Location",
  FLEXIRENT: "Flexirent",
};

function formatFeedUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) {
    return "jamais mis a jour";
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "mise a jour inconnue";
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DispatchPanel({
  dispatchItems,
  bookings,
  dispatchFilter,
  selectedDispatchId,
  operators,
  onFilterChange,
  onSelectDispatch,
  onAssignOperator,
}: {
  dispatchItems: DispatchItem[];
  bookings: BookingItem[];
  dispatchFilter: "À assigner" | "Assigné" | null;
  selectedDispatchId: string | null;
  operators: string[];
  onFilterChange: (filter: "À assigner" | "Assigné" | null) => void;
  onSelectDispatch: (id: string | null) => void;
  onAssignOperator: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showIcalLinks, setShowIcalLinks] = useState(false);
  const [icalFeeds, setIcalFeeds] = useState<DispatchIcalFeedLink[]>([]);
  const [icalLoading, setIcalLoading] = useState(false);
  const [icalError, setIcalError] = useState<string | null>(null);
  const bookingByRef = useMemo(
    () => new Map(bookings.map((booking) => [booking.id, booking])),
    [bookings],
  );

  const counts = useMemo(
    () => ({
      total: dispatchItems.length,
      toAssign: dispatchItems.filter((d) => d.state === "À assigner").length,
      assigned: dispatchItems.filter((d) => d.state === "Assigné").length,
    }),
    [dispatchItems],
  );

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const base = dispatchFilter
      ? dispatchItems.filter((d) => d.state === dispatchFilter)
      : dispatchItems;

    const searched = normalizedSearch
      ? base.filter(
          (d) =>
            d.bookingRef.toLowerCase().includes(normalizedSearch) ||
            d.mission.toLowerCase().includes(normalizedSearch) ||
            d.members.some((member) =>
              member.toLowerCase().includes(normalizedSearch),
            ) ||
            bookingByRef
              .get(d.bookingRef)
              ?.client.toLowerCase()
              .includes(normalizedSearch),
        )
      : base;

    return [...searched].sort((a, b) => {
      if (a.state === b.state) {
        return a.mission.localeCompare(b.mission, "fr");
      }
      if (a.state === "À assigner") return -1;
      return 1;
    });
  }, [dispatchItems, dispatchFilter, search, bookingByRef]);

  const selectedDispatch =
    dispatchItems.find((d) => d.id === selectedDispatchId) ?? null;

  const loadIcalFeeds = async () => {
    setIcalLoading(true);
    setIcalError(null);

    try {
      const response = await fetch("/api/dispatch/ical/feeds", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        feeds?: DispatchIcalFeedLink[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.feeds) {
        throw new Error(payload.error ?? "Chargement iCal impossible");
      }

      setIcalFeeds(payload.feeds);
    } catch (error) {
      setIcalError(
        error instanceof Error
          ? error.message
          : "Chargement des liens iCal impossible",
      );
    } finally {
      setIcalLoading(false);
    }
  };

  const handleToggleIcal = () => {
    setShowIcalLinks((current) => {
      const nextValue = !current;
      if (nextValue) {
        void loadIcalFeeds();
      }
      return nextValue;
    });
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Dispatch</h2>
          <p className="mt-0.5 text-xs text-muted">
            Affectation des remises et récupérations de clés
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${showIcalLinks ? "vehicle-toggle-active" : ""}`}
            onClick={handleToggleIcal}
          >
            iCal
          </button>
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${dispatchFilter === null ? "vehicle-toggle-active" : ""}`}
            onClick={() => onFilterChange(null)}
          >
            Tous
          </button>
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${dispatchFilter === "À assigner" ? "vehicle-toggle-active" : ""}`}
            onClick={() =>
              onFilterChange(dispatchFilter === "À assigner" ? null : "À assigner")
            }
          >
            À assigner
          </button>
          <button
            type="button"
            className={`vehicle-toggle cursor-pointer ${dispatchFilter === "Assigné" ? "vehicle-toggle-active" : ""}`}
            onClick={() =>
              onFilterChange(dispatchFilter === "Assigné" ? null : "Assigné")
            }
          >
            Assigné
          </button>
        </div>
      </div>

      {showIcalLinks && (
        <div className="mb-3 dispatch-ical-panel">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="dispatch-selected-label m-0">Liens iCal par employe</p>
            <button
              type="button"
              className="vehicle-toggle cursor-pointer"
              onClick={() => void loadIcalFeeds()}
            >
              Rafraichir
            </button>
          </div>

          {icalLoading && (
            <p className="text-xs text-muted">Chargement des liens iCal...</p>
          )}
          {!icalLoading && icalError && (
            <p className="dispatch-ical-error text-xs">{icalError}</p>
          )}
          {!icalLoading && !icalError && icalFeeds.length === 0 && (
            <p className="text-xs text-muted">
              Aucun employe detecte. Affectez un collaborateur pour generer les flux.
            </p>
          )}

          {!icalLoading && !icalError && icalFeeds.length > 0 && (
            <div className="dispatch-ical-feed-list custom-scrollbar">
              {icalFeeds.map((feed) => (
                <article key={feed.feedUrl} className="dispatch-ical-feed-item">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{feed.name}</p>
                    <span className="chip">{feed.eventCount} evenement(s)</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Derniere synchro: {formatFeedUpdatedAt(feed.updatedAt)}
                  </p>
                  <a
                    href={feed.feedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="dispatch-ical-link"
                  >
                    {feed.feedUrl}
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="dispatch-stat-card">
          <p className="dispatch-stat-label">Total</p>
          <p className="dispatch-stat-value">{counts.total}</p>
        </div>
        <div className="dispatch-stat-card dispatch-stat-card-todo">
          <p className="dispatch-stat-label">À assigner</p>
          <p className="dispatch-stat-value">{counts.toAssign}</p>
        </div>
        <div className="dispatch-stat-card dispatch-stat-card-assigned">
          <p className="dispatch-stat-label">Assigné</p>
          <p className="dispatch-stat-value">{counts.assigned}</p>
        </div>
      </div>

      <div className="mb-3">
        <input
          className="dispatch-search"
          placeholder="Rechercher mission, ref réservation ou opérateur..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mb-3 dispatch-selected-panel">
        <p className="dispatch-selected-label">Mission sélectionnée</p>
        {!selectedDispatch ? (
          <p className="text-xs text-muted">
            Sélectionnez une mission dans la liste pour affecter les opérateurs.
          </p>
        ) : (
          <>
            <div className="mb-2">
              <p className="text-sm font-semibold">{selectedDispatch.mission}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="chip">{selectedDispatch.bookingRef}</span>
                <span
                  className={
                    selectedDispatch.state === "À assigner"
                      ? "dispatch-state-badge dispatch-state-badge-todo"
                      : "dispatch-state-badge dispatch-state-badge-assigned"
                  }
                >
                  {selectedDispatch.state}
                </span>
              </div>
            </div>
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
            <p className="mt-2 text-xs text-muted">
              Une seule personne peut etre assignee a la fois.
            </p>
          </>
        )}
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
        {filtered.length === 0 && (
          <div className="card bg-card-secondary p-3 text-sm text-muted">
            Aucune mission pour ce filtre.
          </div>
        )}
        {filtered.map((dispatch) => {
            const booking = bookingByRef.get(dispatch.bookingRef);
            const operationLabel =
              booking?.type === "PICKUP" ? "Remise de clé" : "Retour";
            const appointment = booking ? appointmentLabel(booking) : dispatch.mission;

            return (
              <button
                key={dispatch.id}
                type="button"
                className={`dispatch-item card bg-card-secondary p-3 ${
                  selectedDispatchId === dispatch.id
                    ? "dispatch-item-selected"
                    : "dispatch-item-idle"
                }`}
                onClick={() =>
                  onSelectDispatch(dispatch.id === selectedDispatchId ? null : dispatch.id)
                }
                aria-pressed={selectedDispatchId === dispatch.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-left text-sm font-medium">{dispatch.mission}</p>
                  <span
                    className={
                      dispatch.state === "À assigner"
                        ? "dispatch-state-badge dispatch-state-badge-todo"
                        : "dispatch-state-badge dispatch-state-badge-assigned"
                    }
                  >
                    {dispatch.state}
                  </span>
                </div>
                <p className="mt-1 text-left text-xs text-muted">
                  {dispatch.bookingRef}
                  {booking
                    ? ` · ${sourceLabel[booking.source]} · ${agencyLabel[booking.agency]}`
                    : ""}
                </p>
                {booking && (
                  <div className="dispatch-detail-grid">
                    <div className="dispatch-detail-item">
                      <span className="dispatch-detail-label">Client</span>
                      <span className="dispatch-detail-value">{booking.client}</span>
                    </div>
                    <div className="dispatch-detail-item">
                      <span className="dispatch-detail-label">Opération</span>
                      <span className="dispatch-detail-value">{operationLabel}</span>
                    </div>
                    <div className="dispatch-detail-item">
                      <span className="dispatch-detail-label">Véhicule</span>
                      <span className="dispatch-detail-value">
                        {booking.car} · {booking.plateNumber}
                      </span>
                    </div>
                    <div className="dispatch-detail-item">
                      <span className="dispatch-detail-label">Rendez-vous</span>
                      <span className="dispatch-detail-value">{appointment}</span>
                    </div>
                    <div className="dispatch-detail-item">
                      <span className="dispatch-detail-label">Montant</span>
                      <span className="dispatch-detail-value">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        }).format(booking.amount)}
                      </span>
                    </div>
                    <div className="dispatch-detail-item">
                      <span className="dispatch-detail-label">Équipe</span>
                      <span className="dispatch-detail-value">
                        {dispatch.members[0]
                          ? `Assigne a ${dispatch.members[0]}`
                          : "Aucun assigne"}
                      </span>
                    </div>
                  </div>
                )}
                {dispatch.members.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dispatch.members.map((member) => (
                      <span className="chip" key={`${dispatch.id}-${member}`}>
                        {member}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
      </div>
    </>
  );
}
