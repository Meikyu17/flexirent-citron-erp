"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AgencyBrand = "CITRON_LOCATION" | "FLEXIRENT";

type PricingRate = {
  id: string;
  agencyBrand: AgencyBrand;
  vehicleModel: string;
  dailyRate: number; // centimes
  notes: string | null;
  updatedAt: string;
};

type RateForm = {
  agencyBrand: AgencyBrand | "";
  vehicleModel: string;
  dailyRateEur: string;
  notes: string;
};

const emptyForm: RateForm = {
  agencyBrand: "",
  vehicleModel: "",
  dailyRateEur: "",
  notes: "",
};

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
    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; rates?: PricingRate[] }>)
      .then((d) => { if (d.ok && d.rates) setRates(d.rates); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
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
        const existing = prev.findIndex((r) => r.id === data.rate!.id);
        if (existing >= 0) return prev.map((r, i) => i === existing ? data.rate! : r);
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
      setRates((prev) => prev.map((r) => r.id === editingId ? data.rate! : r));
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/" className="nav-button-secondary text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Tableau des prix</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/backoffice" className="nav-button-secondary text-sm">Backoffice</Link>
          <button type="button" className="nav-button-secondary text-sm" onClick={() => void handleLogout()} disabled={loggingOut}>
            {loggingOut ? "…" : "Déconnexion"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            {(["", "CITRON_LOCATION", "FLEXIRENT"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={agencyFilter === v ? "nav-button text-sm" : "nav-button-secondary text-sm"}
                onClick={() => setAgencyFilter(v)}
              >
                {v === "" ? "Toutes" : agencyLabel[v]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="nav-button text-sm"
            onClick={() => { setShowForm(true); setForm(emptyForm); setFormError(null); }}
          >
            + Ajouter un tarif
          </button>
        </div>

        {showForm && (
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold">Nouveau tarif</h2>
            <RateFormFields form={form} onChange={setForm} />
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex gap-2">
              <button type="button" className="nav-button flex-1" onClick={() => void handleCreate()} disabled={formLoading}>
                {formLoading ? "Enregistrement…" : "Ajouter"}
              </button>
              <button type="button" className="nav-button-secondary flex-1" onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted">Aucun tarif configuré.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">{filtered.length} tarif{filtered.length > 1 ? "s" : ""}</p>
            {filtered.map((r) => (
              <div key={r.id} className="card p-4">
                {editingId === r.id ? (
                  <div className="space-y-3">
                    <RateFormFields form={editForm} onChange={setEditForm} hideAgency />
                    {editError && <p className="text-sm text-red-500">{editError}</p>}
                    <div className="flex gap-2">
                      <button type="button" className="nav-button flex-1" onClick={() => void handleSaveEdit()} disabled={editLoading}>
                        {editLoading ? "…" : "Enregistrer"}
                      </button>
                      <button type="button" className="nav-button-secondary flex-1" onClick={() => setEditingId(null)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {r.vehicleModel}
                        <span className="ml-2 chip text-xs">{agencyLabel[r.agencyBrand]}</span>
                      </p>
                      <p className="text-lg font-semibold mt-0.5">{centsToEur(r.dailyRate)} € <span className="text-sm font-normal text-muted">/ jour</span></p>
                      {r.notes && <p className="text-sm text-muted">{r.notes}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" className="vehicle-toggle text-sm cursor-pointer" onClick={() => startEdit(r)}>Modifier</button>
                      {confirmDeleteId === r.id ? (
                        <div className="flex gap-2">
                          <button type="button" className="nav-button-danger text-sm cursor-pointer" onClick={() => void handleDelete(r.id)} disabled={deletingId === r.id}>
                            {deletingId === r.id ? "…" : "Confirmer"}
                          </button>
                          <button type="button" className="vehicle-toggle text-sm cursor-pointer" onClick={() => setConfirmDeleteId(null)}>Annuler</button>
                        </div>
                      ) : (
                        <button type="button" className="nav-button-danger text-sm cursor-pointer" onClick={() => setConfirmDeleteId(r.id)}>Supprimer</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RateFormFields({
  form,
  onChange,
  hideAgency = false,
}: {
  form: RateForm;
  onChange: (f: RateForm) => void;
  hideAgency?: boolean;
}) {
  const set = (key: keyof RateForm, value: string) => onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {!hideAgency && (
        <select className="input sm:col-span-2" value={form.agencyBrand} onChange={(e) => set("agencyBrand", e.target.value)}>
          <option value="">Agence *</option>
          <option value="CITRON_LOCATION">Citron Location</option>
          <option value="FLEXIRENT">Flexirent</option>
        </select>
      )}
      <input type="text" placeholder="Modèle véhicule *" className="input" value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} />
      <div className="relative">
        <input
          type="text"
          placeholder="Tarif / jour *"
          className="input pr-8"
          value={form.dailyRateEur}
          onChange={(e) => set("dailyRateEur", e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">€</span>
      </div>
      <input type="text" placeholder="Note (optionnel)" className="input sm:col-span-2" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
    </div>
  );
}
