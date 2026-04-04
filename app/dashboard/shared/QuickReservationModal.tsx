"use client";

import { useEffect, useRef, useState } from "react";

type AgencyBrand = "CITRON_LOCATION" | "FLEXIRENT";
type RentalPlatform = "GETAROUND" | "FLEETEE" | "TURO" | "DIRECT";

type Vehicle = { id: string; model: string; plateNumber: string };
type SavedAddress = { id: string; label: string };
type CustomerSuggestion = { id: string; firstName: string; lastName: string; phone: string | null };

type LogForm = {
  vehicleId: string;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  agencyBrand: AgencyBrand;
  platform: RentalPlatform | null;
  pickupAddress: string;
  returnAddress: string;
  notes: string;
};

const emptyForm: LogForm = {
  vehicleId: "",
  customerName: "",
  customerPhone: "",
  startsAt: "",
  endsAt: "",
  agencyBrand: "CITRON_LOCATION",
  platform: null,
  pickupAddress: "",
  returnAddress: "",
  notes: "",
};

const BRAND_OPTIONS: { value: AgencyBrand; label: string }[] = [
  { value: "CITRON_LOCATION", label: "Citron Location" },
  { value: "FLEXIRENT", label: "Flexirent" },
];

const PLATFORM_OPTIONS: { value: RentalPlatform; label: string }[] = [
  { value: "GETAROUND", label: "Getaround" },
  { value: "FLEETEE", label: "Fleetee" },
  { value: "TURO", label: "Turo" },
  { value: "DIRECT", label: "Direct" },
];

export function QuickReservationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [form, setForm] = useState<LogForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestion[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const customerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/backoffice/vehicles", { cache: "no-store" }).then((r) => r.json() as Promise<{ ok: boolean; vehicles?: Vehicle[] }>),
      fetch("/api/backoffice/addresses", { cache: "no-store" }).then((r) => r.json() as Promise<{ ok: boolean; addresses?: SavedAddress[] }>),
    ]).then(([vd, ad]) => {
      if (vd.ok && vd.vehicles) setVehicles(vd.vehicles);
      if (ad.ok && ad.addresses) setSavedAddresses(ad.addresses);
    }).catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDeleteAddress = async (id: string) => {
    setDeletingAddressId(id);
    try {
      await fetch(`/api/backoffice/addresses/${id}`, { method: "DELETE" });
      setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silencieux
    } finally {
      setDeletingAddressId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId) { setError("Sélectionner un véhicule."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          status: "RESERVED",
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          customerId: selectedCustomerId ?? null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur enregistrement");
      setSuccess(true);
      setSelectedCustomerId(null);
      setCustomerSuggestions([]);
      // Refresh addresses
      fetch("/api/backoffice/addresses", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ ok: boolean; addresses?: SavedAddress[] }>)
        .then((d) => { if (d.ok && d.addresses) setSavedAddresses(d.addresses); })
        .catch(() => {});
      onSuccess();
      setTimeout(() => { setSuccess(false); setForm(emptyForm); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-3"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-lg flex flex-col gap-4 p-5 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Ajouter une réservation</h2>
          <button type="button" onClick={onClose} className="vehicle-toggle cursor-pointer" style={{ padding: "0.3rem 0.7rem", fontSize: "1rem" }}>✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {/* Véhicule */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Véhicule *</label>
            <select value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))} style={inputStyle} required>
              <option value="">— Sélectionner —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.model} · {v.plateNumber}</option>
              ))}
            </select>
          </div>

          {/* Client */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Client
              {selectedCustomerId && <span className="ml-2 chip" style={{ fontSize: "0.72rem" }}>Lié au carnet</span>}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-col gap-1" style={{ flex: 1 }}>
                <input
                  type="text"
                  placeholder="Nom du client"
                  value={form.customerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => ({ ...f, customerName: val }));
                    setSelectedCustomerId(null);
                    if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);
                    if (val.trim().length >= 2) {
                      customerSearchTimeout.current = setTimeout(() => {
                        fetch(`/api/clients?q=${encodeURIComponent(val.trim())}`, { cache: "no-store" })
                          .then((r) => r.json() as Promise<{ ok: boolean; customers?: CustomerSuggestion[] }>)
                          .then((d) => { if (d.ok && d.customers) setCustomerSuggestions(d.customers.slice(0, 5)); })
                          .catch(() => {});
                      }, 250);
                    } else {
                      setCustomerSuggestions([]);
                    }
                  }}
                  style={inputStyle}
                />
                {customerSuggestions.length > 0 && (
                  <div className="card p-1 flex flex-col gap-0.5" style={{ zIndex: 10 }}>
                    {customerSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="vehicle-toggle cursor-pointer text-left"
                        style={{ fontSize: "0.85rem", justifyContent: "flex-start" }}
                        onClick={() => {
                          setForm((f) => ({ ...f, customerName: `${s.firstName} ${s.lastName}`, customerPhone: s.phone ?? f.customerPhone }));
                          setSelectedCustomerId(s.id);
                          setCustomerSuggestions([]);
                        }}
                      >
                        {s.firstName} {s.lastName}
                        {s.phone && <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>{s.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input type="tel" placeholder="Téléphone" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Début</label>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Fin</label>
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Adresses */}
          <div className="flex flex-col gap-3">
            {(["pickup", "return"] as const).map((kind) => {
              const field = kind === "pickup" ? "pickupAddress" : "returnAddress";
              const value = form[field as "pickupAddress" | "returnAddress"];
              const label = kind === "pickup" ? "Adresse remise de clés" : "Adresse récupération véhicule";
              const placeholder = kind === "pickup" ? "ex : 12 Rue de la Paix, Toulouse" : "ex : Parking Jean Jaurès, Toulouse";
              const filtered = savedAddresses.filter((a) =>
                value.trim().length === 0 || a.label.toLowerCase().includes(value.toLowerCase())
              );
              return (
                <div key={kind} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>{label}</label>
                  <input type="text" list={`qr-addr-list-${kind}`} placeholder={placeholder} value={value} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} style={inputStyle} />
                  <datalist id={`qr-addr-list-${kind}`}>{savedAddresses.map((a) => <option key={a.id} value={a.label} />)}</datalist>
                  {savedAddresses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {filtered.slice(0, 6).map((addr) => (
                        <div key={addr.id} className="flex items-center gap-0" style={{ border: "1px solid var(--border)", borderRadius: "9999px", overflow: "hidden" }}>
                          <button type="button" onClick={() => setForm((f) => ({ ...f, [field]: addr.label }))} style={{ fontSize: "0.72rem", padding: "2px 8px", background: value === addr.label ? "var(--accent)" : "var(--card-secondary)", color: value === addr.label ? "white" : "var(--foreground)", border: "none", cursor: "pointer" }}>
                            {addr.label}
                          </button>
                          <button type="button" disabled={deletingAddressId === addr.id} onClick={() => void handleDeleteAddress(addr.id)} style={{ fontSize: "0.65rem", padding: "2px 6px", background: "transparent", color: "var(--muted)", border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer" }} title="Supprimer">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Agence */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Agence</label>
            <div className="flex gap-2">
              {BRAND_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className={`vehicle-toggle cursor-pointer flex-1 ${form.agencyBrand === opt.value ? "vehicle-toggle-active" : ""}`} onClick={() => setForm((f) => ({ ...f, agencyBrand: opt.value }))}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plateforme */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Plateforme</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" className={`vehicle-toggle cursor-pointer ${form.platform === opt.value ? "vehicle-toggle-active" : ""}`} onClick={() => setForm((f) => ({ ...f, platform: f.platform === opt.value ? null : opt.value }))}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>Note (optionnel)</label>
            <textarea placeholder="Remarques…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
          {success && <p className="text-xs font-medium" style={{ color: "var(--success)" }}>Réservation enregistrée.</p>}

          <button type="submit" disabled={loading} style={primaryButtonStyle}>
            {loading ? "Enregistrement…" : "Enregistrer la réservation"}
          </button>
        </form>
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
};
