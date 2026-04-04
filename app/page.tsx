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
} from "./dashboard/shared/types";
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
import { DispatchPanel } from "./dashboard/panels/dispatch/DispatchPanel";
import { ReservationsPanel } from "./dashboard/panels/reservations/ReservationsPanel";
import { TodoPanel, type TodoPanelTask } from "./dashboard/panels/todo/TodoPanel";

const bookings: BookingItem[] = [];

const initialDispatches: DispatchItem[] = [];


type BackofficeReservationLog = {
  id: string;
  vehicle: { model: string; plateNumber: string };
  isReservation: boolean;
  startsAt: string | null;
  endsAt: string | null;
  customerName: string | null;
  agencyBrand: AgencyBrand;
  platform: "GETAROUND" | "FLEETEE" | "TURO" | "DIRECT" | null;
  pickupAddress: string | null;
  returnAddress: string | null;
};

type OverviewFleetVehicle = {
  operationalStatus: "AVAILABLE" | "RESERVED" | "IN_RENT" | "OUT_OF_SERVICE";
  agency: { brand: AgencyBrand };
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

  const pickupLoc = log.pickupAddress?.trim() || "Backoffice";
  const returnLoc = log.returnAddress?.trim() || "Backoffice";

  return {
    id: `BO-${log.id}`,
    date: toLocalIsoDate(start),
    type,
    client: log.customerName?.trim() || "Client backoffice",
    pickup: `${pickupLoc} / ${pickupTime}`,
    dropoff: `${returnLoc} / ${dropoffTime}`,
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

export default function Home() {
  const router = useRouter();
  const desktopRootRef = useRef<HTMLDivElement>(null);
  const desktopLeftRef = useRef<HTMLDivElement>(null);
  const desktopRightRef = useRef<HTMLDivElement>(null);
  const tabletRootRef = useRef<HTMLDivElement>(null);
  const tabletLeftRef = useRef<HTMLDivElement>(null);
  const tabletRightRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">(getViewport);
  const [layout, setLayout] = useState<SplitLayout>(defaultLayout);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [theme, setTheme] = useState<string>("light");
  const [loggingOut, setLoggingOut] = useState(false);
  const [overviewFleetVehicles, setOverviewFleetVehicles] = useState<OverviewFleetVehicle[]>([]);
  const [overviewFleetLoading, setOverviewFleetLoading] = useState(true);
  const [tasks, setTasks] = useState<TodoPanelTask[]>([]);
  const [panelConfig, setPanelConfig] = useState<Record<string, boolean>>({
    overview: true, dispatch: true, reservations: true, todo: true,
  });

  useEffect(() => {
    const raw = localStorage.getItem("citron-panel-config-v1");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { id: string; visible: boolean }[];
      const map: Record<string, boolean> = {};
      for (const p of parsed) map[p.id] = p.visible;
      setPanelConfig((prev) => ({ ...prev, ...map }));
    } catch { /* ignore */ }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "citron-panel-config-v1" || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { id: string; visible: boolean }[];
        const map: Record<string, boolean> = {};
        for (const p of parsed) map[p.id] = p.visible;
        setPanelConfig((prev) => ({ ...prev, ...map }));
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>(initialDispatches);
  const [backofficeBookings, setBackofficeBookings] = useState<BookingItem[]>([]);
  const [dispatchBookings, setDispatchBookings] = useState<BookingItem[]>([]);
  const [dispatchOperators, setDispatchOperators] = useState<{ id: string; name: string }[]>([]);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [dispatchFilter, setDispatchFilter] = useState<"À assigner" | "Assigné" | null>(null);
  const [dispatchCollapsed, setDispatchCollapsed] = useState(false);



  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
    const storedTheme = localStorage.getItem("citron-theme");
    setTheme(storedTheme ?? preferredTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("citron-theme", theme);
  }, [theme]);

  // Sync theme if changed in settings tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "citron-theme" && e.newValue) setTheme(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadOverviewFleet = async (setLoading: boolean) => {
      if (setLoading) setOverviewFleetLoading(true);
      try {
        const response = await fetch("/api/backoffice/vehicles", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          vehicles?: OverviewFleetVehicle[];
        };
        if (!response.ok || !payload.ok || !payload.vehicles) {
          throw new Error("Chargement des statuts de flotte impossible");
        }
        if (cancelled) return;
        setOverviewFleetVehicles(payload.vehicles);
      } catch {
        if (!cancelled) setOverviewFleetVehicles([]);
      } finally {
        if (!cancelled && setLoading) setOverviewFleetLoading(false);
      }
    };

    void loadOverviewFleet(true);
    const intervalId = window.setInterval(() => void loadOverviewFleet(false), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
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

  // — Tasks —
  useEffect(() => {
    let cancelled = false;
    const loadTasks = async () => {
      try {
        const response = await fetch("/api/tasks", { cache: "no-store" });
        if (response.status === 401) return;
        const payload = (await response.json()) as { ok: boolean; tasks?: TodoPanelTask[] };
        if (!payload.ok || cancelled) return;
        if (payload.tasks) setTasks(payload.tasks);
      } catch { /* silencieux */ }
    };
    void loadTasks();
    return () => { cancelled = true; };
  }, []);

  const handleTaskStatusChange = (id: string, status: TodoPanelTask["status"]) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    void fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        scheduledAt: task.scheduledAt,
        durationMinutes: task.durationMinutes,
        notes: task.notes ?? "",
        location: task.location ?? "",
        assignedToId: task.assignedTo?.id ?? null,
        vehicleId: task.vehicle?.id ?? null,
        status,
      }),
    }).catch(() => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: task.status } : t)));
  };

  // — Dispatch —
  useEffect(() => {
    let cancelled = false;
    const loadDispatches = async () => {
      try {
        const response = await fetch("/api/dispatch/items", { cache: "no-store" });
        if (response.status === 401) return;
        const payload = (await response.json()) as {
          ok: boolean;
          dispatches?: DispatchItem[];
          bookings?: BookingItem[];
          operators?: { id: string; name: string }[];
        };
        if (!payload.ok) return;
        if (cancelled) return;
        if (payload.dispatches) setDispatchItems(payload.dispatches);
        if (payload.bookings) setDispatchBookings(payload.bookings);
        if (payload.operators) setDispatchOperators(payload.operators);
      } catch {
        // silencieux — le panel reste vide
      }
    };
    void loadDispatches();
    return () => { cancelled = true; };
  }, []);

  // — Dispatch iCal sync —
  useEffect(() => {
    let cancelled = false;

    const syncDispatchIcal = async () => {
      try {
        const response = await fetch("/api/dispatch/ical/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operators: dispatchOperators.map((o) => o.name),
            bookings: dispatchBookings,
            dispatchItems,
          }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Synchronisation iCal impossible");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Dispatch iCal sync failed", error);
        }
      }
    };

    void syncDispatchIcal();
    return () => {
      cancelled = true;
    };
  }, [dispatchItems, dispatchBookings, dispatchOperators]);

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

  const handleDeleteBackofficeBooking = async (bookingId: string) => {
    // bookingId is "BO-{logId}"
    const logId = bookingId.startsWith("BO-") ? bookingId.slice(3) : bookingId;
    const res = await fetch(`/api/backoffice/logs/${logId}`, { method: "DELETE" });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur de suppression");
    setBackofficeBookings((prev) => prev.filter((b) => b.id !== bookingId));
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
    const operator = dispatchOperators.find((o) => o.name === name);
    const dispatch = dispatchItems.find((d) => d.id === selectedDispatchId);
    if (!dispatch) return;

    const isAssigned = dispatch.members.includes(name);
    const newMembers = isAssigned ? [] : [name];
    const operatorId = isAssigned ? null : (operator?.id ?? null);

    setDispatchItems((current) =>
      current.map((d) => {
        if (d.id !== selectedDispatchId) return d;
        return { ...d, members: newMembers, state: newMembers.length > 0 ? "Assigné" : "À assigner" };
      }),
    );

    void fetch(`/api/dispatch/items/${selectedDispatchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operatorId, operatorName: isAssigned ? null : name }),
    }).catch((err) => console.error("Dispatch assign failed", err));
  };
  const tabletRightBottom = 1 - layout.tabletRightTop;

  const sharedDispatchPanelProps = {
    dispatchItems,
    bookings: dispatchBookings,
    dispatchFilter,
    selectedDispatchId,
    operators: dispatchOperators.map((o) => o.name),
    collapsed: dispatchCollapsed,
    onFilterChange: setDispatchFilter,
    onSelectDispatch: setSelectedDispatchId,
    onAssignOperator: handleAssignOperator,
    onToggleCollapsed: () => setDispatchCollapsed((current) => !current),
  };

  const overviewProps = {
    today,
    fleetVehicles: overviewFleetVehicles,
    fleetLoading: overviewFleetLoading,
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
            <Link href="/settings" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>
              Paramètres
            </Link>
            <Link href="/backoffice" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>
              Backoffice
            </Link>
            <Link href="/todo" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>
              Tâches
            </Link>
            <span className="nav-divider" aria-hidden="true" />

            <button
              type="button"
              className="vehicle-toggle cursor-pointer"
              onClick={() => {
                const next = theme === "light" ? "dark" : "light";
                setTheme(next);
                document.documentElement.setAttribute("data-theme", next);
                localStorage.setItem("citron-theme", next);
              }}
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
              {panelConfig.overview && (
                <article className="dashboard-panel card p-3 md:p-4">
                  <OverviewPanel {...overviewProps} size="full" />
                </article>
              )}

              <Splitter
                axis="y"
                label="Redimensionner entre Vue d'ensemble et bas de colonne"
                onPointerDown={(event) => startResize(event, "desktopLeftTop", "y", desktopLeftRef.current)}
              />

              <div className="flex min-h-0 flex-col gap-[0.6rem]">
                {panelConfig.dispatch && (
                  <article
                    className={`dashboard-panel card p-4 ${dispatchCollapsed ? "shrink-0" : "flex-1"}`}
                  >
                    <DispatchPanel {...sharedDispatchPanelProps} />
                  </article>
                )}
                {panelConfig.todo && (
                  <article
                    className={`dashboard-panel card p-4 ${dispatchCollapsed ? "flex-1" : "shrink-0"}`}
                  >
                    <TodoPanel tasks={tasks} size="compact" onStatusChange={handleTaskStatusChange} />
                  </article>
                )}
              </div>
            </div>

            <Splitter
              axis="x"
              label="Redimensionner entre colonnes gauche et droite"
              onPointerDown={(event) => startResize(event, "desktopMain", "x", desktopRootRef.current)}
            />

            {panelConfig.reservations && (
              <article ref={desktopRightRef} className="dashboard-panel card panel-priority p-4">
                <ReservationsPanel bookings={backofficeBookings} size="full" onDeleteBooking={handleDeleteBackofficeBooking} />
              </article>
            )}
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
              style={{
                gridTemplateRows: dispatchCollapsed
                  ? "auto 0.6rem auto"
                  : "auto 0.6rem minmax(min-content, 1fr)",
              }}
            >
              {panelConfig.overview && (
                <article className="dashboard-panel card p-3 md:p-4">
                  <OverviewPanel {...overviewProps} size="full" />
                </article>
              )}

              <Splitter
                axis="y"
                label="Redimensionner entre Vue d'ensemble et Dispatch"
                onPointerDown={(event) => startResize(event, "tabletLeftTop", "y", tabletLeftRef.current)}
              />

              {panelConfig.dispatch && (
                <article className="dashboard-panel card p-4">
                  <DispatchPanel {...sharedDispatchPanelProps} />
                </article>
              )}
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
              {panelConfig.reservations && (
                <article className="dashboard-panel card panel-priority p-4">
                  <ReservationsPanel bookings={backofficeBookings} size="full" onDeleteBooking={handleDeleteBackofficeBooking} />
                </article>
              )}

              <Splitter
                axis="y"
                label="Redimensionner entre Reservations et Performance equipe"
                onPointerDown={(event) => startResize(event, "tabletRightTop", "y", tabletRightRef.current)}
              />

              {panelConfig.todo && (
                <article className="dashboard-panel card p-4">
                  <TodoPanel tasks={tasks} size="full" onStatusChange={handleTaskStatusChange} />
                </article>
              )}
            </div>
          </section>

        ) : (
          <section className="mobile-stack flex-1">
            {panelConfig.overview && (
              <article className="dashboard-panel card p-4">
                <OverviewPanel {...overviewProps} size="compact" />
              </article>
            )}
            {panelConfig.reservations && (
              <article className="dashboard-panel card panel-priority p-4">
                <ReservationsPanel bookings={backofficeBookings} size="compact" onDeleteBooking={handleDeleteBackofficeBooking} />
              </article>
            )}
            {panelConfig.dispatch && (
              <article className="dashboard-panel card p-4">
                <DispatchPanel {...sharedDispatchPanelProps} />
              </article>
            )}
            {panelConfig.todo && (
              <article className="dashboard-panel card p-4">
                <TodoPanel tasks={tasks} size="compact" onStatusChange={handleTaskStatusChange} />
              </article>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
