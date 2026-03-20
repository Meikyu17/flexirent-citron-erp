"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgencyBrand, BookingItem } from "../../shared/types";
import { formatMoney } from "../../shared/utils";
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
};

function sourceChips(booking: BookingItem): string[] {
  return [platformLabel[booking.source], agencyLabel[booking.agency]];
}

function sortAndGroup(bookings: BookingItem[]): { date: string; items: BookingItem[] }[] {
  const sorted = [...bookings].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return pickupTime(a).localeCompare(pickupTime(b));
  });

  const groups: { date: string; items: BookingItem[] }[] = [];
  for (const booking of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === booking.date) {
      last.items.push(booking);
    } else {
      groups.push({ date: booking.date, items: [booking] });
    }
  }
  return groups;
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
            <p className="text-xs text-muted">{booking.car} · {booking.id}</p>
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

const PLATFORMS = ["Fleetee", "Getaround", "Turo"] as const;
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
}: {
  bookings: BookingItem[];
  size?: "full" | "compact";
}) {
  const [smsBooking, setSmsBooking] = useState<BookingItem | null>(null);
  const [search, setSearch] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<AgencyBrand | null>(null);
  const [platformFilter, setPlatformFilter] = useState<Platform | null>(null);
  const [openMenuBookingId, setOpenMenuBookingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (q && !b.client.toLowerCase().includes(q) && !b.plateNumber.toLowerCase().includes(q)) return false;
      if (agencyFilter && b.agency !== agencyFilter) return false;
      if (platformFilter && platformLabel[b.source] !== platformFilter) return false;
      return true;
    });
  }, [bookings, search, agencyFilter, platformFilter]);

  const groups = sortAndGroup(filtered);

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
    console.info(`[reservations] action=${action.id} booking=${booking.id}`);
  };

  return (
    <>
      {smsBooking && <SmsModal booking={smsBooking} onClose={() => setSmsBooking(null)} />}

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

      <div className={size === "full" ? "custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-2" : ""}>
        {groups.map((group, groupIndex) => (
          <div key={group.date}>
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
                          {booking.pickup} / {booking.client}
                        </p>
                        <p className="text-sm text-muted">
                          {booking.car} - {booking.id}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={booking.type === "PICKUP" ? "booking-type-badge booking-type-pickup" : "booking-type-badge booking-type-return"}>
                          {booking.type === "PICKUP" ? "Remise de clé" : "Retour"}
                        </span>
                        <span className="chip">{formatMoney(booking.amount)}</span>
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
                          aria-label={`Options reservation ${booking.id}`}
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
                  </div>
                ) : (
                  <div key={booking.id} className="card bg-card-secondary p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-medium">
                          {booking.pickup} / {booking.client}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          {booking.car} - {booking.id}
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
                          aria-label={`Options reservation ${booking.id}`}
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
