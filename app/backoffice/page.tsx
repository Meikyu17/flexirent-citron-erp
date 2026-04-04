"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type OperationalStatus = "AVAILABLE" | "RESERVED" | "IN_RENT" | "OUT_OF_SERVICE";
type AgencyBrand = "CITRON_LOCATION" | "FLEXIRENT";
type RentalPlatform = "GETAROUND" | "FLEETEE" | "TURO" | "DIRECT";

type BackofficeVehicle = {
  id: string;
  model: string;
  plateNumber: string;
  parkingArea: string;
  parkingSpot: string;
  operationalStatus: OperationalStatus;
  isCleaned: boolean;
  agency: { id: string; code: string; name: string; brand: AgencyBrand; brandLabel: string };
};

type BackofficeAgency = {
  id: string;
  code: string;
  name: string;
  brand: AgencyBrand;
  brandLabel: string;
};

type StatusLog = {
  id: string;
  vehicleId: string;
  vehicle: { model: string; plateNumber: string };
  status: OperationalStatus;
  statusLabel: string;
  isReservation: boolean;
  customerName: string | null;
  customerPhone: string | null;
  startsAt: string | null;
  endsAt: string | null;
  agencyBrand: AgencyBrand;
  agencyBrandLabel: string;
  platform: RentalPlatform | null;
  notes: string | null;
  createdAt: string;
};

type VehicleDraft = {
  model: string;
  parkingArea: string;
  parkingSpot: string;
  isOutOfService: boolean;
  isCleaned: boolean;
};

type LogForm = {
  vehicleId: string;
  status: OperationalStatus;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  agencyBrand: AgencyBrand;
  platform: RentalPlatform | null;
  notes: string;
};

type AddVehicleForm = {
  model: string;
  plateNumber: string;
  parkingArea: string;
  parkingSpot: string;
  agencyId: string;
};

type AddAgencyForm = {
  name: string;
  code: string;
  city: string;
  brand: AgencyBrand;
};

type EditReservationForm = {
  vehicleId: string;
  startsAt: string;
  endsAt: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string | null;
  isAvailableForDispatch: boolean;
  updatedAt: string;
};

const STATUS_OPTIONS: { value: OperationalStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "RESERVED", label: "Réservé" },
  { value: "IN_RENT", label: "En location" },
  { value: "OUT_OF_SERVICE", label: "Hors service" },
];

const BRAND_OPTIONS: { value: AgencyBrand; label: string }[] = [
  { value: "CITRON_LOCATION", label: "Citron location" },
  { value: "FLEXIRENT", label: "Flexirent" },
];

const PLATFORM_OPTIONS: { value: RentalPlatform; label: string }[] = [
  { value: "GETAROUND", label: "Getaround" },
  { value: "FLEETEE", label: "Fleetee" },
  { value: "TURO", label: "Turo" },
  { value: "DIRECT", label: "Direct" },
];

function statusColor(status: OperationalStatus): string {
  if (status === "AVAILABLE") return "var(--success)";
  if (status === "RESERVED") return "var(--accent)";
  if (status === "IN_RENT") return "var(--warning)";
  return "var(--danger)";
}

function computeReservationStatusFromInputs(
  startsAt: string,
  endsAt: string,
): OperationalStatus {
  if (!startsAt) return "AVAILABLE";
  const now = new Date();
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (Number.isNaN(start.getTime())) return "AVAILABLE";
  if (start > now) return "RESERVED";
  if (!end) return "IN_RENT";
  if (Number.isNaN(end.getTime())) return "AVAILABLE";
  return end >= now ? "IN_RENT" : "RESERVED";
}

function formatPlateNumber(raw: string): string {
  // Keep only letters and digits, uppercase
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Format: AA-123-AA (SIV format)
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 7)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function isDraftDirty(vehicle: BackofficeVehicle, draft: VehicleDraft): boolean {
  return (
    draft.model !== vehicle.model ||
    draft.parkingArea !== vehicle.parkingArea ||
    draft.parkingSpot !== vehicle.parkingSpot ||
    draft.isOutOfService !== (vehicle.operationalStatus === "OUT_OF_SERVICE") ||
    draft.isCleaned !== vehicle.isCleaned
  );
}

export default function BackofficePage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<BackofficeVehicle[]>([]);
  const [agencies, setAgencies] = useState<BackofficeAgency[]>([]);
  const [logs, setLogs] = useState<StatusLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, VehicleDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isFleetCollapsed, setIsFleetCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [addForm, setAddForm] = useState<AddVehicleForm>({
    model: "",
    plateNumber: "",
    parkingArea: "",
    parkingSpot: "",
    agencyId: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [showAddAgency, setShowAddAgency] = useState(false);
  const [addAgencyForm, setAddAgencyForm] = useState<AddAgencyForm>({
    name: "",
    code: "",
    city: "",
    brand: "CITRON_LOCATION",
  });
  const [addAgencyLoading, setAddAgencyLoading] = useState(false);
  const [addAgencyError, setAddAgencyError] = useState<string | null>(null);

  const [logForm, setLogForm] = useState<LogForm>({
    vehicleId: "",
    status: "AVAILABLE",
    customerName: "",
    customerPhone: "",
    startsAt: "",
    endsAt: "",
    agencyBrand: "CITRON_LOCATION",
    platform: null,
    notes: "",
  });
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [logDeleteError, setLogDeleteError] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editReservationForm, setEditReservationForm] = useState<EditReservationForm>({
    vehicleId: "",
    startsAt: "",
    endsAt: "",
  });
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [editLogError, setEditLogError] = useState<string | null>(null);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamCollapsed, setIsTeamCollapsed] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ name: "", email: "" });
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, { name: string; email: string }>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Theme sync
  useEffect(() => {
    const stored = localStorage.getItem("citron-theme") as "light" | "dark" | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const t = stored ?? preferred;
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // Load all data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [vRes, aRes, lRes, tRes] = await Promise.all([
          fetch("/api/backoffice/vehicles", { cache: "no-store" }),
          fetch("/api/backoffice/agencies", { cache: "no-store" }),
          fetch("/api/backoffice/logs", { cache: "no-store" }),
          fetch("/api/backoffice/team", { cache: "no-store" }),
        ]);

        if (vRes.status === 401 || aRes.status === 401) {
          router.push("/login");
          return;
        }

        const [vData, aData, lData, tData] = await Promise.all([
          vRes.json() as Promise<{ ok: boolean; vehicles?: BackofficeVehicle[]; error?: string }>,
          aRes.json() as Promise<{ ok: boolean; agencies?: BackofficeAgency[] }>,
          lRes.json() as Promise<{ ok: boolean; logs?: StatusLog[] }>,
          tRes.json() as Promise<{ ok: boolean; members?: TeamMember[] }>,
        ]);

        if (cancelled) return;

        if (!vData.ok || !vData.vehicles) {
          throw new Error(vData.error ?? "Impossible de charger les vehicules");
        }
        const vehicleList = vData.vehicles;
        setVehicles(vehicleList);
        setDrafts(
          Object.fromEntries(
            vehicleList.map((v) => [
              v.id,
              {
                model: v.model,
                parkingArea: v.parkingArea,
                parkingSpot: v.parkingSpot,
                isOutOfService: v.operationalStatus === "OUT_OF_SERVICE",
                isCleaned: v.isCleaned,
              },
            ]),
          ),
        );

        if (aData.ok && aData.agencies) {
          setAgencies(aData.agencies);
          if (aData.agencies.length > 0) {
            setAddForm((prev) => ({ ...prev, agencyId: aData.agencies![0].id }));
          }
        }
        if (lData.ok && lData.logs) setLogs(lData.logs);
        if (tData.ok && tData.members) {
          setTeamMembers(tData.members);
          setMemberDrafts(Object.fromEntries(tData.members.map((m) => [m.id, { name: m.name, email: m.email ?? "" }])));
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (logForm.status === "OUT_OF_SERVICE") return;
    const selectedVehicle = vehicles.find((v) => v.id === logForm.vehicleId);
    const computedFromDates = computeReservationStatusFromInputs(logForm.startsAt, logForm.endsAt);
    const computed =
      selectedVehicle?.operationalStatus === "IN_RENT"
        ? "IN_RENT"
        : computedFromDates;
    if (computed !== logForm.status) {
      setLogForm((prev) => ({ ...prev, status: computed }));
    }
  }, [logForm.status, logForm.startsAt, logForm.endsAt, logForm.vehicleId, vehicles]);

  const syncVehiclesFromApi = async () => {
    const res = await fetch("/api/backoffice/vehicles", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = (await res.json()) as { ok: boolean; vehicles?: BackofficeVehicle[]; error?: string };
    if (!res.ok || !data.ok || !data.vehicles) {
      throw new Error(data.error ?? "Impossible de recharger les vehicules");
    }
    const vehicleList = data.vehicles;
    setVehicles(vehicleList);
    setDrafts(
      Object.fromEntries(
        vehicleList.map((v) => [
          v.id,
          {
            model: v.model,
            parkingArea: v.parkingArea,
            parkingSpot: v.parkingSpot,
            isOutOfService: v.operationalStatus === "OUT_OF_SERVICE",
            isCleaned: v.isCleaned,
          },
        ]),
      ),
    );
  };

  const handleDraftChange = (id: string, patch: Partial<VehicleDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSaveVehicle = async (vehicleId: string) => {
    const draft = drafts[vehicleId];
    if (!draft) return;
    setSavingId(vehicleId);
    setSaveError(null);
    try {
      const res = await fetch(`/api/backoffice/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          model: draft.model.trim(),
          operationalStatus: draft.isOutOfService ? "OUT_OF_SERVICE" : "AVAILABLE",
        }),
      });
      const data = (await res.json()) as { ok: boolean; vehicle?: BackofficeVehicle; error?: string };
      if (!res.ok || !data.ok || !data.vehicle) throw new Error(data.error ?? "Erreur de sauvegarde");
      const updated = data.vehicle;
      setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? updated : v)));
      setDrafts((prev) => ({
        ...prev,
        [vehicleId]: {
          model: updated.model,
          parkingArea: updated.parkingArea,
          parkingSpot: updated.parkingSpot,
          isOutOfService: updated.operationalStatus === "OUT_OF_SERVICE",
          isCleaned: updated.isCleaned,
        },
      }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    setDeletingId(vehicleId);
    setSaveError(null);
    try {
      const res = await fetch(`/api/backoffice/vehicles/${vehicleId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur de suppression");
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      setDrafts((prev) => { const next = { ...prev }; delete next[vehicleId]; return next; });
      setConfirmDeleteId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur de suppression");
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.model.trim() || !addForm.plateNumber.trim() || !addForm.agencyId) {
      setAddError("Modele, plaque et agence sont requis.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/backoffice/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = (await res.json()) as { ok: boolean; vehicle?: BackofficeVehicle; error?: string };
      if (!res.ok || !data.ok || !data.vehicle) throw new Error(data.error ?? "Erreur creation");
      const v = data.vehicle;
      setVehicles((prev) => [...prev, v]);
      setDrafts((prev) => ({
        ...prev,
        [v.id]: {
          model: v.model,
          parkingArea: v.parkingArea,
          parkingSpot: v.parkingSpot,
          isOutOfService: v.operationalStatus === "OUT_OF_SERVICE",
          isCleaned: v.isCleaned,
        },
      }));
      setAddForm({ model: "", plateNumber: "", parkingArea: "", parkingSpot: "", agencyId: agencies[0]?.id ?? "" });
      setShowAddVehicle(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erreur creation");
    } finally {
      setAddLoading(false);
    }
  };

  const handleAddAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAgencyForm.name.trim() || !addAgencyForm.code.trim() || !addAgencyForm.city.trim()) {
      setAddAgencyError("Nom, code et ville sont requis.");
      return;
    }
    setAddAgencyLoading(true);
    setAddAgencyError(null);
    try {
      const res = await fetch("/api/backoffice/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addAgencyForm),
      });
      const data = (await res.json()) as { ok: boolean; agency?: BackofficeAgency; error?: string };
      if (!res.ok || !data.ok || !data.agency) throw new Error(data.error ?? "Erreur création agence");
      const newAgency = data.agency;
      setAgencies((prev) => [...prev, newAgency].sort((a, b) => a.name.localeCompare(b.name)));
      setAddForm((f) => ({ ...f, agencyId: newAgency.id }));
      setAddAgencyForm({ name: "", code: "", city: "", brand: "CITRON_LOCATION" });
      setShowAddAgency(false);
    } catch (err) {
      setAddAgencyError(err instanceof Error ? err.message : "Erreur création agence");
    } finally {
      setAddAgencyLoading(false);
    }
  };

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.vehicleId) {
      setLogError("Selectionnez un vehicule.");
      return;
    }
    if (!logForm.startsAt && logForm.endsAt) {
      setLogError("La date de début est requise pour une réservation.");
      return;
    }

    const selectedVehicle = vehicles.find((v) => v.id === logForm.vehicleId);
    const computedFromDates = computeReservationStatusFromInputs(logForm.startsAt, logForm.endsAt);
    const automaticStatus =
      selectedVehicle?.operationalStatus === "IN_RENT"
        ? "IN_RENT"
        : computedFromDates;
    const effectiveStatus =
      logForm.status === "OUT_OF_SERVICE" ? "OUT_OF_SERVICE" : automaticStatus;

    setLogLoading(true);
    setLogError(null);
    setLogSuccess(false);
    try {
      const payload = {
        ...logForm,
        status: effectiveStatus,
        startsAt: logForm.startsAt ? new Date(logForm.startsAt).toISOString() : null,
        endsAt: logForm.endsAt ? new Date(logForm.endsAt).toISOString() : null,
      };
      const res = await fetch("/api/backoffice/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; log?: StatusLog; error?: string };
      if (!res.ok || !data.ok || !data.log) throw new Error(data.error ?? "Erreur enregistrement");

      setLogs((prev) => [data.log!, ...prev.slice(0, 14)]);
      await syncVehiclesFromApi();
      setLogForm((prev) => ({
        ...prev,
        customerName: "",
        customerPhone: "",
        startsAt: "",
        endsAt: "",
        platform: null,
        notes: "",
      }));
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 3000);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Erreur enregistrement");
    } finally {
      setLogLoading(false);
    }
  };

  const handleDeleteReservationLog = async (logId: string) => {
    setDeletingLogId(logId);
    setLogDeleteError(null);
    try {
      const res = await fetch(`/api/backoffice/logs/${logId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Erreur de suppression");
      }
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      await syncVehiclesFromApi();
    } catch (err) {
      setLogDeleteError(err instanceof Error ? err.message : "Erreur de suppression");
    } finally {
      setDeletingLogId(null);
    }
  };

  const startEditingReservation = (log: StatusLog) => {
    setEditingLogId(log.id);
    setEditLogError(null);
    setEditReservationForm({
      vehicleId: log.vehicleId,
      startsAt: toDateTimeLocalValue(log.startsAt),
      endsAt: toDateTimeLocalValue(log.endsAt),
    });
  };

  const cancelEditingReservation = () => {
    setEditingLogId(null);
    setEditLoadingId(null);
    setEditLogError(null);
  };

  const handleSaveReservationEdit = async (logId: string) => {
    if (!editReservationForm.vehicleId) {
      setEditLogError("Selectionnez un vehicule.");
      return;
    }
    if (!editReservationForm.startsAt) {
      setEditLogError("La date de debut est requise.");
      return;
    }

    setEditLoadingId(logId);
    setEditLogError(null);
    try {
      const startsAtIso = new Date(editReservationForm.startsAt).toISOString();
      const endsAtIso = editReservationForm.endsAt
        ? new Date(editReservationForm.endsAt).toISOString()
        : null;

      const res = await fetch(`/api/backoffice/logs/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: editReservationForm.vehicleId,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
        }),
      });
      const data = (await res.json()) as { ok: boolean; log?: StatusLog; error?: string };
      if (!res.ok || !data.ok || !data.log) {
        throw new Error(data.error ?? "Erreur de modification");
      }

      setLogs((prev) => prev.map((log) => (log.id === logId ? data.log! : log)));
      await syncVehiclesFromApi();
      cancelEditingReservation();
    } catch (err) {
      setEditLogError(err instanceof Error ? err.message : "Erreur de modification");
    } finally {
      setEditLoadingId(null);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberForm.name.trim()) { setAddMemberError("Le nom est requis."); return; }
    setAddMemberLoading(true);
    setAddMemberError(null);
    try {
      const res = await fetch("/api/backoffice/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addMemberForm),
      });
      const data = (await res.json()) as { ok: boolean; member?: TeamMember; error?: string };
      if (!res.ok || !data.ok || !data.member) throw new Error(data.error ?? "Erreur création");
      setTeamMembers((prev) => [...prev, data.member!].sort((a, b) => a.name.localeCompare(b.name)));
      setMemberDrafts((prev) => ({ ...prev, [data.member!.id]: { name: data.member!.name, email: data.member!.email ?? "" } }));
      setAddMemberForm({ name: "", email: "" });
      setShowAddMember(false);
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleSaveMember = async (memberId: string) => {
    const draft = memberDrafts[memberId];
    if (!draft?.name.trim()) { setMemberSaveError("Le nom est requis."); return; }
    setSavingMemberId(memberId);
    setMemberSaveError(null);
    try {
      const res = await fetch(`/api/backoffice/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { ok: boolean; member?: TeamMember; error?: string };
      if (!res.ok || !data.ok || !data.member) throw new Error(data.error ?? "Erreur modification");
      setTeamMembers((prev) => prev.map((m) => m.id === memberId ? data.member! : m).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingMemberId(null);
    } catch (err) {
      setMemberSaveError(err instanceof Error ? err.message : "Erreur modification");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleToggleMemberAvailability = async (member: TeamMember) => {
    const next = !member.isAvailableForDispatch;
    setTeamMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, isAvailableForDispatch: next } : m));
    try {
      const draft = memberDrafts[member.id] ?? { name: member.name, email: member.email ?? "" };
      await fetch(`/api/backoffice/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, isAvailableForDispatch: next }),
      });
    } catch {
      setTeamMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, isAvailableForDispatch: !next } : m));
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setDeletingMemberId(memberId);
    setMemberSaveError(null);
    try {
      const res = await fetch(`/api/backoffice/team/${memberId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur suppression");
      setTeamMembers((prev) => prev.filter((m) => m.id !== memberId));
      setConfirmDeleteMemberId(null);
    } catch (err) {
      setMemberSaveError(err instanceof Error ? err.message : "Erreur suppression");
      setConfirmDeleteMemberId(null);
    } finally {
      setDeletingMemberId(null);
    }
  };

  const selectedLogVehicle = vehicles.find((v) => v.id === logForm.vehicleId);
  const automaticLogStatusFromDates = computeReservationStatusFromInputs(
    logForm.startsAt,
    logForm.endsAt,
  );
  const automaticLogStatus =
    selectedLogVehicle?.operationalStatus === "IN_RENT"
      ? "IN_RENT"
      : automaticLogStatusFromDates;
  const effectiveLogStatus =
    logForm.status === "OUT_OF_SERVICE" ? "OUT_OF_SERVICE" : automaticLogStatus;
  const effectiveLogStatusLabel =
    STATUS_OPTIONS.find((opt) => opt.value === effectiveLogStatus)?.label ??
    effectiveLogStatus;

  return (
    <div
      className="dashboard-shell min-h-screen px-3 py-4"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              Citron ERP
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Backoffice flotte
            </h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
            <Link href="/" className="vehicle-toggle cursor-pointer" style={{ textDecoration: "none" }}>
              Dashboard
            </Link>
          </div>
        </header>

        {loading && (
          <p className="text-center text-muted py-8">Chargement…</p>
        )}
        {error && (
          <div
            className="card p-4 text-sm"
            style={{ color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))" }}
          >
            {error}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Section 0 : Équipe ── */}
            <section className="flex flex-col gap-4" style={{ order: 1 }}>
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <h2 className="text-base font-semibold">Équipe</h2>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <button type="button" className="vehicle-toggle cursor-pointer" onClick={() => setIsTeamCollapsed((v) => !v)}>
                    {isTeamCollapsed ? "Déplier" : "Replier"}
                  </button>
                  <button
                    type="button"
                    className={`vehicle-toggle cursor-pointer ${showAddMember ? "vehicle-toggle-active" : ""}`}
                    onClick={() => { setShowAddMember((v) => !v); setAddMemberError(null); }}
                  >
                    {showAddMember ? "Annuler" : "+ Ajouter"}
                  </button>
                </div>
              </div>

              {!isTeamCollapsed && (
                <>
                  {showAddMember && (
                    <form onSubmit={handleAddMember} className="card p-4 flex flex-col gap-3">
                      <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>Nouveau membre</p>
                      <input
                        type="text"
                        placeholder="Prénom Nom (ex : Nathan Dupont)"
                        value={addMemberForm.name}
                        onChange={(e) => setAddMemberForm((f) => ({ ...f, name: e.target.value }))}
                        style={inputStyle}
                        required
                      />
                      <input
                        type="email"
                        placeholder="Email (optionnel)"
                        value={addMemberForm.email}
                        onChange={(e) => setAddMemberForm((f) => ({ ...f, email: e.target.value }))}
                        style={inputStyle}
                      />
                      {addMemberError && <p className="text-xs" style={{ color: "var(--danger)" }}>{addMemberError}</p>}
                      <button type="submit" disabled={addMemberLoading} style={primaryButtonStyle}>
                        {addMemberLoading ? "Création…" : "Créer le membre"}
                      </button>
                    </form>
                  )}

                  {memberSaveError && <p className="text-xs" style={{ color: "var(--danger)" }}>{memberSaveError}</p>}

                  {teamMembers.length === 0 && !showAddMember && (
                    <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>Aucun membre dans l&apos;équipe.</p>
                  )}

                  <div className="flex flex-col gap-2">
                    {teamMembers.map((member) => {
                      const isEditing = editingMemberId === member.id;
                      const draft = memberDrafts[member.id] ?? { name: member.name, email: member.email ?? "" };
                      return (
                        <div key={member.id} className="card p-4 flex flex-col gap-3">
                          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">{member.name}</p>
                                <span
                                  className="chip"
                                  style={{
                                    fontSize: "0.7rem",
                                    background: member.isAvailableForDispatch
                                      ? "color-mix(in srgb, var(--success) 15%, var(--card-secondary))"
                                      : "color-mix(in srgb, var(--muted) 15%, var(--card-secondary))",
                                    color: member.isAvailableForDispatch ? "var(--success)" : "var(--muted)",
                                    borderColor: "transparent",
                                  }}
                                >
                                  {member.isAvailableForDispatch ? "Dispatch actif" : "Dispatch inactif"}
                                </span>
                              </div>
                              {member.email && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{member.email}</p>}
                            </div>
                            <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:shrink-0">
                              <button
                                type="button"
                                className={`vehicle-toggle cursor-pointer flex-1 sm:flex-none ${member.isAvailableForDispatch ? "vehicle-toggle-active" : ""}`}
                                onClick={() => handleToggleMemberAvailability(member)}
                                title={member.isAvailableForDispatch ? "Désactiver du dispatch" : "Activer pour le dispatch"}
                              >
                                {member.isAvailableForDispatch ? "✓ Dispatch" : "Dispatch"}
                              </button>
                              <button
                                type="button"
                                className={`vehicle-toggle cursor-pointer flex-1 sm:flex-none ${isEditing ? "vehicle-toggle-active" : ""}`}
                                onClick={() => {
                                  setEditingMemberId(isEditing ? null : member.id);
                                  setMemberSaveError(null);
                                  if (!isEditing) setMemberDrafts((prev) => ({ ...prev, [member.id]: { name: member.name, email: member.email ?? "" } }));
                                }}
                              >
                                {isEditing ? "Annuler" : "Modifier"}
                              </button>
                              {confirmDeleteMemberId === member.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="nav-button-danger cursor-pointer flex-1 sm:flex-none"
                                    disabled={deletingMemberId === member.id}
                                    onClick={() => handleDeleteMember(member.id)}
                                  >
                                    {deletingMemberId === member.id ? "…" : "Confirmer"}
                                  </button>
                                  <button type="button" className="vehicle-toggle cursor-pointer sm:flex-none" onClick={() => setConfirmDeleteMemberId(null)}>✕</button>
                                </>
                              ) : (
                                <button type="button" className="nav-button-danger cursor-pointer flex-1 sm:flex-none" onClick={() => setConfirmDeleteMemberId(member.id)}>
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing && (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="Prénom Nom"
                                value={draft.name}
                                onChange={(e) => setMemberDrafts((prev) => ({ ...prev, [member.id]: { ...prev[member.id], name: e.target.value } }))}
                                style={inputStyle}
                              />
                              <input
                                type="email"
                                placeholder="Email (optionnel)"
                                value={draft.email}
                                onChange={(e) => setMemberDrafts((prev) => ({ ...prev, [member.id]: { ...prev[member.id], email: e.target.value } }))}
                                style={inputStyle}
                              />
                              <button
                                type="button"
                                disabled={savingMemberId === member.id}
                                onClick={() => handleSaveMember(member.id)}
                                style={primaryButtonStyle}
                              >
                                {savingMemberId === member.id ? "Enregistrement…" : "Enregistrer"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* ── Section 1 : Flotte ── */}
            <section className="flex flex-col gap-4" style={{ order: 2 }}>
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <h2 className="text-base font-semibold">Flotte de vehicules</h2>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    className="vehicle-toggle cursor-pointer"
                    onClick={() => setIsFleetCollapsed((value) => !value)}
                  >
                    {isFleetCollapsed ? "Déplier" : "Replier"}
                  </button>
                  <button
                    type="button"
                    className={`vehicle-toggle cursor-pointer ${showAddVehicle ? "vehicle-toggle-active" : ""}`}
                    onClick={() => { setShowAddVehicle((v) => !v); setAddError(null); }}
                  >
                    {showAddVehicle ? "Annuler" : "+ Ajouter"}
                  </button>
                </div>
              </div>

              {!isFleetCollapsed && (
                <>
              {/* Add vehicle form */}
              {showAddVehicle && (
                <form
                  onSubmit={handleAddVehicle}
                  className="card p-4 flex flex-col gap-3"
                >
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Nouveau vehicule
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      Modele
                    </label>
                    <input
                      type="text"
                      placeholder="ex : Citroën C3 Grise"
                      value={addForm.model}
                      onChange={(e) => setAddForm((f) => ({ ...f, model: e.target.value }))}
                      className="input-field"
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      Plaque
                    </label>
                    <input
                      type="text"
                      placeholder="ex : AB-123-CD"
                      value={addForm.plateNumber}
                      onChange={(e) => setAddForm((f) => ({ ...f, plateNumber: formatPlateNumber(e.target.value) }))}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex flex-col gap-2 flex-1">
                      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Zone parking
                      </label>
                      <input
                        type="text"
                        placeholder="ex : Parking A"
                        value={addForm.parkingArea}
                        onChange={(e) => setAddForm((f) => ({ ...f, parkingArea: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Place
                      </label>
                      <input
                        type="text"
                        placeholder="ex : 12"
                        value={addForm.parkingSpot}
                        onChange={(e) => setAddForm((f) => ({ ...f, parkingSpot: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                      <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                        Agence
                      </label>
                      <button
                        type="button"
                        className={`vehicle-toggle cursor-pointer`}
                        style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                        onClick={() => { setShowAddAgency((v) => !v); setAddAgencyError(null); }}
                      >
                        {showAddAgency ? "Annuler" : "+ Nouvelle agence"}
                      </button>
                    </div>
                    <select
                      value={addForm.agencyId}
                      onChange={(e) => setAddForm((f) => ({ ...f, agencyId: e.target.value }))}
                      style={inputStyle}
                      required
                    >
                      {agencies.length === 0 && (
                        <option value="" disabled>Aucune agence — créez-en une</option>
                      )}
                      {agencies.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.brandLabel})
                        </option>
                      ))}
                    </select>
                    {showAddAgency && (
                      <form
                        onSubmit={handleAddAgency}
                        className="flex flex-col gap-2 card p-3 mt-1"
                        style={{ background: "var(--card-secondary)" }}
                      >
                        <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          Nouvelle agence
                        </p>
                        <input
                          type="text"
                          placeholder="Nom (ex : Citron Paris)"
                          value={addAgencyForm.name}
                          onChange={(e) => setAddAgencyForm((f) => ({ ...f, name: e.target.value }))}
                          style={inputStyle}
                          required
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            placeholder="Code unique (ex : CTR-75)"
                            value={addAgencyForm.code}
                            onChange={(e) => setAddAgencyForm((f) => ({ ...f, code: e.target.value }))}
                            style={{ ...inputStyle, flex: 1 }}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Ville"
                            value={addAgencyForm.city}
                            onChange={(e) => setAddAgencyForm((f) => ({ ...f, city: e.target.value }))}
                            style={{ ...inputStyle, flex: 1 }}
                            required
                          />
                        </div>
                        <div className="flex gap-1.5">
                          {BRAND_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={`vehicle-toggle cursor-pointer ${addAgencyForm.brand === opt.value ? "vehicle-toggle-active" : ""}`}
                              onClick={() => setAddAgencyForm((f) => ({ ...f, brand: opt.value }))}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {addAgencyError && (
                          <p className="text-xs" style={{ color: "var(--danger)" }}>{addAgencyError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={addAgencyLoading}
                          style={primaryButtonStyle}
                        >
                          {addAgencyLoading ? "Création…" : "Créer l'agence"}
                        </button>
                      </form>
                    )}
                  </div>
                  {addError && (
                    <p className="text-xs" style={{ color: "var(--danger)" }}>{addError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={addLoading}
                    style={primaryButtonStyle}
                  >
                    {addLoading ? "Création…" : "Créer le vehicule"}
                  </button>
                </form>
              )}

              {/* Vehicle cards */}
              {saveError && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>{saveError}</p>
              )}

              {vehicles.length === 0 && !showAddVehicle && (
                <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
                  Aucun vehicule dans la flotte.
                </p>
              )}

              <div className="flex flex-col gap-3">
                {vehicles.map((vehicle) => {
                  const draft = drafts[vehicle.id];
                  if (!draft) return null;
                  const dirty = isDraftDirty(vehicle, draft);
                  const saving = savingId === vehicle.id;
                  const collapsed = collapsedIds.has(vehicle.id);
                  const toggleCollapse = () =>
                    setCollapsedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(vehicle.id)) next.delete(vehicle.id);
                      else next.add(vehicle.id);
                      return next;
                    });

                  return (
                    <div key={vehicle.id} className="card p-4 flex flex-col gap-3">
                      {/* Header */}
                      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={toggleCollapse}
                          className="flex w-full items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                          style={{ background: "none", border: "none", padding: 0 }}
                        >
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--muted)",
                              lineHeight: 1,
                              transition: "transform 150ms",
                              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          >
                            ▼
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{vehicle.model}</p>
                            {collapsed && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
                                {vehicle.plateNumber} · {vehicle.agency.brandLabel}
                              </p>
                            )}
                            {!collapsed && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
                                {vehicle.agency.name} · {vehicle.agency.brandLabel}
                              </p>
                            )}
                          </div>
                        </button>
                        <span
                          className="chip shrink-0 self-start sm:self-auto"
                          style={{ fontSize: "0.75rem", borderColor: "transparent", background: "color-mix(in srgb, " + statusColor(vehicle.operationalStatus) + " 12%, var(--card-secondary))", color: statusColor(vehicle.operationalStatus) }}
                        >
                          {vehicle.plateNumber}
                        </span>
                      </div>

                      {!collapsed && <div className="flex flex-col gap-1">
                        <label className="text-xs" style={{ color: "var(--muted)" }}>Nom du véhicule</label>
                        <input
                          type="text"
                          value={draft.model}
                          onChange={(e) => handleDraftChange(vehicle.id, { model: e.target.value })}
                          style={inputStyle}
                        />
                      </div>}

                      {!collapsed && <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs" style={{ color: "var(--muted)" }}>Zone</label>
                          <input
                            type="text"
                            placeholder="Zone parking"
                            value={draft.parkingArea}
                            onChange={(e) => handleDraftChange(vehicle.id, { parkingArea: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs" style={{ color: "var(--muted)" }}>Place</label>
                          <input
                            type="text"
                            placeholder="Numéro"
                            value={draft.parkingSpot}
                            onChange={(e) => handleDraftChange(vehicle.id, { parkingSpot: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                      </div>}

                      {!collapsed && <div className="flex flex-col gap-2">
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Statut actuel (calculé):{" "}
                          <span style={{ color: statusColor(vehicle.operationalStatus), fontWeight: 600 }}>
                            {STATUS_OPTIONS.find((opt) => opt.value === vehicle.operationalStatus)?.label}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDraftChange(vehicle.id, { isOutOfService: !draft.isOutOfService })}
                          className="vehicle-toggle cursor-pointer w-full"
                          style={
                            draft.isOutOfService
                              ? { background: "color-mix(in srgb, var(--danger) 12%, var(--card-secondary))", borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))", color: "var(--danger)" }
                              : {}
                          }
                        >
                          {draft.isOutOfService ? "Sortir du mode hors service" : "Passer en hors service"}
                        </button>
                      </div>}

                      {!collapsed && <>
                        {/* Cleaning */}
                        <button
                          type="button"
                          onClick={() => handleDraftChange(vehicle.id, { isCleaned: !draft.isCleaned })}
                          className="vehicle-toggle cursor-pointer w-full"
                          style={
                            draft.isCleaned
                              ? { background: "color-mix(in srgb, var(--success) 12%, var(--card-secondary))", borderColor: "color-mix(in srgb, var(--success) 40%, var(--border))", color: "var(--success)" }
                              : { color: "var(--warning)", borderColor: "color-mix(in srgb, var(--warning) 30%, var(--border))" }
                          }
                        >
                          {draft.isCleaned ? "✓ Nettoyé" : "À nettoyer"}
                        </button>

                        {/* Save */}
                        {dirty && (
                          <button
                            type="button"
                            onClick={() => handleSaveVehicle(vehicle.id)}
                            disabled={saving}
                            style={primaryButtonStyle}
                          >
                            {saving ? "Sauvegarde…" : "Sauvegarder"}
                          </button>
                        )}

                        {/* Delete */}
                        {confirmDeleteId === vehicle.id ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              disabled={deletingId === vehicle.id}
                              style={{ ...primaryButtonStyle, background: "var(--danger)", flex: 1 }}
                            >
                              {deletingId === vehicle.id ? "Suppression…" : "Confirmer la suppression"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="vehicle-toggle cursor-pointer"
                              style={{ flex: 1 }}
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(vehicle.id)}
                            className="nav-button-danger cursor-pointer w-full"
                          >
                            Supprimer
                          </button>
                        )}
                      </>}
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </section>

            {/* ── Section 2 : Enregistrer un changement ── */}
            <section className="card p-4 flex flex-col gap-4" style={{ order: 1 }}>
              <h2 className="text-base font-semibold">Enregistrer un changement</h2>

              <form onSubmit={handleSubmitLog} className="flex flex-col gap-4">
                {/* Vehicle select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    Véhicule
                  </label>
                  <select
                    value={logForm.vehicleId}
                    onChange={(e) => setLogForm((f) => ({ ...f, vehicleId: e.target.value }))}
                    style={inputStyle}
                    required
                  >
                    <option value="">— Sélectionner un véhicule —</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.model} · {v.plateNumber}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    Statut
                  </label>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Le statut réservation est automatique (Réservé / En location). Seul Hors service est manuel.
                  </p>
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <span
                      className="chip shrink-0"
                      style={{
                        fontSize: "0.75rem",
                        borderColor: "transparent",
                        background:
                          "color-mix(in srgb, " +
                          statusColor(effectiveLogStatus) +
                          " 12%, var(--card-secondary))",
                        color: statusColor(effectiveLogStatus),
                      }}
                    >
                      {effectiveLogStatusLabel}
                    </span>
                    <button
                      type="button"
                      className={`vehicle-toggle cursor-pointer ${logForm.status === "OUT_OF_SERVICE" ? "vehicle-toggle-active" : ""}`}
                      onClick={() =>
                        setLogForm((prev) => ({
                          ...prev,
                          status:
                            prev.status === "OUT_OF_SERVICE"
                              ? automaticLogStatus
                              : "OUT_OF_SERVICE",
                        }))
                      }
                    >
                      {logForm.status === "OUT_OF_SERVICE"
                        ? "Suivre la logique automatique"
                        : "Passer en hors service"}
                    </button>
                  </div>
                </div>

                {/* Client */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    Client
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      placeholder="Nom du client"
                      value={logForm.customerName}
                      onChange={(e) => setLogForm((f) => ({ ...f, customerName: e.target.value }))}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="tel"
                      placeholder="Téléphone"
                      value={logForm.customerPhone}
                      onChange={(e) => setLogForm((f) => ({ ...f, customerPhone: e.target.value }))}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      Début
                    </label>
                    <input
                      type="datetime-local"
                      value={logForm.startsAt}
                      onChange={(e) => setLogForm((f) => ({ ...f, startsAt: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                      Fin
                    </label>
                    <input
                      type="datetime-local"
                      value={logForm.endsAt}
                      onChange={(e) => setLogForm((f) => ({ ...f, endsAt: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Agency brand */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    Agence
                  </label>
                  <div className="flex flex-col gap-1.5 sm:flex-row">
                    {BRAND_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLogForm((f) => ({ ...f, agencyBrand: opt.value }))}
                        className={`vehicle-toggle cursor-pointer flex-1 ${logForm.agencyBrand === opt.value ? "vehicle-toggle-active" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    Plateforme
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORM_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setLogForm((f) => ({
                            ...f,
                            platform: f.platform === opt.value ? null : opt.value,
                          }))
                        }
                        className={`vehicle-toggle cursor-pointer ${logForm.platform === opt.value ? "vehicle-toggle-active" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    Note (optionnel)
                  </label>
                  <textarea
                    placeholder="Remarques, informations complémentaires…"
                    value={logForm.notes}
                    onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                {logError && (
                  <p className="text-xs" style={{ color: "var(--danger)" }}>{logError}</p>
                )}
                {logSuccess && (
                  <p className="text-xs font-medium" style={{ color: "var(--success)" }}>
                    Changement enregistré.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={logLoading}
                  style={primaryButtonStyle}
                >
                  {logLoading ? "Enregistrement…" : "Enregistrer le changement"}
                </button>
              </form>
            </section>

            {/* ── Section 3 : Historique ── */}
            {logs.length > 0 && (
              <section className="flex flex-col gap-3" style={{ order: 3 }}>
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                  <h2 className="text-base font-semibold">Historique récent</h2>
                  <button
                    type="button"
                    className="vehicle-toggle cursor-pointer"
                    onClick={() => setIsHistoryCollapsed((value) => !value)}
                  >
                    {isHistoryCollapsed ? "Déplier" : "Replier"}
                  </button>
                </div>{!isHistoryCollapsed && (
                  <>
                {logDeleteError && (
                  <p className="text-xs" style={{ color: "var(--danger)" }}>
                    {logDeleteError}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {logs.map((log) => (
                    <div key={log.id} className="card p-3 flex flex-col gap-1">
                      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                        <p className="text-sm font-medium">
                          {log.vehicle.model}
                          <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--muted)" }}>
                            {log.vehicle.plateNumber}
                          </span>
                        </p>
                        <span
                          className="chip shrink-0"
                          style={{ fontSize: "0.72rem", background: "color-mix(in srgb, " + statusColor(log.status) + " 12%, var(--card-secondary))", borderColor: "transparent", color: statusColor(log.status) }}
                        >
                          {log.statusLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--muted)" }}>
                        {log.customerName && <span>{log.customerName}{log.customerPhone ? ` · ${log.customerPhone}` : ""}</span>}
                        {log.startsAt && <span>{formatDateTime(log.startsAt)} → {formatDateTime(log.endsAt)}</span>}
                        <span>{log.agencyBrandLabel}</span>
                        {log.platform && <span>{PLATFORM_OPTIONS.find((p) => p.value === log.platform)?.label}</span>}
                        <span>{formatDateTime(log.createdAt)}</span>
                      </div>
                      {log.notes && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{log.notes}</p>
                      )}
                      {log.isReservation && (
                        <>
                          {editingLogId === log.id ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex flex-col gap-1">
                                <label className="text-xs" style={{ color: "var(--muted)" }}>
                                  Véhicule
                                </label>
                                <select
                                  value={editReservationForm.vehicleId}
                                  onChange={(e) =>
                                    setEditReservationForm((prev) => ({
                                      ...prev,
                                      vehicleId: e.target.value,
                                    }))
                                  }
                                  style={inputStyle}
                                >
                                  {vehicles.map((vehicle) => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                      {vehicle.model} · {vehicle.plateNumber}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="flex flex-col gap-1 flex-1">
                                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                                    Début
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={editReservationForm.startsAt}
                                    onChange={(e) =>
                                      setEditReservationForm((prev) => ({
                                        ...prev,
                                        startsAt: e.target.value,
                                      }))
                                    }
                                    style={inputStyle}
                                  />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                  <label className="text-xs" style={{ color: "var(--muted)" }}>
                                    Fin
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={editReservationForm.endsAt}
                                    onChange={(e) =>
                                      setEditReservationForm((prev) => ({
                                        ...prev,
                                        endsAt: e.target.value,
                                      }))
                                    }
                                    style={inputStyle}
                                  />
                                </div>
                              </div>

                              {editLogError && (
                                <p className="text-xs" style={{ color: "var(--danger)" }}>
                                  {editLogError}
                                </p>
                              )}

                              <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  className="vehicle-toggle cursor-pointer flex-1"
                                  onClick={() => cancelEditingReservation()}
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveReservationEdit(log.id)}
                                  disabled={editLoadingId === log.id}
                                  style={{ ...primaryButtonStyle, flex: 1 }}
                                >
                                  {editLoadingId === log.id ? "Enregistrement…" : "Enregistrer"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => startEditingReservation(log)}
                                className="vehicle-toggle cursor-pointer flex-1"
                              >
                                Modifier réservation
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteReservationLog(log.id)}
                                disabled={deletingLogId === log.id}
                                className="nav-button-danger cursor-pointer flex-1"
                              >
                                {deletingLogId === log.id ? "Suppression…" : "Supprimer réservation"}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
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










