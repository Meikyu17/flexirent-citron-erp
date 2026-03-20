"use client";

import type { BookingItem } from "../../shared/types";
import { formatMoney } from "../../shared/utils";
import "./reservations.css";

function pickupTime(booking: BookingItem): string {
  return booking.pickup.split(" / ")[1] ?? "";
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

export function ReservationsPanel({
  bookings,
  size = "full",
}: {
  bookings: BookingItem[];
  size?: "full" | "compact";
}) {
  const groups = sortAndGroup(bookings);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        {size === "full" ? (
          <div>
            <h2 className="text-xl font-semibold">Reservations a venir</h2>
            <p className="mt-1 text-sm text-muted">
              Suivi des departs et retours a traiter en priorite
            </p>
          </div>
        ) : (
          <h2 className="text-xl font-semibold">Reservations a venir</h2>
        )}
        <span className="chip">{bookings.length} a venir</span>
      </div>

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
                      <span className="chip">{formatMoney(booking.amount)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      Retour prevu: {booking.dropoff}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="chip">Appeler</span>
                      <span className="chip">SMS Auto</span>
                      <span className="chip">{booking.source}</span>
                    </div>
                  </div>
                ) : (
                  <div key={booking.id} className="card bg-card-secondary p-3">
                    <p className="text-base font-medium">
                      {booking.pickup} / {booking.client}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {booking.car} - {booking.id}
                    </p>
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
