"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BookingItem = {
  id: string;
  client: string;
  pickup: string;
  dropoff: string;
  car: string;
  amount: number;
  source: "Fleetee A" | "Fleetee B" | "Getaround" | "Turo";
};

type VehicleLine = {
  id: string;
  car: string;
  status: "Disponible" | "Réservé" | "Maintenance";
  location: string;
  agency: string;
};

type DispatchItem = {
  id: string;
  bookingRef: string;
  mission: string;
  members: string[];
  state: "A dispatcher" | "Assigné";
};

const bookings: BookingItem[] = [
  {
    id: "R-2191",
    client: "Dominique D.",
    pickup: "Jean-Jaurès / 15h30",
    dropoff: "Jean-Jaurès / 20h30",
    car: "Citroen C3 Grise",
    amount: 132,
    source: "Fleetee A",
  },
  {
    id: "R-2193",
    client: "Sabrina M.",
    pickup: "Citron Centre / 09h15",
    dropoff: "Citron Centre / 17h00",
    car: "Peugeot 206 Bleue",
    amount: 94,
    source: "Getaround",
  },
  {
    id: "R-2198",
    client: "Jean D.",
    pickup: "Jean-Jaurès / 13h45",
    dropoff: "Jean-Jaurès / 18h45",
    car: "Citroen C3 Grise",
    amount: 121,
    source: "Fleetee B",
  },
];

const fleet: VehicleLine[] = [
  {
    id: "V-443",
    car: "Peugeot 206 / YF-284-GK / P.2045",
    status: "Disponible",
    location: "Emplacement 14",
    agency: "Citron Centre",
  },
  {
    id: "V-447",
    car: "Citroen C3 / ZF-378-JK / P.1120",
    status: "Réservé",
    location: "Emplacement 08",
    agency: "Jean-Jaurès",
  },
  {
    id: "V-501",
    car: "Renault Clio / EG-114-RN / P.3321",
    status: "Maintenance",
    location: "Atelier A2",
    agency: "Citron Centre",
  },
];

const dispatches: DispatchItem[] = [
  {
    id: "D-10",
    bookingRef: "R-2198",
    mission: "Jeudi 14 Janvier / Jean-Jaurès / 13h45",
    members: ["Nathan", "Adrian", "Aimery", "Louise"],
    state: "A dispatcher",
  },
  {
    id: "D-11",
    bookingRef: "R-2191",
    mission: "Jeudi 14 Janvier / Jean-Jaurès / 15h30",
    members: ["Nathan", "Louise"],
    state: "Assigné",
  },
];

const employeeStats = [
  { name: "Nathan", handovers: 28, returns: 24 },
  { name: "Louise", handovers: 19, returns: 21 },
  { name: "Adrian", handovers: 16, returns: 17 },
  { name: "Aimery", handovers: 14, returns: 15 },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export default function Home() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    return (
      (localStorage.getItem("citron-theme") as "light" | "dark" | null) ??
      preferredTheme
    );
  });
  const revenue = useMemo(
    () => bookings.reduce((acc, item) => acc + item.amount, 0),
    [],
  );
  const occupancyRate = 74;
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("citron-theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-[1400px] gap-4 lg:grid-cols-[1.05fr_1.4fr]">
        <section className="card p-4 md:p-6">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Citron ERP</h1>
              <p className="text-sm text-muted">Dashboard gestionnaire</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="chip cursor-pointer"
                onClick={() =>
                  setTheme((current) => (current === "light" ? "dark" : "light"))
                }
              >
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
              <button
                type="button"
                className="chip cursor-pointer"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Sortie..." : "Deconnexion"}
              </button>
            </div>
          </header>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <article className="card bg-card-secondary p-4">
              <p className="text-sm text-muted">CA période en cours</p>
              <p className="mt-1 text-2xl font-semibold">{formatMoney(revenue)}</p>
              <p className="mt-2 text-xs text-muted">du 01/03 au 01/04</p>
            </article>
            <article className="card bg-card-secondary p-4">
              <p className="text-sm text-muted">Taux d&apos;occupation</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-accent-soft">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${occupancyRate}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-medium">{occupancyRate}%</p>
            </article>
          </div>

          <article className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Reservations a venir</h2>
              <span className="chip">3 aujourd&apos;hui</span>
            </div>
            <div className="custom-scrollbar max-h-[370px] space-y-3 overflow-y-auto pr-2">
              {bookings.map((booking) => (
                <div key={booking.id} className="card bg-card-secondary p-3">
                  <p className="text-base font-medium">
                    {booking.pickup} / {booking.client}
                  </p>
                  <p className="text-sm text-muted">
                    {booking.car} - {booking.id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="chip">Appeler</span>
                    <span className="chip">SMS Auto</span>
                    <span className="chip">{booking.source}</span>
                    <span className="chip">{formatMoney(booking.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article className="card p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Vehicules</h2>
              <div className="flex flex-wrap gap-2">
                <span className="chip">2 agences</span>
                <span className="chip">Openclaw sync</span>
              </div>
            </div>
            <div className="custom-scrollbar max-h-[260px] space-y-3 overflow-y-auto pr-2">
              {fleet.map((vehicle) => (
                <div key={vehicle.id} className="card bg-card-secondary p-3">
                  <p className="text-lg font-medium">{vehicle.car}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="chip">{vehicle.status}</span>
                    <span className="chip">{vehicle.location}</span>
                    <span className="chip">{vehicle.agency}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Dispatch</h2>
              <div className="flex flex-wrap gap-2">
                <span className="chip">A dispatcher</span>
                <span className="chip">2</span>
              </div>
            </div>
            <div className="space-y-3">
              {dispatches.map((dispatch) => (
                <div key={dispatch.id} className="card bg-card-secondary p-3">
                  <p className="text-base font-medium">{dispatch.mission}</p>
                  <p className="text-sm text-muted">
                    Reservation {dispatch.bookingRef} - {dispatch.state}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dispatch.members.map((member) => (
                      <span className="chip" key={`${dispatch.id}-${member}`}>
                        {member}
                      </span>
                    ))}
                    <span className="chip">...</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card p-4 md:p-5">
            <h2 className="text-xl font-semibold">Performance equipe</h2>
            <p className="mb-3 text-sm text-muted">
              Nombre de remises et recuperations des cles par employe
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {employeeStats.map((employee) => (
                <div key={employee.name} className="card bg-card-secondary p-3">
                  <p className="font-medium">{employee.name}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted">Remises</span>
                    <span>{employee.handovers}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-muted">Recuperations</span>
                    <span>{employee.returns}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
