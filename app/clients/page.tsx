"use client";

import { useEffect, useState, useRef } from "react";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href="/" className="nav-button-secondary text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Carnet clients</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/backoffice" className="nav-button-secondary text-sm">Backoffice</Link>
          <button
            type="button"
            className="nav-button-secondary text-sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? "…" : "Déconnexion"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <input
            type="search"
            placeholder="Rechercher un client…"
            className="input flex-1 min-w-[200px]"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <button
            type="button"
            className="nav-button text-sm"
            onClick={() => { setShowForm(true); setForm(emptyForm); setFormError(null); }}
          >
            + Nouveau client
          </button>
        </div>

        {showForm && (
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold">Nouveau client</h2>
            <CustomerFormFields form={form} onChange={setForm} />
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex gap-2">
              <button type="button" className="nav-button flex-1" onClick={() => void handleCreate()} disabled={formLoading}>
                {formLoading ? "Enregistrement…" : "Créer"}
              </button>
              <button type="button" className="nav-button-secondary flex-1" onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted">Chargement…</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-muted">Aucun client trouvé.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">{customers.length} client{customers.length > 1 ? "s" : ""}</p>
            {customers.map((c) => (
              <div key={c.id} className="card p-4">
                {editingId === c.id ? (
                  <div className="space-y-3">
                    <CustomerFormFields form={editForm} onChange={setEditForm} />
                    {editError && <p className="text-sm text-red-500">{editError}</p>}
                    <div className="flex gap-2">
                      <button type="button" className="nav-button flex-1" onClick={() => void handleSaveEdit()} disabled={editLoading}>
                        {editLoading ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button type="button" className="nav-button-secondary flex-1" onClick={() => setEditingId(null)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {c.firstName} {c.lastName}
                        <span className="ml-2 chip text-xs">{c.type === "PROFESSIONAL" ? "Pro" : "Particulier"}</span>
                        {c.agencyBrand && <span className="ml-1 chip text-xs">{agencyLabel[c.agencyBrand]}</span>}
                      </p>
                      {c.phone && <p className="text-sm text-muted">{c.phone}</p>}
                      {c.email && <p className="text-sm text-muted">{c.email}</p>}
                      {c.address && <p className="text-sm text-muted">{c.address}</p>}
                      <p className="text-xs text-muted">
                        {c.reservationCount} résa
                        {c.licenseAgeDays ? ` · Permis ${Math.round(c.licenseAgeDays / 365)} an${Math.round(c.licenseAgeDays / 365) > 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" className="vehicle-toggle text-sm cursor-pointer" onClick={() => startEdit(c)}>
                        Modifier
                      </button>
                      {confirmDeleteId === c.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="nav-button-danger text-sm cursor-pointer"
                            onClick={() => void handleDelete(c.id)}
                            disabled={deletingId === c.id}
                          >
                            {deletingId === c.id ? "…" : "Confirmer"}
                          </button>
                          <button type="button" className="vehicle-toggle text-sm cursor-pointer" onClick={() => setConfirmDeleteId(null)}>
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="nav-button-danger text-sm cursor-pointer" onClick={() => setConfirmDeleteId(c.id)}>
                          Supprimer
                        </button>
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

function CustomerFormFields({
  form,
  onChange,
}: {
  form: CustomerForm;
  onChange: (f: CustomerForm) => void;
}) {
  const set = (key: keyof CustomerForm, value: string) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          className={form.type === "INDIVIDUAL" ? "nav-button flex-1" : "nav-button-secondary flex-1"}
          onClick={() => set("type", "INDIVIDUAL")}
        >
          Particulier
        </button>
        <button
          type="button"
          className={form.type === "PROFESSIONAL" ? "nav-button flex-1" : "nav-button-secondary flex-1"}
          onClick={() => set("type", "PROFESSIONAL")}
        >
          Professionnel
        </button>
      </div>
      <input
        type="text"
        placeholder="Prénom *"
        className="input"
        value={form.firstName}
        onChange={(e) => set("firstName", e.target.value)}
      />
      <input
        type="text"
        placeholder="Nom *"
        className="input"
        value={form.lastName}
        onChange={(e) => set("lastName", e.target.value)}
      />
      <input
        type="tel"
        placeholder="Téléphone"
        className="input"
        value={form.phone}
        onChange={(e) => set("phone", e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        className="input"
        value={form.email}
        onChange={(e) => set("email", e.target.value)}
      />
      <input
        type="text"
        placeholder="Adresse"
        className="input sm:col-span-2"
        value={form.address}
        onChange={(e) => set("address", e.target.value)}
      />
      <select
        className="input"
        value={form.agencyBrand}
        onChange={(e) => set("agencyBrand", e.target.value)}
      >
        <option value="">Agence (optionnel)</option>
        <option value="CITRON_LOCATION">Citron Location</option>
        <option value="FLEXIRENT">Flexirent</option>
      </select>
      <input
        type="number"
        placeholder="Ancienneté permis (années)"
        className="input"
        min="0"
        value={form.licenseYears}
        onChange={(e) => set("licenseYears", e.target.value)}
      />
    </div>
  );
}
