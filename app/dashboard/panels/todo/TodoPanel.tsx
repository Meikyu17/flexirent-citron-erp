"use client";

import Link from "next/link";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type TodoPanelTask = {
  id: string;
  title: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
  vehicle: { id: string; model: string; plateNumber: string } | null;
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  TODO: { label: "À faire", color: "var(--muted)" },
  IN_PROGRESS: { label: "En cours", color: "var(--warning)" },
  DONE: { label: "Terminé", color: "var(--success)" },
};

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function TodoPanel({
  tasks,
  size = "full",
  onStatusChange,
}: {
  tasks: TodoPanelTask[];
  size?: "full" | "compact";
  onStatusChange?: (id: string, status: TaskStatus) => void;
}) {
  const active = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");
  const display = size === "compact" ? active.slice(0, 4) : active;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Tâches</h2>
          <p className="mt-0.5 text-xs text-muted">
            {active.length} active{active.length !== 1 ? "s" : ""} · {done.length} terminée{done.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/todo"
          className="vehicle-toggle cursor-pointer"
          style={{ textDecoration: "none", fontSize: "0.8rem" }}
        >
          Gérer →
        </Link>
      </div>

      <div className={size === "full" ? "custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 space-y-2" : "space-y-2"}>
        {display.length === 0 && (
          <div className="card bg-card-secondary p-3 text-sm text-muted">
            Aucune tâche active.
          </div>
        )}
        {display.map((task) => {
          const cfg = STATUS_CONFIG[task.status];
          return (
            <div key={task.id} className="card bg-card-secondary p-3 flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug flex-1 min-w-0">{task.title}</p>
                <span
                  className="chip shrink-0"
                  style={{
                    fontSize: "0.68rem",
                    borderColor: "transparent",
                    background: `color-mix(in srgb, ${cfg.color} 12%, var(--card))`,
                    color: cfg.color,
                  }}
                >
                  {cfg.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {task.scheduledAt && <span>{formatShortDate(task.scheduledAt)}</span>}
                {task.durationMinutes && <span>{task.durationMinutes} min</span>}
                {task.location && <span>📍 {task.location}</span>}
                {task.assignedTo && <span>{task.assignedTo.name}</span>}
                {task.vehicle && <span>{task.vehicle.model} · {task.vehicle.plateNumber}</span>}
              </div>

              {onStatusChange && task.status !== "DONE" && (
                <div className="flex gap-1.5 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                  {task.status === "TODO" && (
                    <button
                      type="button"
                      className="vehicle-toggle cursor-pointer"
                      style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                      onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                    >
                      Démarrer
                    </button>
                  )}
                  <button
                    type="button"
                    className="vehicle-toggle cursor-pointer"
                    style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                    onClick={() => onStatusChange(task.id, "DONE")}
                  >
                    ✓ Terminer
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {size === "compact" && active.length > 4 && (
          <Link href="/todo" className="block text-center text-xs text-muted py-1" style={{ textDecoration: "none" }}>
            + {active.length - 4} autre{active.length - 4 !== 1 ? "s" : ""} tâche{active.length - 4 !== 1 ? "s" : ""}
          </Link>
        )}
      </div>
    </>
  );
}
