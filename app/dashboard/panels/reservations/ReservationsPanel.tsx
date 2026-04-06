"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgencyBrand, BookingItem } from "../../shared/types";
import "./reservations.css";

function pickupTime(booking: BookingItem): string {
  return booking.pickup.split(" / ")[1] ?? "";
}

function formatDropoff(booking: BookingItem): string {
  const [lieu, heure] = booking.dropoff.split(" / ");
  const date = new Date(booking.dropoffDate + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${lieu} — ${date} à ${heure}`;
}

function firstName(client: string): string {
  return client.split(" ")[0] ?? client;
}

function buildSmsMessage(booking: BookingItem): string {
  const prenom = firstName(booking.client);

  const formatDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  if (booking.type === "PICKUP") {
    const [pickupLieu, pickupHeure] = booking.pickup.split(" / ");
    const pickupDate = formatDate(booking.date);
    return `Bonjour ${prenom},\n\nVotre rendez-vous de remise des clés est confirmé le ${pickupDate} à ${pickupHeure ?? ""} au ${pickupLieu ?? ""}.\n\nPour préparer votre prise en charge, merci de prévoir :\n• Votre permis de conduire physique\n• Le paiement de la caution en ligne effectué avant votre arrivée\n\nMerci de nous confirmer votre présence par retour de SMS.\n\nÀ bientôt,\nL'équipe Citron Location`;
  }

  const [retourLieu, retourHeure] = booking.dropoff.split(" / ");
  const retourDate = formatDate(booking.dropoffDate);
  return `Bonjour ${prenom},\n\nNous vous attendons le ${retourDate} à ${retourHeure ?? ""} au ${retourLieu ?? ""} pour la restitution de votre véhicule.\n\nÀ tout à l'heure,\nL'équipe Citron Location`;
}

const agencyLabel: Record<BookingItem["agency"], string> = {
  CITRON_LOCATION: "Citron Location",
  FLEXIRENT: "Flexirent",
};

const platformLabel: Record<BookingItem["source"], string> = {
  "Fleetee A": "Fleetee",
  "Fleetee B": "Fleetee",
  "Getaround": "Getaround",
  "Turo": "Turo",
  "Direct": "Direct",
};

function sourceChips(booking: BookingItem): string[] {
  return [platformLabel[booking.source], agencyLabel[booking.agency]];
}

function parseHourLabel(value: string): { hour: number; minute: number } | null {
  const match = value.match(/(\d{1,2})h(\d{2})/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function bookingStartDate(booking: BookingItem): Date {
  if (booking.startAtIso) {
    const explicit = new Date(booking.startAtIso);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }

  const [year, month, day] = booking.date.split("-").map(Number);
  const parsedTime = parseHourLabel(pickupTime(booking));
  const hour = parsedTime?.hour ?? 12;
  const minute = parsedTime?.minute ?? 0;
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour, minute);
}

function bookingEndDate(booking: BookingItem): Date | null {
  if (booking.endAtIso) {
    const explicit = new Date(booking.endAtIso);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }

  const dropoffTime = booking.dropoff.split(" / ")[1];
  const parsedTime = parseHourLabel(dropoffTime ?? "");
  if (!parsedTime) return null;
  const [year, month, day] = booking.dropoffDate.split("-").map(Number);
  return new Date(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    parsedTime.hour,
    parsedTime.minute,
  );
}

function bookingDisplayDate(booking: BookingItem, now: Date): Date {
  const start = bookingStartDate(booking);
  const end = bookingEndDate(booking);
  if (end && start.getTime() <= now.getTime()) {
    return end;
  }
  return start;
}

function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sortAndGroup(bookings: BookingItem[], now: Date): { date: string; items: BookingItem[] }[] {
  const sorted = [...bookings].sort((a, b) => {
    const diff = bookingDisplayDate(a, now).getTime() - bookingDisplayDate(b, now).getTime();
    if (diff !== 0) return diff;
    const timeDiff = bookingStartDate(a).getTime() - bookingStartDate(b).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.client.localeCompare(b.client, "fr");
  });

  const groups: { date: string; items: BookingItem[] }[] = [];
  for (const booking of sorted) {
    const groupDate = toIsoDate(bookingDisplayDate(booking, now));
    const last = groups[groups.length - 1];
    if (last && last.date === groupDate) {
      last.items.push(booking);
    } else {
      groups.push({ date: groupDate, items: [booking] });
    }
  }
  return groups;
}

function isBackofficeBooking(booking: BookingItem): boolean {
  return booking.id.startsWith("BO-");
}

function bookingRefLabel(booking: BookingItem): string {
  if (isBackofficeBooking(booking)) return "Réservation backoffice";
  return booking.id;
}

function formatDayLabel(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="reservations-day-separator">
      <span>{formatDayLabel(date)}</span>
    </div>
  );
}

function SmsModal({
  booking,
  onClose,
}: {
  booking: BookingItem;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(() => buildSmsMessage(booking));

  return (
    <div className="sms-modal-overlay" onClick={onClose}>
      <div className="sms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sms-modal-header">
          <div>
            <p className="text-base font-semibold">{booking.client}</p>
            <p className="text-xs text-muted">{booking.car} · {bookingRefLabel(booking)}</p>
          </div>
          <button
            type="button"
            className="sms-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <textarea
          className="sms-modal-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={9}
        />

        <div className="sms-modal-footer">
          <span className="text-xs text-muted">{message.length} caractères</span>
          <div className="flex gap-2">
            <button type="button" className="vehicle-toggle cursor-pointer" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="reservation-action-btn reservation-action-sms cursor-pointer">
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PLATFORMS = ["Fleetee", "Getaround", "Turo", "Direct"] as const;
type Platform = typeof PLATFORMS[number];

type BookingMenuAction = {
  id: string;
  label: string;
  destructive?: boolean;
};

function menuActionsForBooking(booking: BookingItem): BookingMenuAction[] {
  if (booking.type === "PICKUP") {
    return [
      { id: "delete", label: "Supprimer", destructive: true },
      { id: "change-time", label: "Changer l'horaire" },
      { id: "change-place", label: "Changer lieu" },
      { id: "change-vehicle", label: "Changer vehicule" },
    ];
  }

  return [
    { id: "change-time", label: "Changer l'horaire" },
    { id: "change-place", label: "Changer le lieu" },
  ];
}

export function ReservationsPanel({
  bookings,
  size = "full",
  onDeleteBooking,
}: {
  bookings: BookingItem[];
  size?: "full" | "compact";
  onDeleteBooking?: (bookingId: string) => Promise<void>;
}) {
  const [smsBooking, setSmsBooking] = useState<BookingItem | null>(null);
  const [search, setSearch] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<AgencyBrand | null>(null);
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);
  const [openMenuBookingId, setOpenMenuBookingId] = useState<string | null>(null);
  const [confirmDeleteBookingId, setConfirmDeleteBookingId] = useState<string | null>(null);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [validatedBookingIds, setValidatedBookingIds] = useState<Set<string>>(
    () => {
      if (typeof window === "undefined") return new Set();
      try {
        const raw = localStorage.getItem("citron-validated-reservations");
        if (!raw) return new Set();
        const parsed = JSON.parse(raw) as string[];
        return new Set(parsed);
      } catch {
        return new Set();
      }
    },
  );

  useEffect(() => {
    localStorage.setItem(
      "citron-validated-reservations",
      JSON.stringify(Array.from(validatedBookingIds)),
    );
  }, [validatedBookingIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (validatedBookingIds.has(b.id)) return false;
      if (q && !b.client.toLowerCase().includes(q) && !b.plateNumber.toLowerCase().includes(q)) return false;
      if (agencyFilter && b.agency !== agencyFilter) return false;
      if (platformFilter && platformLabel[b.source] !== platformFilter) return false;
      return true;
    });
  }, [bookings, search, agencyFilter, platformFilter, validatedBookingIds]);

  const groups = useMemo(() => sortAndGroup(filtered, new Date()), [filtered]);

  useEffect(() => {
    if (size !== "full") return;
    const container = listRef.current;
    if (!container || groups.length === 0) return;

    const today = new Date();
    const todayNoonTs = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12,
      0,
      0,
      0,
    ).getTime();

    let nearestDate: string | null = null;
    let nearestDiff = Number.POSITIVE_INFINITY;

    for (const group of groups) {
      const groupTs = new Date(`${group.date}T12:00:00`).getTime();
      const diff = Math.abs(groupTs - todayNoonTs);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestDate = group.date;
      }
    }

    if (!nearestDate) return;
    const target = container.querySelector<HTMLElement>(
      `[data-group-date="${nearestDate}"]`,
    );
    if (!target) return;
    container.scrollTo({ top: Math.max(0, target.offsetTop - 8) });
  }, [groups, size]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".reservation-overflow")) {
        return;
      }
      setOpenMenuBookingId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const handleBookingMenuAction = (booking: BookingItem, action: BookingMenuAction) => {
    setOpenMenuBookingId(null);
    if (action.id === "delete") {
      setConfirmDeleteBookingId(booking.id);
    }
  };

  const handleConfirmDeleteBooking = async (booking: BookingItem) => {
    if (!onDeleteBooking) return;
    setDeletingBookingId(booking.id);
    setConfirmDeleteBookingId(null);
    try {
      await onDeleteBooking(booking.id);
    } finally {
      setDeletingBookingId(null);
    }
  };

  const handleValidateBooking = (bookingId: string) => {
    setValidatedBookingIds((current) => {
      const next = new Set(current);
      next.add(bookingId);
      return next;
    });
  };

  return (
    <>
      {smsBooking && <SmsModal booking={smsBooking} onClose={() => setSmsBooking(null)} />}

      {confirmDeleteBookingId && (() => {
        const b = bookings.find((x) => x.id === confirmDeleteBookingId);
        if (!b) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="card p-5 max-w-sm w-full mx-4">
              <p className="font-semibold mb-1">Supprimer la réservation ?</p>
              <p className="text-sm text-muted mb-4">{b.client} · {b.car} · {b.date}</p>
              <div className="flex gap-2">
                <button type="button" className="nav-button-danger cursor-pointer flex-1" onClick={() => void handleConfirmDeleteBooking(b)}>
                  Supprimer
                </button>
                <button type="button" className="vehicle-toggle cursor-pointer flex-1" onClick={() => setConfirmDeleteBookingId(null)}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        {size === "full" ? (
          <div>
            <h2 className="text-xl font-semibold">Réservations à venir</h2>
            <p className="mt-1 text-sm text-muted">
              Suivi des départs et retours à traiter en priorité
            </p>
          </div>
        ) : (
          <h2 className="text-xl font-semibold">Réservations à venir</h2>
        )}
        <span className="chip">{filtered.length} à venir</span>
      </div>

      {size === "full" && (
        <div className="flex flex-col gap-2">
          <input
            className="w-full rounded-xl border border-border bg-card-secondary px-3 py-2 text-sm outline-none transition focus:border-accent placeholder:text-muted"
            placeholder="Rechercher par locataire ou plaque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`vehicle-toggle cursor-pointer ${agencyFilter === "CITRON_LOCATION" ? "vehicle-toggle-active" : ""}`}
              onClick={() => setAgencyFilter(agencyFilter === "CITRON_LOCATION" ? null : "CITRON_LOCATION")}
            >
              Citron Location
            </button>
            <button
              type="button"
              className={`vehicle-toggle cursor-pointer ${agencyFilter === "FLEXIRENT" ? "vehicle-toggle-active" : ""}`}
              onClick={() => setAgencyFilter(agencyFilter === "FLEXIRENT" ? null : "FLEXIRENT")}
            >
              Flexirent
            </button>
            <span className="nav-divider" aria-hidden="true" />
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                className={`vehicle-toggle cursor-pointer ${platformFilter === p ? "vehicle-toggle-active" : ""}`}
                onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={size === "full" ? listRef : null}
        className={size === "full" ? "custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-2" : ""}
      >
        {groups.map((group, groupIndex) => (
          <div key={group.date} data-group-date={group.date}>
            {groupIndex > 0 && <DaySeparator date={group.date} />}
            {groupIndex === 0 && (
              <div className="reservations-day-separator reservations-day-separator--first">
                <span>{formatDayLabel(group.date)}</span>
              </div>
            )}
            <div className="space-y-2">
              {group.items.map((booking) =>
                size === "full" ? (
                  <div key={booking.id} className="card bg-card-secondary p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-medium">
                          {booking.type === "PICKUP" ? booking.pickup : booking.dropoff} / {booking.client}
                        </p>
                        <p className="text-sm text-muted">
                          {booking.car} - {bookingRefLabel(booking)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={booking.type === "PICKUP" ? "booking-type-badge booking-type-pickup" : "booking-type-badge booking-type-return"}>
                          {booking.type === "PICKUP" ? "Remise de clé" : "Retour"}
                        </span>
                        
                      </div>
                    </div>
                    {booking.type === "PICKUP" && (
                      <p className="mt-2 text-sm text-muted">
                        Retour prévu : {formatDropoff(booking)}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="reservation-action-btn reservation-action-call">
                          Appeler
                        </button>
                        <button
                          type="button"
                          className="reservation-action-btn reservation-action-sms"
                          onClick={() => setSmsBooking(booking)}
                        >
                          SMS Auto
                        </button>
                        {sourceChips(booking).map((label) => (
                          <span key={label} className="chip">{label}</span>
                        ))}
                      </div>

                      <div className="reservation-overflow">
                        <button
                          type="button"
                          className="reservation-overflow-trigger"
                          aria-label={`Options reservation ${bookingRefLabel(booking)}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuBookingId === booking.id}
                          onClick={() =>
                            setOpenMenuBookingId((current) =>
                              current === booking.id ? null : booking.id,
                            )
                          }
                        >
                          <span aria-hidden="true">•••</span>
                        </button>

                        {openMenuBookingId === booking.id && (
                          <div className="reservation-overflow-menu" role="menu">
                            {menuActionsForBooking(booking).map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                className={`reservation-overflow-item ${
                                  action.destructive
                                    ? "reservation-overflow-item-danger"
                                    : ""
                                }`}
                                onClick={() => handleBookingMenuAction(booking, action)}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const endDate = bookingEndDate(booking);
                      const canValidate =
                        endDate !== null && endDate.getTime() < Date.now();
                      if (!canValidate) return null;
                      return (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            className="reservation-action-btn reservation-action-call"
                            onClick={() => handleValidateBooking(booking.id)}
                          >
                            Valider la location
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div key={booking.id} className="card bg-card-secondary p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-medium">
                          {booking.type === "PICKUP" ? booking.pickup : booking.dropoff} / {booking.client}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          {booking.car} - {bookingRefLabel(booking)}
                        </p>
                      </div>
                      <span className={booking.type === "PICKUP" ? "booking-type-badge booking-type-pickup" : "booking-type-badge booking-type-return"}>
                        {booking.type === "PICKUP" ? "Remise de clé" : "Retour"}
                      </span>
                    </div>

                    <div className="mt-2 flex justify-end">
                      <div className="reservation-overflow">
                        <button
                          type="button"
                          className="reservation-overflow-trigger"
                          aria-label={`Options reservation ${bookingRefLabel(booking)}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuBookingId === booking.id}
                          onClick={() =>
                            setOpenMenuBookingId((current) =>
                              current === booking.id ? null : booking.id,
                            )
                          }
                        >
                          <span aria-hidden="true">•••</span>
                        </button>

                        {openMenuBookingId === booking.id && (
                          <div className="reservation-overflow-menu" role="menu">
                            {menuActionsForBooking(booking).map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                className={`reservation-overflow-item ${
                                  action.destructive
                                    ? "reservation-overflow-item-danger"
                                    : ""
                                }`}
                                onClick={() => handleBookingMenuAction(booking, action)}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const endDate = bookingEndDate(booking);
                      const canValidate =
                        endDate !== null && endDate.getTime() < Date.now();
                      if (!canValidate) return null;
                      return (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            className="reservation-action-btn reservation-action-call"
                            onClick={() => handleValidateBooking(booking.id)}
                          >
                            Valider la location
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

