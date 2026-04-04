"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Theme = "light" | "dark" | "ocean" | "ocean-dark" | "forest" | "midnight" | "sunset";

const THEMES: { value: Theme; label: string; bg: string; card: string; accent: string }[] = [
  { value: "light", label: "Clair", bg: "#f6f7f9", card: "#ffffff", accent: "#b4535b" },
  { value: "dark", label: "Sombre", bg: "#0f1218", card: "#171b23", accent: "#d16b73" },
  { value: "ocean", label: "Océan", bg: "#e8f4f8", card: "#ffffff", accent: "#1a7fa8" },
  { value: "ocean-dark", label: "Océan nuit", bg: "#071520", card: "#0d2133", accent: "#3cb0df" },
  { value: "forest", label: "Forêt", bg: "#edf4ed", card: "#ffffff", accent: "#2e7d32" },
  { value: "midnight", label: "Minuit", bg: "#0a0b10", card: "#111318", accent: "#8892d4" },
  { value: "sunset", label: "Coucher de soleil", bg: "#fdf3ee", card: "#ffffff", accent: "#c0521a" },
];

const PANEL_STORAGE_KEY = "citron-panel-config-v1";

type PanelId = "overview" | "dispatch" | "reservations" | "todo";

const ALL_PANELS: { id: PanelId; label: string; description: string }[] = [
  { id: "overview", label: "Vue d'ensemble", description: "Statut de la flotte et indicateurs clés" },
  { id: "dispatch", label: "Dispatch", description: "Assignation des missions aux opérateurs" },
  { id: "reservations", label: "Réservations", description: "Liste des réservations en cours et à venir" },
  { id: "todo", label: "Tâches", description: "Tâches actives et planifiées" },
];

type PanelConfig = { id: PanelId; visible: boolean };

function defaultPanelConfig(): PanelConfig[] {
  return ALL_PANELS.map((p) => ({ id: p.id, visible: true }));
}

function loadPanelConfig(): PanelConfig[] {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (!raw) return defaultPanelConfig();
    const parsed = JSON.parse(raw) as PanelConfig[];
    // Ensure all panels are present
    const merged = ALL_PANELS.map((p) => {
      const saved = parsed.find((s) => s.id === p.id);
      return saved ?? { id: p.id, visible: true };
    });
    return merged;
  } catch {
    return defaultPanelConfig();
  }
}

export default function SettingsPage() {
  // — Theme —
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("citron-theme") as Theme | null;
    if (stored) setTheme(stored);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  const applyTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("citron-theme", t);
  };

  // — Panel config —
  const [panels, setPanels] = useState<PanelConfig[]>(defaultPanelConfig);

  useEffect(() => {
    setPanels(loadPanelConfig());
  }, []);

  const savePanels = (next: PanelConfig[]) => {
    setPanels(next);
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(next));
  };

  const togglePanel = (id: PanelId) => {
    savePanels(panels.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)));
  };

  const movePanel = (index: number, direction: -1 | 1) => {
    const next = [...panels];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    savePanels(next);
  };

  // — Password —
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (pwForm.next !== pwForm.confirm) {
      setPwError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (pwForm.next.length < 8) {
      setPwError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const payload = (await res.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setPwError(payload.error ?? "Erreur lors du changement de mot de passe.");
      } else {
        setPwSuccess(true);
        setPwForm({ current: "", next: "", confirm: "" });
      }
    } catch {
      setPwError("Erreur réseau.");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-3 py-3 md:px-5 md:py-5 lg:px-6" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <main className="mx-auto flex max-w-[860px] flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted">Citron ERP</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Paramètres</h1>
          </div>
          <Link href="/" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>
            ← Dashboard
          </Link>
        </div>

        {/* Theme */}
        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Apparence</h2>
            <p className="mt-0.5 text-sm text-muted">Choisissez le thème de l&apos;interface</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {THEMES.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => applyTheme(t.value)}
                  style={{
                    background: t.bg,
                    border: active ? `2px solid ${t.accent}` : "2px solid transparent",
                    outline: active ? `3px solid ${t.accent}33` : "none",
                    borderRadius: "0.75rem",
                    padding: "0.75rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 150ms, outline 150ms",
                  }}
                >
                  {/* Mini preview */}
                  <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "6px", background: t.card, border: `1px solid ${t.accent}33` }} />
                    <div style={{ width: 20, height: 20, borderRadius: "6px", background: t.accent }} />
                    <div style={{ width: 20, height: 20, borderRadius: "6px", background: t.card, border: `1px solid ${t.accent}22`, opacity: 0.7 }} />
                  </div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: t.accent, margin: 0 }}>{t.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Panel config */}
        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Panneaux du dashboard</h2>
            <p className="mt-0.5 text-sm text-muted">Réorganisez ou masquez les panneaux (sur desktop)</p>
          </div>
          <div className="flex flex-col gap-2">
            {panels.map((p, i) => {
              const info = ALL_PANELS.find((a) => a.id === p.id)!;
              return (
                <div
                  key={p.id}
                  className="card bg-card-secondary flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                  style={{ opacity: p.visible ? 1 : 0.5 }}
                >
                  {/* Order controls */}
                  <div className="flex shrink-0 flex-row gap-1 sm:flex-col sm:gap-0.5">
                    <button
                      type="button"
                      onClick={() => movePanel(i, -1)}
                      disabled={i === 0}
                      style={{ fontSize: "0.7rem", lineHeight: 1, background: "none", border: "none", cursor: i === 0 ? "not-allowed" : "pointer", color: "var(--muted)", padding: "2px 4px" }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => movePanel(i, 1)}
                      disabled={i === panels.length - 1}
                      style={{ fontSize: "0.7rem", lineHeight: 1, background: "none", border: "none", cursor: i === panels.length - 1 ? "not-allowed" : "pointer", color: "var(--muted)", padding: "2px 4px" }}
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-xs text-muted">{info.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePanel(p.id)}
                    className="vehicle-toggle cursor-pointer w-full shrink-0 sm:w-auto"
                    style={{ fontSize: "0.75rem", padding: "3px 10px" }}
                  >
                    {p.visible ? "Masquer" : "Afficher"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Les modifications sont appliquées immédiatement et persistées localement.
          </p>
        </section>

        {/* Password change */}
        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Changer le mot de passe</h2>
            <p className="mt-0.5 text-sm text-muted">Le nouveau mot de passe sera enregistré en base de données</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3" style={{ maxWidth: 420, width: "100%" }}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="pw-current">Mot de passe actuel</label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={pwForm.current}
                onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                required
                style={{
                  background: "var(--card-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.65rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.9rem",
                  color: "var(--foreground)",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="pw-next">Nouveau mot de passe</label>
              <input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                value={pwForm.next}
                onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                required
                style={{
                  background: "var(--card-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.65rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.9rem",
                  color: "var(--foreground)",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="pw-confirm">Confirmer le mot de passe</label>
              <input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                required
                style={{
                  background: "var(--card-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.65rem",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.9rem",
                  color: "var(--foreground)",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>

            {pwError && (
              <p style={{ fontSize: "0.82rem", color: "var(--danger)" }}>{pwError}</p>
            )}
            {pwSuccess && (
              <p style={{ fontSize: "0.82rem", color: "var(--success)" }}>Mot de passe modifié avec succès.</p>
            )}

            <div className="w-full">
              <button
                type="submit"
                disabled={pwLoading}
                className="vehicle-toggle cursor-pointer w-full sm:w-auto"
                style={{ padding: "0.5rem 1.25rem" }}
              >
                {pwLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
