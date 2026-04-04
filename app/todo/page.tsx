"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type TaskVehicle = { id: string; model: string; plateNumber: string };
type TaskAssignee = { id: string; name: string };

type Task = {
  id: string;
  title: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  location: string | null;
  status: TaskStatus;
  assignedTo: TaskAssignee | null;
  vehicle: TaskVehicle | null;
  createdAt: string;
};

type TaskAssigneeOption = { id: string; name: string };
type Vehicle = { id: string; model: string; plateNumber: string };

type TaskForm = {
  title: string;
  scheduledAt: string;
  durationMinutes: string;
  notes: string;
  location: string;
  assignedToId: string;
  vehicleId: string;
  status: TaskStatus;
};

const emptyForm: TaskForm = {
  title: "",
  scheduledAt: "",
  durationMinutes: "",
  notes: "",
  location: "",
  assignedToId: "",
  vehicleId: "",
  status: "TODO",
};

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "TODO", label: "À faire", color: "var(--muted)" },
  { value: "IN_PROGRESS", label: "En cours", color: "var(--warning)" },
  { value: "DONE", label: "Terminé", color: "var(--success)" },
];

function statusLabel(s: TaskStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}
function statusColor(s: TaskStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.color ?? "var(--muted)";
}

function formatDateTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TodoPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<TaskAssigneeOption[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("citron-theme") as "light" | "dark" | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const t = stored ?? preferred;
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [tRes, oRes, vRes] = await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/backoffice/team", { cache: "no-store" }),
          fetch("/api/backoffice/vehicles", { cache: "no-store" }),
        ]);
        if (tRes.status === 401 || oRes.status === 401 || vRes.status === 401) {
          router.push("/login");
          return;
        }

        const [tData, oData, vData] = await Promise.all([
          tRes.json() as Promise<{ ok: boolean; tasks?: Task[] }>,
          oRes.json() as Promise<{ ok: boolean; members?: TaskAssigneeOption[] }>,
          vRes.json() as Promise<{ ok: boolean; vehicles?: { id: string; model: string; plateNumber: string }[] }>,
        ]);

        if (cancelled) return;
        if (tData.ok && tData.tasks) setTasks(tData.tasks);
        if (oData.ok && oData.members) setAssignees(oData.members);
        if (vData.ok && vData.vehicles) setVehicles(vData.vehicles);
      } catch {
        if (!cancelled) setError("Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [router]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      scheduledAt: toDateTimeLocal(task.scheduledAt),
      durationMinutes: task.durationMinutes?.toString() ?? "",
      notes: task.notes ?? "",
      location: task.location ?? "",
      assignedToId: task.assignedTo?.id ?? "",
      vehicleId: task.vehicle?.id ?? "",
      status: task.status,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Le titre est requis."); return; }
    setFormLoading(true);
    setFormError(null);

    const payload = {
      title: form.title.trim(),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes, 10) : null,
      notes: form.notes.trim(),
      location: form.location.trim(),
      assignedToId: form.assignedToId || null,
      vehicleId: form.vehicleId || null,
      status: form.status,
    };

    try {
      const res = editingId
        ? await fetch(`/api/tasks/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      const data = (await res.json()) as { ok: boolean; task?: Task; error?: string };
      if (!res.ok || !data.ok || !data.task) throw new Error(data.error ?? "Erreur");

      if (editingId) {
        setTasks((prev) => prev.map((t) => t.id === editingId ? data.task! : t));
      } else {
        setTasks((prev) => [...prev, data.task!]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur suppression");
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setConfirmDeleteId(null);
    } catch {
      // silencieux
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickStatus = async (task: Task, next: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    await fetch(`/api/tasks/${task.id}`, {
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
        status: next,
      }),
    }).catch(() => {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
    });
  };

  const filtered = tasks.filter((t) => filterStatus === "ALL" || t.status === filterStatus);
  const counts = {
    TODO: tasks.filter((t) => t.status === "TODO").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    DONE: tasks.filter((t) => t.status === "DONE").length,
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--card-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "0.65rem",
    padding: "0.6rem 0.75rem",
    fontSize: "0.9rem",
    color: "var(--foreground)",
    width: "100%",
    outline: "none",
  };

  return (
    <div className="dashboard-shell min-h-screen px-3 py-4" style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}>
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Citron ERP</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tâches</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
              {theme === "light" ? "☽" : "☀"}
            </button>
            <Link href="/" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Dashboard</Link>
            <Link href="/backoffice" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Backoffice</Link>
          </div>
        </header>

        {loading && <p className="text-center text-muted py-8">Chargement…</p>}
        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

        {!loading && (
          <>
            {/* Stats + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2 flex-wrap">
                {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`vehicle-toggle cursor-pointer ${filterStatus === s ? "vehicle-toggle-active" : ""}`}
                    onClick={() => setFilterStatus(s)}
                  >
                    {s === "ALL" ? `Toutes (${tasks.length})` : `${statusLabel(s)} (${counts[s]})`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`vehicle-toggle cursor-pointer ${showForm && !editingId ? "vehicle-toggle-active" : ""}`}
                onClick={() => showForm && !editingId ? setShowForm(false) : openCreate()}
              >
                {showForm && !editingId ? "Annuler" : "+ Nouvelle tâche"}
              </button>
            </div>

            {/* Form */}
            {showForm && (
              <form onSubmit={handleSubmit} className="card p-4 flex flex-col gap-3">
                <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                  {editingId ? "Modifier la tâche" : "Nouvelle tâche"}
                </p>

                <input
                  type="text"
                  placeholder="Titre de la tâche *"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={inputStyle}
                  required
                />

                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs" style={{ color: "var(--muted)" }}>Date & heure</label>
                    <input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex flex-col gap-1" style={{ width: "120px" }}>
                    <label className="text-xs" style={{ color: "var(--muted)" }}>Durée (min)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="ex : 30"
                      value={form.durationMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Lieu (ex : Parking A, Atelier…)"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  style={inputStyle}
                />

                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs" style={{ color: "var(--muted)" }}>Assigné à</label>
                    <select
                      value={form.assignedToId}
                      onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">— Personne —</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>{assignee.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs" style={{ color: "var(--muted)" }}>Véhicule</label>
                    <select
                      value={form.vehicleId}
                      onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="">— Aucun —</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.model} · {v.plateNumber}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingId && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs" style={{ color: "var(--muted)" }}>Statut</label>
                    <div className="flex gap-1.5">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`vehicle-toggle cursor-pointer ${form.status === opt.value ? "vehicle-toggle-active" : ""}`}
                          onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <textarea
                  placeholder="Note (optionnel)"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />

                {formError && <p className="text-xs" style={{ color: "var(--danger)" }}>{formError}</p>}

                <div className="flex gap-2">
                  {editingId && (
                    <button
                      type="button"
                      className="vehicle-toggle cursor-pointer flex-1"
                      onClick={() => { setShowForm(false); setEditingId(null); }}
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={formLoading}
                    style={{
                      flex: 1,
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.65rem",
                      padding: "0.65rem 1rem",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      opacity: formLoading ? 0.6 : 1,
                    }}
                  >
                    {formLoading ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer la tâche"}
                  </button>
                </div>
              </form>
            )}

            {/* Task list */}
            {filtered.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
                Aucune tâche{filterStatus !== "ALL" ? ` avec ce statut` : ""}.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {filtered.map((task) => (
                <div key={task.id} className="card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{task.title}</p>
                        <span
                          className="chip"
                          style={{
                            fontSize: "0.7rem",
                            borderColor: "transparent",
                            background: `color-mix(in srgb, ${statusColor(task.status)} 12%, var(--card-secondary))`,
                            color: statusColor(task.status),
                          }}
                        >
                          {statusLabel(task.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--muted)" }}>
                        {task.scheduledAt && <span>📅 {formatDateTime(task.scheduledAt)}</span>}
                        {task.durationMinutes && <span>⏱ {task.durationMinutes} min</span>}
                        {task.location && <span>📍 {task.location}</span>}
                        {task.assignedTo && <span>👤 {task.assignedTo.name}</span>}
                        {task.vehicle && <span>🚗 {task.vehicle.model} · {task.vehicle.plateNumber}</span>}
                      </div>
                      {task.notes && (
                        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{task.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Quick status */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Statut :</span>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`vehicle-toggle cursor-pointer ${task.status === opt.value ? "vehicle-toggle-active" : ""}`}
                        style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                        onClick={() => task.status !== opt.value && handleQuickStatus(task, opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="flex gap-1.5 ml-auto">
                      <button
                        type="button"
                        className="vehicle-toggle cursor-pointer"
                        style={{ fontSize: "0.75rem", padding: "2px 10px" }}
                        onClick={() => openEdit(task)}
                      >
                        Modifier
                      </button>
                      {confirmDeleteId === task.id ? (
                        <>
                          <button
                            type="button"
                            className="nav-button-danger cursor-pointer"
                            style={{ fontSize: "0.75rem" }}
                            disabled={deletingId === task.id}
                            onClick={() => handleDelete(task.id)}
                          >
                            {deletingId === task.id ? "…" : "Confirmer"}
                          </button>
                          <button
                            type="button"
                            className="vehicle-toggle cursor-pointer"
                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            onClick={() => setConfirmDeleteId(null)}
                          >✕</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="nav-button-danger cursor-pointer"
                          style={{ fontSize: "0.75rem" }}
                          onClick={() => setConfirmDeleteId(task.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
