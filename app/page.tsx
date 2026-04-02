"use client";

import {
  useEffect,
  useMemo,
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
import Link from "next/link";
import { OverviewPanel } from "./dashboard/panels/overview/OverviewPanel";
import { VehiclePanel } from "./dashboard/panels/vehicles/VehiclePanel";
import { DispatchPanel } from "./dashboard/panels/dispatch/DispatchPanel";
import { ReservationsPanel } from "./dashboard/panels/reservations/ReservationsPanel";
import { PerformancePanel } from "./dashboard/panels/performance/PerformancePanel";

const bookings: BookingItem[] = [];

const initialDispatches: DispatchItem[] = [];

const employeeStats: EmployeeStat[] = [];

type BackofficeReservationLog = {
  id: string;
  vehicle: { model: string; plateNumber: string };
  isReservation: boolean;
  startsAt: string | null;
  endsAt: string | null;
  customerName: string | null;
  agencyBrand: AgencyBrand;
  platform: "GETAROUND" | "FLEETEE" | "TURO" | "DIRECT" | null;
};

function toLocalIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toHourLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}h${mm}`;
}

function sourceFromPlatform(
  platform: BackofficeReservationLog["platform"],
): BookingItem["source"] {
  if (platform === "GETAROUND") return "Getaround";
  if (platform === "TURO") return "Turo";
  if (platform === "DIRECT") return "Direct";
  return "Fleetee A";
}

function mapBackofficeLogToBooking(log: BackofficeReservationLog): BookingItem | null {
  if (!log.isReservation || !log.startsAt) return null;

  const start = new Date(log.startsAt);
  if (Number.isNaN(start.getTime())) return null;

  const end = log.endsAt ? new Date(log.endsAt) : null;
  if (end && Number.isNaN(end.getTime())) return null;

  const isOngoing = start <= new Date() && (!end || end >= new Date());
  const type: BookingItem["type"] = isOngoing ? "RETURN" : "PICKUP";
  const pickupTime = toHourLabel(start);
  const dropoffRef = end ?? start;
  const dropoffTime = toHourLabel(dropoffRef);

  return {
    id: `BO-${log.id}`,
    date: toLocalIsoDate(start),
    type,
    client: log.customerName?.trim() || "Client backoffice",
    pickup: `Backoffice / ${pickupTime}`,
    dropoff: `Backoffice / ${dropoffTime}`,
    dropoffDate: toLocalIsoDate(dropoffRef),
    car: log.vehicle.model,
    plateNumber: log.vehicle.plateNumber,
    amount: 0,
    source: sourceFromPlatform(log.platform),
    agency: log.agencyBrand,
    startAtIso: start.toISOString(),
    endAtIso: end?.toISOString(),
  };
}

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
  const [backofficeBookings, setBackofficeBookings] = useState<BookingItem[]>([]);
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
  const dashboardBookings = useMemo(() => {
    const byId = new Map<string, BookingItem>();
    for (const booking of bookings) byId.set(booking.id, booking);
    for (const booking of backofficeBookings) byId.set(booking.id, booking);
    return Array.from(byId.values());
  }, [backofficeBookings]);

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

  useEffect(() => {
    let cancelled = false;
    const loadBackofficeReservations = async () => {
      try {
        const response = await fetch("/api/backoffice/logs?limit=300", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          logs?: BackofficeReservationLog[];
        };

        if (!response.ok || !payload.ok || !payload.logs) return;
        if (cancelled) return;

        const mapped = payload.logs
          .map(mapBackofficeLogToBooking)
          .filter((item): item is BookingItem => item !== null);

        setBackofficeBookings(mapped);
      } catch {
        if (!cancelled) setBackofficeBookings([]);
      }
    };

    void loadBackofficeReservations();
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
    bookings: dashboardBookings,
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
            <Link href="/backoffice" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>
              Backoffice
            </Link>

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
              <ReservationsPanel bookings={dashboardBookings} size="full" />
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
                <ReservationsPanel bookings={dashboardBookings} size="full" />
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
              <ReservationsPanel bookings={dashboardBookings} size="compact" />
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

