"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

import type {
  AgencyBrand,
  BookingItem,
  DispatchItem,
  EmployeeStat,
  FleetVehicle,
  OpenclawPingStatus,
  ParkingOptions,
  VehicleDraft,
} from "./dashboard/shared/types";
import { makeVehicleDrafts } from "./dashboard/shared/utils";
import {
  clamp,
  defaultLayout,
  getViewport,
  LAYOUT_STORAGE_KEY,
  sanitizeLayout,
  splitLimits,
  type ResizeState,
  type SplitKey,
  type SplitLayout,
} from "./dashboard/layout/split-layout";
import { Splitter } from "./dashboard/layout/Splitter";
import { OverviewPanel } from "./dashboard/panels/overview/OverviewPanel";
import { VehiclePanel } from "./dashboard/panels/vehicles/VehiclePanel";
import { DispatchPanel } from "./dashboard/panels/dispatch/DispatchPanel";
import { ReservationsPanel } from "./dashboard/panels/reservations/ReservationsPanel";
import { PerformancePanel } from "./dashboard/panels/performance/PerformancePanel";

const bookings: BookingItem[] = [
  // — Vendredi 21 mars —
  {
    id: "R-2191",
    date: "2026-03-21",
    type: "PICKUP",
    client: "Dominique D.",
    pickup: "Jean-Jaurès / 15h30",
    dropoff: "Jean-Jaurès / 20h30",
    dropoffDate: "2026-03-21",
    car: "Citroen C3 Grise",
    plateNumber: "AB-421-CD",
    amount: 132,
    source: "Fleetee A",
    agency: "CITRON_LOCATION",
  },
  {
    id: "R-2193",
    date: "2026-03-21",
    type: "RETURN",
    client: "Sabrina M.",
    pickup: "Citron Centre / 09h15",
    dropoff: "Citron Centre / 17h00",
    dropoffDate: "2026-03-21",
    car: "Peugeot 206 Bleue",
    plateNumber: "EF-087-GH",
    amount: 94,
    source: "Getaround",
    agency: "CITRON_LOCATION",
  },
  {
    id: "R-2198",
    date: "2026-03-21",
    type: "PICKUP",
    client: "Jean D.",
    pickup: "Jean-Jaurès / 13h45",
    dropoff: "Jean-Jaurès / 18h45",
    dropoffDate: "2026-03-23",
    car: "Citroen C3 Grise",
    plateNumber: "IJ-654-KL",
    amount: 121,
    source: "Fleetee B",
    agency: "FLEXIRENT",
  },
  // — Samedi 22 mars —
  {
    id: "R-2201",
    date: "2026-03-22",
    type: "RETURN",
    client: "Marie L.",
    pickup: "Citron Centre / 08h30",
    dropoff: "Citron Centre / 12h00",
    dropoffDate: "2026-03-22",
    car: "Renault Clio Blanche",
    plateNumber: "MN-302-OP",
    amount: 58,
    source: "Fleetee A",
    agency: "CITRON_LOCATION",
  },
  {
    id: "R-2202",
    date: "2026-03-22",
    type: "PICKUP",
    client: "Pierre K.",
    pickup: "Jean-Jaurès / 14h00",
    dropoff: "Jean-Jaurès / 19h30",
    dropoffDate: "2026-03-25",
    car: "Peugeot 208 Noire",
    plateNumber: "QR-118-ST",
    amount: 87,
    source: "Getaround",
    agency: "FLEXIRENT",
  },
  // — Lundi 24 mars —
  {
    id: "R-2205",
    date: "2026-03-24",
    type: "PICKUP",
    client: "Thomas B.",
    pickup: "Citron Centre / 10h00",
    dropoff: "Citron Centre / 18h00",
    dropoffDate: "2026-03-24",
    car: "Citroen C3 Grise",
    plateNumber: "UV-773-WX",
    amount: 110,
    source: "Fleetee B",
    agency: "FLEXIRENT",
  },
  {
    id: "R-2206",
    date: "2026-03-24",
    type: "RETURN",
    client: "Claire M.",
    pickup: "Jean-Jaurès / 16h30",
    dropoff: "Jean-Jaurès / 20h00",
    dropoffDate: "2026-03-24",
    car: "Renault Clio Blanche",
    plateNumber: "YZ-540-AA",
    amount: 64,
    source: "Turo",
    agency: "FLEXIRENT",
  },
  // — Mercredi 26 mars —
  {
    id: "R-2210",
    date: "2026-03-26",
    type: "RETURN",
    client: "Antoine R.",
    pickup: "Citron Centre / 09h00",
    dropoff: "Citron Centre / 17h30",
    dropoffDate: "2026-03-28",
    car: "Peugeot 206 Bleue",
    plateNumber: "BB-215-CC",
    amount: 145,
    source: "Fleetee A",
    agency: "CITRON_LOCATION",
  },
];

const initialDispatches: DispatchItem[] = [
  {
    id: "D-10",
    bookingRef: "R-2198",
    mission: "Jeudi 14 Janvier / Jean-Jaurès / 13h45",
    members: ["Nathan", "Adrian", "Aimery", "Louise"],
    state: "À assigner",
  },
  {
    id: "D-11",
    bookingRef: "R-2191",
    mission: "Jeudi 14 Janvier / Jean-Jaurès / 15h30",
    members: ["Nathan", "Louise"],
    state: "Assigné",
  },
];

const employeeStats: EmployeeStat[] = [
  { name: "Nathan", handovers: 28, returns: 24 },
  { name: "Louise", handovers: 19, returns: 21 },
  { name: "Adrian", handovers: 16, returns: 17 },
  { name: "Aimery", handovers: 14, returns: 15 },
];

function formatScrapeElapsed(lastScrapeAt: string | null, now: number): string {
  if (!lastScrapeAt) return "jamais";

  const ts = Date.parse(lastScrapeAt);
  if (Number.isNaN(ts)) return "inconnu";

  const elapsedMs = Math.max(0, now - ts);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsedMs < minute) return "moins d'1 min";
  if (elapsedMs < hour) return `${Math.floor(elapsedMs / minute)} min`;
  if (elapsedMs < day) return `${Math.floor(elapsedMs / hour)} h`;
  if (elapsedMs < 7 * day) return `${Math.floor(elapsedMs / day)} j`;

  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Home() {
  const router = useRouter();
  const desktopRootRef = useRef<HTMLDivElement>(null);
  const desktopLeftRef = useRef<HTMLDivElement>(null);
  const desktopBottomRef = useRef<HTMLDivElement>(null);
  const desktopRightRef = useRef<HTMLDivElement>(null);
  const tabletRootRef = useRef<HTMLDivElement>(null);
  const tabletLeftRef = useRef<HTMLDivElement>(null);
  const tabletRightRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">(getViewport);
  const [layout, setLayout] = useState<SplitLayout>(defaultLayout);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [loggingOut, setLoggingOut] = useState(false);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [vehicleDrafts, setVehicleDrafts] = useState<Record<string, VehicleDraft>>({});
  const [selectedBrand, setSelectedBrand] = useState<"ALL" | AgencyBrand>("ALL");
  const [fleetLoading, setFleetLoading] = useState(true);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [savingVehicleId, setSavingVehicleId] = useState<string | null>(null);
  const [openclawStatus, setOpenclawStatus] = useState<OpenclawPingStatus>("checking");
  const [lastOpenclawScrapeAt, setLastOpenclawScrapeAt] = useState<string | null>(
    null,
  );
  const [relativeNow, setRelativeNow] = useState(Date.now());
  const [parkingOptions, setParkingOptions] = useState<ParkingOptions>({ areas: [], spots: [] });
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>(initialDispatches);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [dispatchFilter, setDispatchFilter] = useState<"À assigner" | "Assigné" | null>(null);



  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const visibleVehicles = fleetVehicles.filter(
    (vehicle) => selectedBrand === "ALL" || vehicle.agency.brand === selectedBrand,
  );

  const operators = employeeStats.map((e) => e.name);

  // — Layout persistence —
  useEffect(() => {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!savedLayout) { setLayout(defaultLayout); return; }
    try {
      setLayout(sanitizeLayout(JSON.parse(savedLayout) as Partial<SplitLayout>));
    } catch {
      setLayout(defaultLayout);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  // — Viewport detection —
  useEffect(() => {
    const updateViewport = () => setViewport(getViewport());
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  // — Theme —
  useEffect(() => {
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const storedTheme = localStorage.getItem("citron-theme") as "light" | "dark" | null;
    setTheme(storedTheme ?? preferredTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("citron-theme", theme);
  }, [theme]);

  // — Fleet loading —
  useEffect(() => {
    let cancelled = false;
    const loadVehicles = async () => {
      setFleetLoading(true);
      setFleetError(null);
      try {
        const response = await fetch("/api/vehicles", { cache: "no-store" });
        const payload = (await response.json()) as { ok: boolean; error?: string; vehicles?: FleetVehicle[] };
        if (!response.ok || !payload.ok || !payload.vehicles) {
          throw new Error(payload.error ?? "Chargement des véhicules impossible");
        }
        if (cancelled) return;
        setFleetVehicles(payload.vehicles);
        setVehicleDrafts(makeVehicleDrafts(payload.vehicles));
      } catch (error) {
        if (cancelled) return;
        setFleetError(error instanceof Error ? error.message : "Chargement des véhicules impossible");
      } finally {
        if (!cancelled) setFleetLoading(false);
      }
    };
    void loadVehicles();
    return () => { cancelled = true; };
  }, []);

  // — Parking options —
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/vehicles/parking-options", { cache: "no-store" });
        const payload = (await response.json()) as { ok: boolean; areas?: string[]; spots?: string[] };
        if (response.ok && payload.ok) {
          setParkingOptions({ areas: payload.areas ?? [], spots: payload.spots ?? [] });
        }
      } catch { /* non-critical */ }
    };
    void load();
  }, []);

  // — Openclaw ping —
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const response = await fetch("/api/openclaw/status", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          ok: boolean;
          lastScrapeAt?: string | null;
        };

        if (cancelled) return;
        if (!response.ok || !payload.ok) {
          setOpenclawStatus("offline");
          return;
        }

        setOpenclawStatus("online");
        setLastOpenclawScrapeAt(payload.lastScrapeAt ?? null);
      } catch {
        if (!cancelled) setOpenclawStatus("offline");
      }
    };
    void ping();
    const intervalId = window.setInterval(() => void ping(), 15000);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setRelativeNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // — Resize —
  useEffect(() => {
    if (!resizeState) return;
    const handleMove = (event: PointerEvent) => {
      const delta = resizeState.axis === "x" ? event.clientX : event.clientY;
      const ratio = resizeState.startValue + (delta - resizeState.start) / resizeState.size;
      const limits = splitLimits[resizeState.key];
      setLayout((current) => ({ ...current, [resizeState.key]: clamp(ratio, limits.min, limits.max) }));
    };
    const stopResize = () => setResizeState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [resizeState]);

  const startResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    key: SplitKey,
    axis: "x" | "y",
    container: HTMLDivElement | null,
  ) => {
    if (!container) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    setResizeState({
      key,
      axis,
      start: axis === "x" ? event.clientX : event.clientY,
      startValue: layout[key],
      size: axis === "x" ? rect.width : rect.height,
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const handleAssignOperator = (name: string) => {
    if (!selectedDispatchId) return;
    setDispatchItems((current) =>
      current.map((d) => {
        if (d.id !== selectedDispatchId) return d;
        const isAssigned = d.members.includes(name);
        const newMembers = isAssigned ? d.members.filter((m) => m !== name) : [...d.members, name];
        return { ...d, members: newMembers, state: newMembers.length > 0 ? "Assigné" : "À assigner" };
      }),
    );
  };

  const handleVehicleDraftChange = (vehicleId: string, patch: Partial<VehicleDraft>) => {
    setVehicleDrafts((current) => ({
      ...current,
      [vehicleId]: { ...current[vehicleId], ...patch },
    }));
  };

  const handleAddParkingArea = async (value: string) => {
    if (parkingOptions.areas.includes(value)) return;
    try {
      const response = await fetch("/api/vehicles/parking-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "AREA", value }),
      });
      if (response.ok) {
        setParkingOptions((prev) => ({ ...prev, areas: [...prev.areas, value].sort() }));
      }
    } catch { /* silently ignore */ }
  };

  const handleDeleteParkingArea = async (value: string) => {
    try {
      const response = await fetch("/api/vehicles/parking-options", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "AREA", value }),
      });
      if (response.ok) {
        setParkingOptions((prev) => ({ ...prev, areas: prev.areas.filter((a) => a !== value) }));
      }
    } catch { /* silently ignore */ }
  };

  const handleVehicleSave = async (vehicleId: string) => {
    const draft = vehicleDrafts[vehicleId];
    if (!draft) return;
    setSavingVehicleId(vehicleId);
    setFleetError(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parkingArea: draft.parkingArea.trim(),
          parkingSpot: draft.parkingSpot.trim(),
          operationalStatus: draft.operationalStatus,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; vehicle?: FleetVehicle };
      if (!response.ok || !payload.ok || !payload.vehicle) {
        throw new Error(payload.error ?? "Mise à jour du véhicule impossible");
      }
      const updatedVehicle = payload.vehicle;
      setFleetVehicles((current) =>
        current.map((vehicle) => vehicle.id === vehicleId ? updatedVehicle : vehicle),
      );
      setVehicleDrafts((current) => ({
        ...current,
        [vehicleId]: {
          parkingArea: updatedVehicle.parkingArea,
          parkingSpot: updatedVehicle.parkingSpot,
          operationalStatus: updatedVehicle.operationalStatus,
        },
      }));
      const trimmedArea = updatedVehicle.parkingArea;
      const trimmedSpot = updatedVehicle.parkingSpot;
      setParkingOptions((prev) => ({
        areas: trimmedArea && !prev.areas.includes(trimmedArea) ? [...prev.areas, trimmedArea].sort() : prev.areas,
        spots: trimmedSpot && !prev.spots.includes(trimmedSpot) ? [...prev.spots, trimmedSpot].sort() : prev.spots,
      }));
    } catch (error) {
      setFleetError(error instanceof Error ? error.message : "Mise à jour du véhicule impossible");
    } finally {
      setSavingVehicleId(null);
    }
  };

  const desktopBottomRight = 1 - layout.desktopBottom;
  const tabletRightBottom = 1 - layout.tabletRightTop;

  const sharedVehiclePanelProps = {
    vehicles: visibleVehicles,
    drafts: vehicleDrafts,
    selectedBrand,
    fleetLoading,
    fleetError,
    savingVehicleId,
    parkingOptions,
    onBrandChange: setSelectedBrand,
    onDraftChange: handleVehicleDraftChange,
    onSave: handleVehicleSave,
    onAddParkingArea: handleAddParkingArea,
    onDeleteParkingArea: handleDeleteParkingArea,
  };

  const sharedDispatchPanelProps = {
    dispatchItems,
    bookings,
    dispatchFilter,
    selectedDispatchId,
    operators,
    onFilterChange: setDispatchFilter,
    onSelectDispatch: setSelectedDispatchId,
    onAssignOperator: handleAssignOperator,
  };

  const overviewProps = {
    today,
    fleetVehicles,
    fleetLoading,
    openclawStatus,
  };

  return (
    <div className="dashboard-shell min-h-screen px-3 py-3 md:px-5 md:py-5 lg:px-6">
      <main className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1800px] flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted">
              Citron ERP
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Dashboard gestionnaire
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="vehicle-toggle cursor-pointer">
              Profil
            </button>
            <button type="button" className="vehicle-toggle cursor-pointer">
              Paramètres
            </button>

            <span className="nav-divider" aria-hidden="true" />

            <span className="chip">
              Scraping Openclaw:{" "}
              {openclawStatus === "offline"
                ? "indisponible"
                : `il y a ${formatScrapeElapsed(lastOpenclawScrapeAt, relativeNow)}`}
            </span>

            <span className="nav-divider" aria-hidden="true" />

            <button
              type="button"
              className="vehicle-toggle cursor-pointer"
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "☽ Sombre" : "☀ Clair"}
            </button>

            <span className="nav-divider" aria-hidden="true" />

            <button
              type="button"
              className="nav-button-danger cursor-pointer"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Sortie..." : "Déconnexion"}
            </button>
          </div>
        </div>

        {viewport === "desktop" ? (
          <section
            ref={desktopRootRef}
            className="split-root-desktop flex-1"
            style={{ gridTemplateColumns: `minmax(min-content, ${layout.desktopMain}fr) 0.6rem minmax(min-content, ${1 - layout.desktopMain}fr)` }}
          >
            <div
              ref={desktopLeftRef}
              className="split-column"
              style={{
                gridTemplateRows: `minmax(min-content, ${layout.desktopLeftTop}fr) 0.6rem minmax(min-content, ${1 - layout.desktopLeftTop}fr)`,
              }}
            >
              <article className="dashboard-panel card p-3 md:p-4">
                <OverviewPanel {...overviewProps} size="full" />
              </article>

              <Splitter
                axis="y"
                label="Redimensionner entre Vue d'ensemble et bas de colonne"
                onPointerDown={(event) => startResize(event, "desktopLeftTop", "y", desktopLeftRef.current)}
              />

              <div
                ref={desktopBottomRef}
                className="split-row"
                style={{ gridTemplateColumns: `minmax(min-content, ${layout.desktopBottom}fr) 0.6rem minmax(min-content, ${desktopBottomRight}fr)` }}
              >
                <article className="dashboard-panel card p-4">
                  <VehiclePanel {...sharedVehiclePanelProps} />
                </article>

                <Splitter
                  axis="x"
                  label="Redimensionner entre Véhicules et Dispatch"
                  onPointerDown={(event) => startResize(event, "desktopBottom", "x", desktopBottomRef.current)}
                />

                <div className="flex min-h-0 flex-col gap-[0.6rem]">
                  <article className="dashboard-panel card flex-1 p-4">
                    <DispatchPanel {...sharedDispatchPanelProps} />
                  </article>
                  <article className="dashboard-panel card shrink-0 p-4">
                    <PerformancePanel employees={employeeStats} size="compact" />
                  </article>
                </div>
              </div>
            </div>

            <Splitter
              axis="x"
              label="Redimensionner entre colonnes gauche et droite"
              onPointerDown={(event) => startResize(event, "desktopMain", "x", desktopRootRef.current)}
            />

            <article ref={desktopRightRef} className="dashboard-panel card panel-priority p-4">
              <ReservationsPanel bookings={bookings} size="full" />
            </article>
          </section>

        ) : viewport === "tablet" ? (
          <section
            ref={tabletRootRef}
            className="split-root-tablet flex-1"
            style={{ gridTemplateColumns: `minmax(min-content, ${layout.tabletMain}fr) 0.6rem minmax(min-content, ${1 - layout.tabletMain}fr)` }}
          >
            <div
              ref={tabletLeftRef}
              className="split-column"
              style={{ gridTemplateRows: "auto 0.6rem minmax(min-content, 1fr) 0.6rem minmax(min-content, 1fr)" }}
            >
              <article className="dashboard-panel card p-3 md:p-4">
                <OverviewPanel {...overviewProps} size="full" />
              </article>

              <Splitter
                axis="y"
                label="Redimensionner entre Vue d'ensemble et Vehicules"
                onPointerDown={(event) => startResize(event, "tabletLeftTop", "y", tabletLeftRef.current)}
              />

              <article className="dashboard-panel card p-4">
                <VehiclePanel {...sharedVehiclePanelProps} />
              </article>

              <Splitter
                axis="y"
                label="Redimensionner entre Vehicules et Dispatch"
                onPointerDown={(event) => startResize(event, "tabletLeftMiddle", "y", tabletLeftRef.current)}
              />

              <article className="dashboard-panel card p-4">
                <DispatchPanel {...sharedDispatchPanelProps} />
              </article>
            </div>

            <Splitter
              axis="x"
              label="Redimensionner entre colonnes tablette"
              onPointerDown={(event) => startResize(event, "tabletMain", "x", tabletRootRef.current)}
            />

            <div
              ref={tabletRightRef}
              className="split-column"
              style={{ gridTemplateRows: `minmax(min-content, ${layout.tabletRightTop}fr) 0.6rem minmax(min-content, ${tabletRightBottom}fr)` }}
            >
              <article className="dashboard-panel card panel-priority p-4">
                <ReservationsPanel bookings={bookings} size="full" />
              </article>

              <Splitter
                axis="y"
                label="Redimensionner entre Reservations et Performance equipe"
                onPointerDown={(event) => startResize(event, "tabletRightTop", "y", tabletRightRef.current)}
              />

              <article className="dashboard-panel card p-4">
                <PerformancePanel employees={employeeStats} size="full" />
              </article>
            </div>
          </section>

        ) : (
          <section className="mobile-stack flex-1">
            <article className="dashboard-panel card p-4">
              <OverviewPanel {...overviewProps} size="compact" />
            </article>

            <article className="dashboard-panel card panel-priority p-4">
              <ReservationsPanel bookings={bookings} size="compact" />
            </article>

            <article className="dashboard-panel card p-4">
              <VehiclePanel {...sharedVehiclePanelProps} />
            </article>

            <article className="dashboard-panel card p-4">
              <DispatchPanel {...sharedDispatchPanelProps} />
            </article>

            <article className="dashboard-panel card p-4">
              <PerformancePanel employees={employeeStats} size="compact" />
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
