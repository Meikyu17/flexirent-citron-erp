"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AgencyBrand = "CITRON_LOCATION" | "FLEXIRENT";
type CustomerType = "INDIVIDUAL" | "PROFESSIONAL";

type Customer = {
  id: string;
  type: CustomerType;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  agencyBrand: AgencyBrand | null;
  licenseAgeDays: number | null;
  reservationCount: number;
  createdAt: string;
};

type CustomerForm = {
  type: CustomerType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  agencyBrand: AgencyBrand | "";
  licenseYears: string;
};

const emptyForm: CustomerForm = {
  type: "INDIVIDUAL",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  agencyBrand: "",
  licenseYears: "",
};

const agencyLabel: Record<AgencyBrand, string> = {
  CITRON_LOCATION: "Citron Location",
  FLEXIRENT: "Flexirent",
};

function licenseAgeDaysToYears(days: number | null): string {
  if (!days) return "";
  return String(Math.round(days / 365));
}

function licenseYearsToDays(years: string): number | null {
  const n = Number.parseInt(years, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n * 365;
}

export default function ClientsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomerForm>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadCustomers = async (q = "") => {
    setLoading(true);
    try {
      const url = q ? `/api/clients?q=${encodeURIComponent(q)}` : "/api/clients";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; customers?: Customer[] };
      if (data.ok && data.customers) setCustomers(data.customers);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCustomers(); }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => void loadCustomers(value), 300);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  };

  const handleCreate = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Prénom et nom requis.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          agencyBrand: form.agencyBrand || null,
          licenseAgeDays: licenseYearsToDays(form.licenseYears),
        }),
      });
      const data = (await res.json()) as { ok: boolean; customer?: Customer; error?: string };
      if (!res.ok || !data.ok || !data.customer) throw new Error(data.error ?? "Erreur");
      setCustomers((prev) => [data.customer!, ...prev]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setFormLoading(false);
    }
  };

  const startEdit = (c: Customer) => {
    setEditingId(c.id);
    setEditError(null);
    setEditForm({
      type: c.type,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      agencyBrand: c.agencyBrand ?? "",
      licenseYears: licenseAgeDaysToYears(c.licenseAgeDays),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError("Prénom et nom requis.");
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/clients/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editForm.type,
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          address: editForm.address.trim() || undefined,
          agencyBrand: editForm.agencyBrand || null,
          licenseAgeDays: licenseYearsToDays(editForm.licenseYears),
        }),
      });
      const data = (await res.json()) as { ok: boolean; customer?: Customer; error?: string };
      if (!res.ok || !data.ok || !data.customer) throw new Error(data.error ?? "Erreur");
      setCustomers((prev) => prev.map((c) => (c.id === editingId ? data.customer! : c)));
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
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur");
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
    } catch {
      // silencieux
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="dashboard-shell min-h-screen px-3 py-4" style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}>
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Citron ERP</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Carnet clients</h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Link href="/backoffice" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Backoffice</Link>
            <Link href="/pricing" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Tarifs</Link>
            <Link href="/" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>Dashboard</Link>
            <button type="button" className="nav-button-danger cursor-pointer" onClick={() => void handleLogout()} disabled={loggingOut}>
              {loggingOut ? "…" : "Déconnexion"}
            </button>
          </div>
        </header>

        {/* Search + add */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Rechercher un client…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setForm(emptyForm); setFormError(null); }}
            style={{ ...primaryButtonStyle, width: "auto", padding: "0.6rem 1.2rem", whiteSpace: "nowrap" }}
          >
            {showForm ? "Annuler" : "+ Nouveau client"}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <section className="card p-4 flex flex-col gap-4">
            <h2 className="text-base font-semibold">Nouveau client</h2>
            <CustomerFormFields form={form} onChange={setForm} />
            {formError && <p className="text-xs" style={{ color: "var(--danger)" }}>{formError}</p>}
            <button type="button" disabled={formLoading} onClick={() => void handleCreate()} style={primaryButtonStyle}>
              {formLoading ? "Enregistrement…" : "Créer le client"}
            </button>
          </section>
        )}

        {/* List */}
        {loading ? (
          <p className="text-center text-muted py-8">Chargement…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>Aucun client trouvé.</p>
        ) : (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">{customers.length} client{customers.length > 1 ? "s" : ""}</p>
            {customers.map((c) => (
              <div key={c.id} className="card p-4 flex flex-col gap-3">
                {editingId === c.id ? (
                  <>
                    <CustomerFormFields form={editForm} onChange={setEditForm} />
                    {editError && <p className="text-xs" style={{ color: "var(--danger)" }}>{editError}</p>}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" className="vehicle-toggle cursor-pointer flex-1" onClick={() => setEditingId(null)}>Annuler</button>
                      <button type="button" disabled={editLoading} onClick={() => void handleSaveEdit()} style={{ ...primaryButtonStyle, flex: 1 }}>
                        {editLoading ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-start">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold">{c.firstName} {c.lastName}</p>
                          <span className="chip" style={{ fontSize: "0.72rem" }}>{c.type === "PROFESSIONAL" ? "Pro" : "Particulier"}</span>
                          {c.agencyBrand && <span className="chip" style={{ fontSize: "0.72rem" }}>{agencyLabel[c.agencyBrand]}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--muted)" }}>
                          {c.phone && <span>{c.phone}</span>}
                          {c.email && <span>{c.email}</span>}
                          {c.address && <span>{c.address}</span>}
                          <span>{c.reservationCount} résa{c.licenseAgeDays ? ` · Permis ${Math.round(c.licenseAgeDays / 365)} an${Math.round(c.licenseAgeDays / 365) > 1 ? "s" : ""}` : ""}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button type="button" className="vehicle-toggle cursor-pointer" onClick={() => startEdit(c)}>Modifier</button>
                        {confirmDeleteId === c.id ? (
                          <>
                            <button type="button" className="nav-button-danger cursor-pointer" onClick={() => void handleDelete(c.id)} disabled={deletingId === c.id}>
                              {deletingId === c.id ? "…" : "Confirmer"}
                            </button>
                            <button type="button" className="vehicle-toggle cursor-pointer" onClick={() => setConfirmDeleteId(null)}>✕</button>
                          </>
                        ) : (
                          <button type="button" className="nav-button-danger cursor-pointer" onClick={() => setConfirmDeleteId(c.id)}>Supprimer</button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function CustomerFormFields({ form, onChange }: { form: CustomerForm; onChange: (f: CustomerForm) => void }) {
  const set = (key: keyof CustomerForm, value: string) => onChange({ ...form, [key]: value });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Type</label>
        <div className="flex gap-2">
          <button type="button" className={`vehicle-toggle cursor-pointer flex-1 ${form.type === "INDIVIDUAL" ? "vehicle-toggle-active" : ""}`} onClick={() => set("type", "INDIVIDUAL")}>Particulier</button>
          <button type="button" className={`vehicle-toggle cursor-pointer flex-1 ${form.type === "PROFESSIONAL" ? "vehicle-toggle-active" : ""}`} onClick={() => set("type", "PROFESSIONAL")}>Professionnel</button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Prénom *</label>
          <input type="text" placeholder="Prénom" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Nom *</label>
          <input type="text" placeholder="Nom" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Téléphone</label>
          <input type="tel" placeholder="06 00 00 00 00" value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Email</label>
          <input type="email" placeholder="email@exemple.fr" value={form.email} onChange={(e) => set("email", e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Adresse</label>
        <input type="text" placeholder="12 Rue de la Paix, Toulouse" value={form.address} onChange={(e) => set("address", e.target.value)} style={inputStyle} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Agence</label>
          <div className="flex gap-2">
            <button type="button" className={`vehicle-toggle cursor-pointer flex-1 ${form.agencyBrand === "" ? "vehicle-toggle-active" : ""}`} onClick={() => set("agencyBrand", "")}>Toutes</button>
            <button type="button" className={`vehicle-toggle cursor-pointer flex-1 ${form.agencyBrand === "CITRON_LOCATION" ? "vehicle-toggle-active" : ""}`} onClick={() => set("agencyBrand", "CITRON_LOCATION")}>Citron</button>
            <button type="button" className={`vehicle-toggle cursor-pointer flex-1 ${form.agencyBrand === "FLEXIRENT" ? "vehicle-toggle-active" : ""}`} onClick={() => set("agencyBrand", "FLEXIRENT")}>Flexi</button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Ancienneté permis (années)</label>
          <input type="number" placeholder="ex : 3" min="0" value={form.licenseYears} onChange={(e) => set("licenseYears", e.target.value)} style={inputStyle} />
        </div>
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
