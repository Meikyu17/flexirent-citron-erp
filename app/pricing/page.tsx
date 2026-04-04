"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AgencyBrand = "CITRON_LOCATION" | "FLEXIRENT";

type PricingRate = {
  id: string;
  agencyBrand: AgencyBrand;
  vehicleModel: string;
  dailyRate: number;
  notes: string | null;
  updatedAt: string;
};

type FleetVehicle = {
  id: string;
  model: string;
  plateNumber: string;
  agency: { brand: AgencyBrand };
};

type RateForm = {
  agencyBrand: AgencyBrand | "";
  vehicleModel: string;
  dailyRateEur: string;
  notes: string;
};

const emptyForm: RateForm = { agencyBrand: "", vehicleModel: "", dailyRateEur: "", notes: "" };

const agencyLabel: Record<AgencyBrand, string> = {
  CITRON_LOCATION: "Citron Location",
  FLEXIRENT: "Flexirent",
};

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function eurToCents(eur: string): number | null {
  const n = Number.parseFloat(eur.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function PricingPage() {
  const router = useRouter();
  const [rates, setRates] = useState<PricingRate[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RateForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RateForm>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [agencyFilter, setAgencyFilter] = useState<AgencyBrand | "">("");

  useEffect(() => {
    Promise.all([
      fetch("/api/pricing", { cache: "no-store" }).then((r) => r.json() as Promise<{ ok: boolean; rates?: PricingRate[] }>),
      fetch("/api/backoffice/vehicles", { cache: "no-store" }).then((r) => r.json() as Promise<{ ok: boolean; vehicles?: FleetVehicle[] }>),
    ])
      .then(([priceData, vehicleData]) => {
        if (priceData.ok && priceData.rates) setRates(priceData.rates);
        if (vehicleData.ok && vehicleData.vehicles) setVehicles(vehicleData.vehicles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  };

  // Deduplicated model list from fleet, filtered by selected agency in form
  const fleetModels = (agencyBrand: AgencyBrand | "") => {
    const filtered = agencyBrand
      ? vehicles.filter((v) => v.agency.brand === agencyBrand)
      : vehicles;
    return [...new Set(filtered.map((v) => v.model))].sort();
  };

  const handleCreate = async () => {
    if (!form.agencyBrand || !form.vehicleModel.trim() || !form.dailyRateEur.trim()) {
      setFormError("Agence, modèle et tarif requis.");
      return;
    }
    const dailyRate = eurToCents(form.dailyRateEur);
    if (!dailyRate) { setFormError("Tarif invalide."); return; }
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyBrand: form.agencyBrand, vehicleModel: form.vehicleModel.trim(), dailyRate, notes: form.notes.trim() || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; rate?: PricingRate; error?: string };
      if (!res.ok || !data.ok || !data.rate) throw new Error(data.error ?? "Erreur");
      setRates((prev) => {
        const idx = prev.findIndex((r) => r.id === data.rate!.id);
        if (idx >= 0) return prev.map((r, i) => (i === idx ? data.rate! : r));
        return [...prev, data.rate!].sort((a, b) => a.agencyBrand.localeCompare(b.agencyBrand) || a.vehicleModel.localeCompare(b.vehicleModel));
      });
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setFormLoading(false);
    }
  };

  const startEdit = (r: PricingRate) => {
    setEditingId(r.id);
    setEditError(null);
    setEditForm({ agencyBrand: r.agencyBrand, vehicleModel: r.vehicleModel, dailyRateEur: centsToEur(r.dailyRate), notes: r.notes ?? "" });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const dailyRate = eurToCents(editForm.dailyRateEur);
    if (!dailyRate) { setEditError("Tarif invalide."); return; }
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/pricing/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleModel: editForm.vehicleModel.trim(), dailyRate, notes: editForm.notes.trim() || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; rate?: PricingRate; error?: string };
      if (!res.ok || !data.ok || !data.rate) throw new Error(data.error ?? "Erreur");
      setRates((prev) => prev.map((r) => (r.id === editingId ? data.rate! : r)));
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/pricing/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) setRates((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
    } catch {
      // silencieux
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = agencyFilter ? rates.filter((r) => r.agencyBrand === agencyFilter) : rates;

  return (
    <div className="dashboard-shell min-h-screen px-3 py-4" style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}>
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Citron ERP</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tableau des prix</h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Link href="/backoffice" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Backoffice</Link>
            <Link href="/clients" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Clients</Link>
            <Link href="/" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Dashboard</Link>
            <button type="button" className="nav-button-danger cursor-pointer" onClick={() => void handleLogout()} disabled={loggingOut}>
              {loggingOut ? "…" : "Déconnexion"}
            </button>
          </div>
        </header>

        {/* Filters + add */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(["", "CITRON_LOCATION", "FLEXIRENT"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`vehicle-toggle cursor-pointer ${agencyFilter === v ? "vehicle-toggle-active" : ""}`}
                onClick={() => setAgencyFilter(v)}
              >
                {v === "" ? "Toutes" : agencyLabel[v]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setShowForm((x) => !x); setForm(emptyForm); setFormError(null); }}
            style={{ ...primaryButtonStyle, width: "auto", padding: "0.6rem 1.2rem" }}
          >
            {showForm ? "Annuler" : "+ Ajouter un tarif"}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <section className="card p-4 flex flex-col gap-4">
            <h2 className="text-base font-semibold">Nouveau tarif</h2>
            <RateFormFields form={form} onChange={setForm} fleetModels={fleetModels} />
            {formError && <p className="text-xs" style={{ color: "var(--danger)" }}>{formError}</p>}
            <button type="button" disabled={formLoading} onClick={() => void handleCreate()} style={primaryButtonStyle}>
              {formLoading ? "Enregistrement…" : "Ajouter le tarif"}
            </button>
          </section>
        )}

        {loading ? (
          <p className="text-center text-muted py-8">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>Aucun tarif configuré.</p>
        ) : (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">{filtered.length} tarif{filtered.length > 1 ? "s" : ""}</p>
            {filtered.map((r) => (
              <div key={r.id} className="card p-4 flex flex-col gap-3">
                {editingId === r.id ? (
                  <>
                    <RateFormFields form={editForm} onChange={setEditForm} fleetModels={fleetModels} hideAgency />
                    {editError && <p className="text-xs" style={{ color: "var(--danger)" }}>{editError}</p>}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" className="vehicle-toggle cursor-pointer flex-1" onClick={() => setEditingId(null)}>Annuler</button>
                      <button type="button" disabled={editLoading} onClick={() => void handleSaveEdit()} style={{ ...primaryButtonStyle, flex: 1 }}>
                        {editLoading ? "…" : "Enregistrer"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold">{r.vehicleModel}</p>
                        <span className="chip" style={{ fontSize: "0.72rem" }}>{agencyLabel[r.agencyBrand]}</span>
                      </div>
                      <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--accent)" }}>
                        {centsToEur(r.dailyRate)} €
                        <span className="text-sm font-normal text-muted ml-1">/ jour</span>
                      </p>
                      {r.notes && <p className="text-xs" style={{ color: "var(--muted)" }}>{r.notes}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" className="vehicle-toggle cursor-pointer" onClick={() => startEdit(r)}>Modifier</button>
                      {confirmDeleteId === r.id ? (
                        <>
                          <button type="button" className="nav-button-danger cursor-pointer" onClick={() => void handleDelete(r.id)} disabled={deletingId === r.id}>
                            {deletingId === r.id ? "…" : "Confirmer"}
                          </button>
                          <button type="button" className="vehicle-toggle cursor-pointer" onClick={() => setConfirmDeleteId(null)}>✕</button>
                        </>
                      ) : (
                        <button type="button" className="nav-button-danger cursor-pointer" onClick={() => setConfirmDeleteId(r.id)}>Supprimer</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function RateFormFields({
  form,
  onChange,
  fleetModels,
  hideAgency = false,
}: {
  form: RateForm;
  onChange: (f: RateForm) => void;
  fleetModels: (agency: AgencyBrand | "") => string[];
  hideAgency?: boolean;
}) {
  const set = (key: keyof RateForm, value: string) => onChange({ ...form, [key]: value });
  const models = fleetModels(form.agencyBrand);

  return (
    <div className="flex flex-col gap-3">
      {!hideAgency && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Agence *</label>
          <div className="flex gap-2">
            {(["CITRON_LOCATION", "FLEXIRENT"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`vehicle-toggle cursor-pointer flex-1 ${form.agencyBrand === v ? "vehicle-toggle-active" : ""}`}
                onClick={() => set("agencyBrand", v)}
              >
                {v === "CITRON_LOCATION" ? "Citron Location" : "Flexirent"}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Modèle véhicule *</label>
        {models.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {models.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`vehicle-toggle cursor-pointer ${form.vehicleModel === m ? "vehicle-toggle-active" : ""}`}
                  style={{ fontSize: "0.8rem" }}
                  onClick={() => set("vehicleModel", m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ou saisir un modèle manuellement"
              value={form.vehicleModel}
              onChange={(e) => set("vehicleModel", e.target.value)}
              style={inputStyle}
            />
          </>
        ) : (
          <input
            type="text"
            placeholder={form.agencyBrand ? "Aucun véhicule dans cette agence — saisir manuellement" : "Sélectionner une agence ou saisir manuellement"}
            value={form.vehicleModel}
            onChange={(e) => set("vehicleModel", e.target.value)}
            style={inputStyle}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Tarif journalier *</label>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="ex : 45,00"
            value={form.dailyRateEur}
            onChange={(e) => set("dailyRateEur", e.target.value)}
            style={{ ...inputStyle, paddingRight: "2.5rem" }}
          />
          <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem", color: "var(--muted)", pointerEvents: "none" }}>€</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Note (optionnel)</label>
        <input type="text" placeholder="Remarque…" value={form.notes} onChange={(e) => set("notes", e.target.value)} style={inputStyle} />
      </div>
    </div>
  );
}

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

const primaryButtonStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "0.65rem",
  padding: "0.7rem 1rem",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  width: "100%",
  opacity: 1,
};
