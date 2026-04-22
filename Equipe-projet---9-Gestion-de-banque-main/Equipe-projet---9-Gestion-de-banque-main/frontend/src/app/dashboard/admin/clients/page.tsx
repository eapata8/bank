"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete, apiDownloadCSV } from "@/lib/api";
import type { Client, Transaction } from "@/lib/types";

/* ── Helpers ─────────────────────────────────── */
function formatMoney(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA");
}

/* ── Sous-composants admin ───────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 12 }}>{children}</p>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
function iStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", color: "var(--t1)", fontSize: 13, outline: "none", width: "100%", ...extra };
}
function sStyle(): React.CSSProperties { return { ...iStyle(), cursor: "pointer" }; }

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    PAYEE: "lb-badge-green", APPROUVE: "lb-badge-green",
    IMPAYEE: "lb-badge-red", REJETE: "lb-badge-red",
    A_VENIR: "lb-badge-amber", EN_ATTENTE: "lb-badge-amber",
    ACTIVE: "lb-badge-green", GELEE: "lb-badge-indigo",
    BLOQUEE: "lb-badge-red", EXPIREE: "lb-badge-muted",
  };
  return <span className={`lb-badge ${map[statut] ?? "lb-badge-muted"}`}>{statut}</span>;
}

/* ── Types ───────────────────────────────────── */
type ClientTab = "comptes" | "virements" | "depots" | "retraits" | "factures" | "cartes" | "interac" | "simulation";
type CompteTab = "balance" | "type" | "transactions" | "virement";

const TYPES_COMPTE = ["CHEQUES", "EPARGNE", "CREDIT"] as const;
const TYPES_TX = ["DEPOT", "RETRAIT", "VIREMENT", "PAIEMENT", "REMBOURSEMENT"] as const;

type Operations = {
  client: Client & { cree_le?: string };
  comptes: any[];
  virements: any[];
  depots: any[];
  retraits: any[];
  factures: any[];
  cartes: any[];
};

/* ── Page principale ─────────────────────────── */
export default function GestionClientsPage() {
  const { user } = useAuth();
  const isElevated = user?.role === "ADMIN" || user?.role === "MODERATEUR";
  const isAdmin = user?.role === "ADMIN";

  /* ── État client ── */
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [ops, setOps] = useState<Operations | null>(null);
  const [loadingOps, setLoadingOps] = useState(false);
  const [activeClientTab, setActiveClientTab] = useState<ClientTab>("comptes");

  /* ── État compte (admin) ── */
  const [selectedCompte, setSelectedCompte] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [activeCompteTab, setActiveCompteTab] = useState<CompteTab>("balance");

  /* ── Formulaires admin ── */
  const [balanceForm, setBalanceForm] = useState({ montant: "", motif: "", type_transaction: "DEPOT" });
  const [typeForm, setTypeForm] = useState({ type_compte: "CHEQUES" });
  const [txForm, setTxForm] = useState({ type_transaction: "DEPOT", description: "", montant: "", statut: "TERMINEE", ajuster_solde: true });
  const [transferForm, setTransferForm] = useState({ dest_numero: "", dest_institution: "", dest_transit: "", montant: "", description: "" });

  /* ── Confirms modals ── */
  const [toggleConfirm, setToggleConfirm] = useState(false);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);

  /* ── État cartes admin ── */
  const [showCarteForm, setShowCarteForm] = useState(false);
  const [carteForm, setCarteForm] = useState({ type_carte: "VISA", last_four: "", limite_credit: "", date_expiration: "" });
  const [selectedCarteId, setSelectedCarteId] = useState<number | null>(null);
  const [limiteForm, setLimiteForm] = useState({ limite_credit: "" });
  const [soldeCarteInputs, setSoldeCarteInputs] = useState<Record<number, string>>({});
  const [selectedCarteSoldeId, setSelectedCarteSoldeId] = useState<number | null>(null);

  /* ── État factures admin ── */
  const [showFactureForm, setShowFactureForm] = useState(false);
  const [factureForm, setFactureForm] = useState({ fournisseur: "", reference_facture: "", montant: "", date_emission: "", date_echeance: "", statut: "IMPAYEE", description: "" });

  /* ── État Interac admin ── */
  const [interacTransferts, setInteracTransferts] = useState<any[]>([]);
  const [interacAutoDeposit, setInteracAutoDeposit] = useState<any | null>(null);
  const [interacStats, setInteracStats]       = useState<{ total_24h: number; total_7j: number; total_30j: number; nb_en_attente: number } | null>(null);
  const [interacLimites, setInteracLimites]   = useState<{ limite_24h: number | null; limite_7j: number | null; limite_30j: number | null } | null>(null);
  const [loadingInterac, setLoadingInterac]   = useState(false);
  const [interacAdForm, setInteracAdForm]     = useState({ email_interac: "", compte_depot_id: "" });
  const [limitesForm, setLimitesForm]         = useState({ limite_24h: "", limite_7j: "", limite_30j: "" });
  const [editingLimites, setEditingLimites]   = useState(false);

  /* ── État simulation ── */
  type Snapshot = { id: number; nom: string; description: string | null; est_initial: number; cree_par_email: string; cree_le: string };
  const [snapshots,       setSnapshots]       = useState<Snapshot[]>([]);
  const [loadingSnaps,    setLoadingSnaps]     = useState(false);
  const [snapNom,         setSnapNom]          = useState("");
  const [snapDesc,        setSnapDesc]         = useState("");
  const [snapCreateLoad,  setSnapCreateLoad]   = useState(false);
  const [snapCreateErr,   setSnapCreateErr]    = useState<string | null>(null);
  const [snapRestoreTarget, setSnapRestoreTarget] = useState<Snapshot | null>(null);
  const [snapDeleteTarget,  setSnapDeleteTarget]  = useState<Snapshot | null>(null);
  const [snapActionLoad,  setSnapActionLoad]   = useState(false);

  /* ── Messages ── */
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const notify = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  /* ── Chargement clients ── */
  const loadClients = async (q = search) => {
    setLoadingClients(true);
    try {
      const res = await apiGet<{ data: Client[] }>(
        q.trim() ? `/clients?search=${encodeURIComponent(q.trim())}` : "/clients"
      );
      setClients(res.data);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
    finally { setLoadingClients(false); }
  };

  /* ── Chargement opérations client ── */
  const loadOps = async (clientId: number) => {
    setLoadingOps(true);
    try {
      const res = await apiGet<Operations>(`/clients/${clientId}/operations`);
      setOps(res);
      // Rafraîchir le compte sélectionné si toujours valide
      if (selectedCompte) {
        const updated = res.comptes.find((c: any) => c.id === selectedCompte.id);
        if (updated) setSelectedCompte(updated);
      }
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
    finally { setLoadingOps(false); }
  };

  /* ── Chargement Interac ── */
  const loadInterac = async (clientId: number) => {
    setLoadingInterac(true);
    try {
      const [tx, ad, st] = await Promise.all([
        apiGet<{ data: any[] }>(`/admin/interac/client/${clientId}`),
        apiGet<{ data: any }>(`/admin/interac/client/${clientId}/autodeposit`),
        apiGet<{ data: any }>(`/admin/interac/client/${clientId}/stats`),
      ]);
      setInteracTransferts(tx.data);
      setInteracAutoDeposit(ad.data);
      setInteracStats(st.data);
    } catch { /* silent */ }
    // Limites: fetch séparé pour ne pas bloquer le reste si colonnes absentes
    try {
      const lim = await apiGet<{ data: any }>(`/admin/interac/client/${clientId}/limites`);
      setInteracLimites(lim.data);
      setLimitesForm({
        limite_24h: lim.data?.limite_24h != null ? String(lim.data.limite_24h) : "",
        limite_7j:  lim.data?.limite_7j  != null ? String(lim.data.limite_7j)  : "",
        limite_30j: lim.data?.limite_30j != null ? String(lim.data.limite_30j) : "",
      });
    } catch { /* colonnes peut-être absentes — UI dégradée */ }
    finally { setLoadingInterac(false); }
  };

  /* ── Chargement snapshots simulation ── */
  const loadSnapshots = async (clientId: number) => {
    setLoadingSnaps(true);
    try {
      const r = await fetch(`/api/simulation/snapshots?clientId=${clientId}`, { credentials: "include" });
      const data = await r.json();
      if (r.ok) setSnapshots(data.data ?? []);
    } catch { /* silent */ }
    finally { setLoadingSnaps(false); }
  };

  const selectClient = async (c: Client) => {
    setSelectedClient(c);
    setActiveClientTab("comptes");
    setOps(null);
    setSelectedCompte(null);
    setTransactions([]);
    setShowCarteForm(false);
    setShowFactureForm(false);
    setSelectedCarteId(null);
    setSelectedCarteSoldeId(null);
    setSoldeCarteInputs({});
    setInteracTransferts([]);
    setInteracAutoDeposit(null);
    setInteracStats(null);
    setInteracLimites(null);
    setEditingLimites(false);
    setSnapshots([]);
    setSnapNom("");
    setSnapDesc("");
    setSnapCreateErr(null);
    setSnapRestoreTarget(null);
    setSnapDeleteTarget(null);
    await loadOps(c.id);
    await loadInterac(c.id);
    await loadSnapshots(c.id);
  };

  /* ── Transactions du compte ── */
  const loadTransactions = async (compteId: number) => {
    setLoadingTx(true);
    try {
      const res = await apiGet<{ data: Transaction[] }>(`/comptes/${compteId}/transactions`);
      setTransactions(res.data);
    } catch { setTransactions([]); }
    finally { setLoadingTx(false); }
  };

  const selectCompte = (c: any) => {
    setSelectedCompte(c);
    setActiveCompteTab("balance");
    setTypeForm({ type_compte: c.type_compte });
    loadTransactions(c.id);
  };

  const refreshCompte = async () => {
    if (!selectedClient) return;
    await loadOps(selectedClient.id);
    if (selectedCompte) await loadTransactions(selectedCompte.id);
  };

  useEffect(() => {
    if (isElevated) loadClients("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElevated]);

  /* ── Actions admin compte ── */
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompte) return;
    try {
      const res = await apiPatch<{ message: string; nouveau_solde: number }>(
        `/admin/comptes/${selectedCompte.id}/balance`, balanceForm
      );
      notify("ok", `${res.message} — nouveau solde : ${Number(res.nouveau_solde).toFixed(2)} CAD`);
      setBalanceForm({ montant: "", motif: "", type_transaction: "DEPOT" });
      refreshCompte();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleToggleStatus = () => { if (selectedCompte) setToggleConfirm(true); };
  const confirmToggleStatus = async () => {
    if (!selectedCompte) return;
    setToggleConfirm(false);
    try {
      const res = await apiPatch<{ message: string }>(`/admin/comptes/${selectedCompte.id}/status`, {});
      notify("ok", res.message);
      refreshCompte();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleChangeType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompte) return;
    try {
      const res = await apiPatch<{ message: string }>(`/admin/comptes/${selectedCompte.id}/type`, typeForm);
      notify("ok", res.message);
      refreshCompte();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompte) return;
    try {
      const res = await apiPost<{ message: string; id: number }>(
        `/admin/comptes/${selectedCompte.id}/transactions`, txForm
      );
      notify("ok", `${res.message} (id: ${res.id})`);
      setTxForm({ type_transaction: "DEPOT", description: "", montant: "", statut: "TERMINEE", ajuster_solde: true });
      refreshCompte();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleDeleteTransaction = (txId: number) => setDeleteTxId(txId);
  const confirmDeleteTransaction = async () => {
    if (!deleteTxId) return;
    const txId = deleteTxId;
    setDeleteTxId(null);
    try {
      const res = await apiDelete<{ message: string }>(`/admin/transactions/${txId}`);
      notify("ok", res.message);
      refreshCompte();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleForceTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompte) return;
    try {
      const body = {
        compte_source_id: selectedCompte.id,
        numero_compte_dest: transferForm.dest_numero,
        numero_institution_dest: transferForm.dest_institution,
        numero_transit_dest: transferForm.dest_transit,
        montant: transferForm.montant,
        description: transferForm.description,
      };
      const res = await apiPost<{ message: string; id: number }>("/admin/virements/force", body);
      notify("ok", `${res.message} (virement #${res.id})`);
      setTransferForm({ dest_numero: "", dest_institution: "", dest_transit: "", montant: "", description: "" });
      refreshCompte();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  /* ── Actions admin cartes ── */
  const handleCreateCarte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      const res = await apiPost<{ message: string; id: number }>("/cartes", { ...carteForm, client_id: selectedClient.id });
      notify("ok", `${res.message} (id: ${res.id})`);
      setCarteForm({ type_carte: "VISA", last_four: "", limite_credit: "", date_expiration: "" });
      setShowCarteForm(false);
      loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleBloquerCarte = async (carteId: number) => {
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carteId}/bloquer`, {});
      notify("ok", res.message);
      if (selectedClient) loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleActiverCarte = async (carteId: number) => {
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carteId}/activer`, {});
      notify("ok", res.message);
      if (selectedClient) loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleGelerCarte = async (carteId: number) => {
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carteId}/geler`, {});
      notify("ok", res.message);
      if (selectedClient) loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleDegelerCarte = async (carteId: number) => {
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carteId}/degeler`, {});
      notify("ok", res.message);
      if (selectedClient) loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleModifierLimite = async (e: React.FormEvent, carteId: number) => {
    e.preventDefault();
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carteId}/limite`, limiteForm);
      notify("ok", res.message);
      setSelectedCarteId(null);
      setLimiteForm({ limite_credit: "" });
      if (selectedClient) loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleModifierSoldeCarte = async (e: React.FormEvent, carteId: number) => {
    e.preventDefault();
    const val = Number(soldeCarteInputs[carteId]);
    if (isNaN(val) || val < 0) { notify("err", "Entrez un solde utilisé valide (≥ 0)"); return; }
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carteId}/solde`, { solde_utilise: val });
      notify("ok", res.message);
      setSelectedCarteSoldeId(null);
      setSoldeCarteInputs((cur) => ({ ...cur, [carteId]: "" }));
      if (selectedClient) loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  /* ── Actions admin Interac ── */
  const handleForceActiverAD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      const res = await apiPost<{ message: string; data: any }>(
        `/admin/interac/client/${selectedClient.id}/autodeposit`,
        { email_interac: interacAdForm.email_interac, compte_depot_id: Number(interacAdForm.compte_depot_id) }
      );
      notify("ok", res.message);
      setInteracAdForm({ email_interac: "", compte_depot_id: "" });
      await loadInterac(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleDesactiverAD = async () => {
    if (!selectedClient) return;
    try {
      const res = await apiDelete<{ message: string }>(`/admin/interac/client/${selectedClient.id}/autodeposit`);
      notify("ok", res.message);
      await loadInterac(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleCancelInterac = async (transfertId: number) => {
    if (!selectedClient) return;
    try {
      const res = await apiDelete<{ message: string }>(`/interac/${transfertId}`);
      notify("ok", res.message);
      await loadInterac(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleSaveLimites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      const payload = {
        limite_24h: limitesForm.limite_24h.trim() === "" ? null : Number(limitesForm.limite_24h),
        limite_7j:  limitesForm.limite_7j.trim()  === "" ? null : Number(limitesForm.limite_7j),
        limite_30j: limitesForm.limite_30j.trim() === "" ? null : Number(limitesForm.limite_30j),
      };
      const res = await apiPatch<{ message: string; data: any }>(
        `/admin/interac/client/${selectedClient.id}/limites`, payload
      );
      notify("ok", res.message);
      setInteracLimites(res.data);
      setEditingLimites(false);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  /* ── Actions admin factures ── */
  const handleCreateFacture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      const res = await apiPost<{ message: string; id: number }>("/factures", { ...factureForm, client_id: selectedClient.id });
      notify("ok", `${res.message} (id: ${res.id})`);
      setFactureForm({ fournisseur: "", reference_facture: "", montant: "", date_emission: "", date_echeance: "", statut: "IMPAYEE", description: "" });
      setShowFactureForm(false);
      loadOps(selectedClient.id);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  /* ── Guard ── */
  if (!isElevated) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <p style={{ color: "var(--t3)" }}>Section réservée aux modérateurs et administrateurs.</p>
      </div>
    );
  }

  const clientTabs: { id: ClientTab; label: string; count: number }[] = ops ? [
    { id: "comptes",   label: "Comptes",   count: ops.comptes.length },
    { id: "virements", label: "Virements", count: ops.virements.length },
    { id: "depots",    label: "Dépôts",    count: ops.depots.length },
    { id: "retraits",  label: "Retraits",  count: ops.retraits.length },
    { id: "factures",  label: "Factures",  count: ops.factures.length },
    { id: "cartes",    label: "Cartes",    count: ops.cartes.length },
  ] : [];

  const compteTabs: { id: CompteTab; label: string }[] = [
    { id: "balance",      label: "Solde" },
    { id: "type",         label: "Type / Statut" },
    { id: "transactions", label: "Transactions" },
    { id: "virement",     label: "Virement" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <p className="type-label" style={{ marginBottom: 4 }}>Administration</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
          Gestion des clients
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
          Sélectionnez un client pour consulter et gérer l'ensemble de ses opérations.
        </p>
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "lb-alert-success" : "lb-alert-error"}>
          {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
        </div>
      )}

      <div className="lb-layout-admin-clients">

        {/* ── Liste clients ── */}
        <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input
              placeholder="Rechercher un client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadClients(search)}
              style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--t1)", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={() => loadClients(search)}
              style={{ padding: "7px 12px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {loadingClients ? "…" : "OK"}
            </button>
          </div>
          <div className="lb-client-list">
            {clients.map((c) => (
              <div
                key={c.id}
                onClick={() => selectClient(c)}
                style={{
                  padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: selectedClient?.id === c.id ? "var(--blue-dim)" : "transparent",
                  transition: "background 120ms",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{c.prenom} {c.nom}</p>
                <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                  {c.login_email ?? <span style={{ fontStyle: "italic" }}>Aucun compte utilisateur</span>}
                </p>
                {c.ville && <p style={{ fontSize: 11, color: "var(--t3)" }}>{c.ville}</p>}
              </div>
            ))}
            {!loadingClients && clients.length === 0 && (
              <p style={{ padding: 20, fontSize: 13, color: "var(--t3)", textAlign: "center" }}>Aucun client. Lancez une recherche.</p>
            )}
          </div>
        </div>

        {/* ── Panneau principal ── */}
        {selectedClient ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Info client */}
            <div className="lb-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)" }}>
                    {selectedClient.prenom} {selectedClient.nom}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                    {selectedClient.login_email ?? <span style={{ fontStyle: "italic" }}>Aucun compte utilisateur</span>}
                    {selectedClient.ville ? ` · ${selectedClient.ville}` : ""}
                    {` · Client #${selectedClient.id}`}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {/* Bouton réinitialisation rapide — toujours visible pour ADMIN */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        const initialSnap = snapshots.find(s => s.est_initial === 1);
                        if (initialSnap) {
                          setSnapRestoreTarget(initialSnap);
                        } else {
                          notify("err", "Aucun snapshot initial trouvé pour ce client. Lancez npm run db:migrate pour en créer un.");
                        }
                      }}
                      title="Revenir à l'état initial (seed) — toutes les modifications seront perdues"
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        whiteSpace: "nowrap", cursor: "pointer",
                        border: "1px solid rgba(239,68,68,0.35)",
                        background: "var(--red-dim)",
                        color: "#FCA5A5",
                      }}
                    >
                      ⏮ État initial
                    </button>
                  )}
                  {ops && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {clientTabs.map((t) => (
                        <div key={t.id} className="lb-stat" style={{ textAlign: "center", minWidth: 58, padding: "6px 10px" }}>
                          <p className="lb-num" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{t.count}</p>
                          <p className="type-label" style={{ marginTop: 2, fontSize: 9 }}>{t.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {loadingOps ? (
              <div className="lb-card" style={{ padding: 40, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--t3)" }} className="lb-loading">Chargement des opérations…</p>
              </div>
            ) : ops ? (
              <>
                {/* Onglets client */}
                <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                  {clientTabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setActiveClientTab(t.id); if (t.id !== "comptes") setSelectedCompte(null); setShowCarteForm(false); setShowFactureForm(false); setSelectedCarteId(null); setSelectedCarteSoldeId(null); }}
                      style={{
                        padding: "8px 14px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: "1px solid var(--border)",
                        borderBottom: activeClientTab === t.id ? "1px solid var(--bg)" : "1px solid var(--border)",
                        background: activeClientTab === t.id ? "var(--surface-2)" : "transparent",
                        color: activeClientTab === t.id ? "var(--t1)" : "var(--t3)",
                        marginBottom: activeClientTab === t.id ? -1 : 0,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {t.label}
                      <span className={`lb-badge ${t.count > 0 ? "lb-badge-muted" : ""}`} style={{ fontSize: 10, padding: "1px 5px" }}>{t.count}</span>
                    </button>
                  ))}
                  {/* Onglet Interac — données chargées séparément */}
                  <button
                    onClick={() => { setActiveClientTab("interac"); setSelectedCompte(null); setShowCarteForm(false); setShowFactureForm(false); setSelectedCarteId(null); setSelectedCarteSoldeId(null); }}
                    style={{
                      padding: "8px 14px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: "1px solid var(--border)",
                      borderBottom: activeClientTab === "interac" ? "1px solid var(--bg)" : "1px solid var(--border)",
                      background: activeClientTab === "interac" ? "var(--surface-2)" : "transparent",
                      color: activeClientTab === "interac" ? "var(--stripe-purple)" : "var(--t3)",
                      marginBottom: activeClientTab === "interac" ? -1 : 0,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    Interac
                    {interacAutoDeposit?.statut === "ACTIVE" && (
                      <span className="lb-badge lb-badge-green" style={{ fontSize: 10, padding: "1px 5px" }}>AD</span>
                    )}
                    {(interacStats?.nb_en_attente ?? 0) > 0 && (
                      <span className="lb-badge lb-badge-amber" style={{ fontSize: 10, padding: "1px 5px" }}>{interacStats!.nb_en_attente}</span>
                    )}
                  </button>
                  {/* Onglet Simulation — snapshots par client (ADMIN seulement) */}
                  {isAdmin && (
                    <button
                      onClick={() => { setActiveClientTab("simulation"); setSelectedCompte(null); setShowCarteForm(false); setShowFactureForm(false); setSelectedCarteId(null); setSelectedCarteSoldeId(null); }}
                      style={{
                        padding: "8px 14px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: "1px solid var(--border)",
                        borderBottom: activeClientTab === "simulation" ? "1px solid var(--bg)" : "1px solid var(--border)",
                        background: activeClientTab === "simulation" ? "var(--surface-2)" : "transparent",
                        color: activeClientTab === "simulation" ? "var(--t1)" : "var(--t3)",
                        marginBottom: activeClientTab === "simulation" ? -1 : 0,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      Simulation
                      {snapshots.length > 0 && (
                        <span className="lb-badge lb-badge-muted" style={{ fontSize: 10, padding: "1px 5px" }}>{snapshots.length}</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Contenu onglet */}
                <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>

                  {/* COMPTES */}
                  {activeClientTab === "comptes" && (
                    <div>
                      <div className="lb-table-scroll"><table className="lb-table" style={{ width: "100%" }}>
                        <thead><tr>
                          <th style={{ paddingLeft: 20 }}>ID</th>
                          <th>Type</th>
                          <th>Numéro</th>
                          <th style={{ textAlign: "right" }}>Solde</th>
                          <th>Devise</th>
                          <th>Statut</th>
                          {isAdmin && <th style={{ paddingRight: 20 }}>Actions</th>}
                        </tr></thead>
                        <tbody>
                          {ops.comptes.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Aucun compte.</td></tr>}
                          {ops.comptes.map((c: any) => (
                            <tr key={c.id} style={{ background: selectedCompte?.id === c.id ? "var(--blue-dim)" : undefined }}>
                              <td style={{ paddingLeft: 20, color: "var(--t2)", fontWeight: 600 }}>#{c.id}</td>
                              <td><span className="lb-badge lb-badge-muted">{c.type_compte}</span></td>
                              <td className="type-mono" style={{ fontSize: 12 }}>{c.numero_compte}</td>
                              <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#93C5FD" }}>{formatMoney(c.solde)}</td>
                              <td style={{ fontSize: 12, color: "var(--t3)" }}>{c.devise}</td>
                              <td><StatutBadge statut={c.est_actif ? "ACTIVE" : "BLOQUEE"} /></td>
                              {isAdmin && (
                                <td style={{ paddingRight: 20 }}>
                                  <button
                                    onClick={() => selectCompte(c)}
                                    style={{
                                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                      border: selectedCompte?.id === c.id ? "1px solid var(--border-blue)" : "1px solid var(--border)",
                                      background: selectedCompte?.id === c.id ? "var(--blue-dim)" : "transparent",
                                      color: selectedCompte?.id === c.id ? "#93C5FD" : "var(--t2)",
                                    }}
                                  >
                                    {selectedCompte?.id === c.id ? "Actif" : "Gérer"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table></div>

                      {/* ── Sous-panneau admin compte ── */}
                      {isAdmin && selectedCompte && (
                        <div style={{ borderTop: "2px solid var(--border-blue)", padding: "20px 24px", background: "rgba(147,197,253,0.03)" }}>

                          {/* En-tête compte sélectionné */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700, color: "#93C5FD" }}>
                                Compte #{selectedCompte.id} — {selectedCompte.numero_compte}
                              </p>
                              <p style={{ fontSize: 12, color: "var(--t3)" }}>
                                {selectedCompte.type_compte} · {selectedCompte.devise} · Solde : {formatMoney(selectedCompte.solde)}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button
                                onClick={handleToggleStatus}
                                style={{
                                  padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                  border: selectedCompte.est_actif ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(16,185,129,0.3)",
                                  background: selectedCompte.est_actif ? "var(--red-dim)" : "rgba(16,185,129,0.15)",
                                  color: selectedCompte.est_actif ? "#FCA5A5" : "#6EE7B7",
                                }}
                              >
                                {selectedCompte.est_actif ? "Bloquer" : "Débloquer"}
                              </button>
                              <button
                                onClick={() => setSelectedCompte(null)}
                                style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--t3)" }}
                              >
                                Fermer
                              </button>
                            </div>
                          </div>

                          {/* Onglets de contrôle */}
                          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
                            {compteTabs.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => setActiveCompteTab(t.id)}
                                style={{
                                  padding: "7px 12px", borderRadius: "6px 6px 0 0", fontSize: 11, fontWeight: 600, cursor: "pointer",
                                  border: "1px solid var(--border)",
                                  borderBottom: activeCompteTab === t.id ? "1px solid rgba(147,197,253,0.03)" : "1px solid var(--border)",
                                  background: activeCompteTab === t.id ? "rgba(147,197,253,0.08)" : "transparent",
                                  color: activeCompteTab === t.id ? "#93C5FD" : "var(--t3)",
                                  marginBottom: activeCompteTab === t.id ? -1 : 0,
                                }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>

                          {/* Solde */}
                          {activeCompteTab === "balance" && (
                            <form onSubmit={handleAdjustBalance} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
                              <SectionTitle>Ajuster le solde (+ crédit, - débit)</SectionTitle>
                              <div className="lb-form-grid">
                                <Field label="Montant (ex: 100 ou -50)">
                                  <input type="number" step="0.01" required value={balanceForm.montant}
                                    onChange={(e) => setBalanceForm((f) => ({ ...f, montant: e.target.value }))}
                                    placeholder="+100.00 ou -50.00" style={iStyle()} />
                                </Field>
                                <Field label="Type de transaction">
                                  <select value={balanceForm.type_transaction}
                                    onChange={(e) => setBalanceForm((f) => ({ ...f, type_transaction: e.target.value }))}
                                    style={sStyle()}>
                                    {TYPES_TX.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </Field>
                              </div>
                              <Field label="Motif (optionnel)">
                                <input value={balanceForm.motif}
                                  onChange={(e) => setBalanceForm((f) => ({ ...f, motif: e.target.value }))}
                                  placeholder="Correction, bonus, pénalité…" style={iStyle()} />
                              </Field>
                              <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                Appliquer l'ajustement
                              </button>
                            </form>
                          )}

                          {/* Type / Statut */}
                          {activeCompteTab === "type" && (
                            <form onSubmit={handleChangeType} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 340 }}>
                              <SectionTitle>Changer le type de compte</SectionTitle>
                              <Field label="Nouveau type">
                                <select value={typeForm.type_compte}
                                  onChange={(e) => setTypeForm({ type_compte: e.target.value })}
                                  style={sStyle()}>
                                  {TYPES_COMPTE.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </Field>
                              <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                Modifier le type
                              </button>
                            </form>
                          )}

                          {/* Transactions */}
                          {activeCompteTab === "transactions" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                              <form onSubmit={handleAddTransaction} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                                <SectionTitle>Insérer une transaction</SectionTitle>
                                <div className="lb-form-grid">
                                  <Field label="Type">
                                    <select value={txForm.type_transaction}
                                      onChange={(e) => setTxForm((f) => ({ ...f, type_transaction: e.target.value }))}
                                      style={sStyle()}>
                                      {TYPES_TX.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Statut">
                                    <select value={txForm.statut}
                                      onChange={(e) => setTxForm((f) => ({ ...f, statut: e.target.value }))}
                                      style={sStyle()}>
                                      <option value="TERMINEE">TERMINEE</option>
                                      <option value="EN_ATTENTE">EN_ATTENTE</option>
                                    </select>
                                  </Field>
                                  <Field label="Montant (+ crédit, - débit)">
                                    <input type="number" step="0.01" required value={txForm.montant}
                                      onChange={(e) => setTxForm((f) => ({ ...f, montant: e.target.value }))}
                                      placeholder="ex: 200 ou -50" style={iStyle()} />
                                  </Field>
                                  <Field label="Description (optionnel)">
                                    <input value={txForm.description}
                                      onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
                                      placeholder="Note…" style={iStyle()} />
                                  </Field>
                                </div>
                                <button type="submit" style={{ padding: "9px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                  Insérer la transaction
                                </button>
                              </form>

                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <SectionTitle>Historique des transactions</SectionTitle>
                                  <button
                                    onClick={() => apiDownloadCSV(`/export/transactions/${selectedCompte.id}`, `transactions-${selectedCompte.numero_compte}.csv`).catch(() => {})}
                                    style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)", color: "#6EE7B7", fontSize: 11, cursor: "pointer" }}
                                  >
                                    ⬇ CSV
                                  </button>
                                </div>
                                {loadingTx ? (
                                  <p style={{ fontSize: 12, color: "var(--t3)" }}>Chargement…</p>
                                ) : transactions.length === 0 ? (
                                  <p style={{ fontSize: 12, color: "var(--t3)" }}>Aucune transaction.</p>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                                    {transactions.map((tx) => (
                                      <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                                        <div>
                                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>
                                            #{tx.id} · {tx.type_transaction}
                                            {tx.description && <span style={{ fontWeight: 400, color: "var(--t3)" }}> — {tx.description}</span>}
                                          </p>
                                          <p style={{ fontSize: 11, color: "var(--t3)" }}>{new Date(tx.date_transaction).toLocaleString("fr-CA")} · {tx.statut}</p>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                          <p style={{ fontSize: 13, fontWeight: 700, color: Number(tx.montant) >= 0 ? "#6EE7B7" : "#FCA5A5" }}>
                                            {Number(tx.montant) >= 0 ? "+" : ""}{Number(tx.montant).toFixed(2)} $
                                          </p>
                                          <button
                                            onClick={() => handleDeleteTransaction(tx.id)}
                                            style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5", fontSize: 10, fontWeight: 600, cursor: "pointer" }}
                                          >
                                            Suppr.
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Virement (depuis ce compte vers un compte destination) */}
                          {activeCompteTab === "virement" && (
                            <form onSubmit={handleForceTransfer} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
                              <SectionTitle>Virement depuis le compte #{selectedCompte.id} ({selectedCompte.numero_compte})</SectionTitle>
                              <p style={{ fontSize: 12, color: "var(--t2)" }}>
                                Débit immédiat du compte source sélectionné vers le compte de destination.
                              </p>
                              <div className="lb-form-grid">
                                <Field label="N° compte destination *">
                                  <input required value={transferForm.dest_numero} onChange={(e) => setTransferForm((f) => ({ ...f, dest_numero: e.target.value }))} placeholder="XXXX XXXX XXXX" style={iStyle()} />
                                </Field>
                                <Field label="Institution *">
                                  <input required value={transferForm.dest_institution} onChange={(e) => setTransferForm((f) => ({ ...f, dest_institution: e.target.value }))} placeholder="621" style={iStyle()} />
                                </Field>
                                <Field label="Transit *">
                                  <input required value={transferForm.dest_transit} onChange={(e) => setTransferForm((f) => ({ ...f, dest_transit: e.target.value }))} placeholder="10482" style={iStyle()} />
                                </Field>
                                <Field label="Montant (> 0)">
                                  <input type="number" step="0.01" min="0.01" required value={transferForm.montant} onChange={(e) => setTransferForm((f) => ({ ...f, montant: e.target.value }))} placeholder="500.00" style={iStyle()} />
                                </Field>
                              </div>
                              <Field label="Description (optionnel)">
                                <input value={transferForm.description} onChange={(e) => setTransferForm((f) => ({ ...f, description: e.target.value }))} placeholder="Motif…" style={iStyle()} />
                              </Field>
                              <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                Exécuter le virement
                              </button>
                            </form>
                          )}

                        </div>
                      )}
                    </div>
                  )}

                  {/* VIREMENTS */}
                  {activeClientTab === "virements" && (
                    <div className="lb-table-scroll"><table className="lb-table" style={{ width: "100%" }}>
                      <thead><tr>
                        <th style={{ paddingLeft: 20 }}>ID</th>
                        <th>De</th>
                        <th>Vers</th>
                        <th style={{ textAlign: "right" }}>Montant</th>
                        <th>Statut</th>
                        <th style={{ paddingRight: 20 }}>Date</th>
                      </tr></thead>
                      <tbody>
                        {ops.virements.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Aucun virement.</td></tr>}
                        {ops.virements.map((v: any) => (
                          <tr key={v.id}>
                            <td style={{ paddingLeft: 20, color: "var(--t2)", fontWeight: 600 }}>#{v.id}</td>
                            <td>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{v.client_source_nom}</p>
                              <p style={{ fontSize: 11, color: "var(--t3)" }}>{v.compte_source_type} ({v.compte_source_numero})</p>
                            </td>
                            <td>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>{v.client_destination_nom}</p>
                              <p style={{ fontSize: 11, color: "var(--t3)" }}>{v.compte_destination_type} ({v.compte_destination_numero})</p>
                            </td>
                            <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#6EE7B7" }}>{formatMoney(v.montant)}</td>
                            <td><StatutBadge statut={v.statut} /></td>
                            <td style={{ paddingRight: 20, fontSize: 11, color: "var(--t3)" }}>{formatDate(v.date_virement)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}

                  {/* DÉPÔTS */}
                  {activeClientTab === "depots" && (
                    <div className="lb-table-scroll"><table className="lb-table" style={{ width: "100%" }}>
                      <thead><tr>
                        <th style={{ paddingLeft: 20 }}>ID</th>
                        <th>Compte</th>
                        <th>Chèque</th>
                        <th>Banque</th>
                        <th style={{ textAlign: "right" }}>Montant</th>
                        <th>Statut</th>
                        <th style={{ paddingRight: 20 }}>Date</th>
                      </tr></thead>
                      <tbody>
                        {ops.depots.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Aucun dépôt.</td></tr>}
                        {ops.depots.map((d: any) => (
                          <tr key={d.id}>
                            <td style={{ paddingLeft: 20, color: "var(--t2)", fontWeight: 600 }}>#{d.id}</td>
                            <td className="type-mono" style={{ fontSize: 11 }}>{d.type_compte} ({d.numero_compte})</td>
                            <td style={{ fontSize: 12 }}>{d.numero_cheque}</td>
                            <td style={{ fontSize: 12, color: "var(--t2)" }}>{d.banque_emettrice}</td>
                            <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#6EE7B7" }}>{formatMoney(d.montant)}</td>
                            <td><StatutBadge statut={d.statut} /></td>
                            <td style={{ paddingRight: 20, fontSize: 11, color: "var(--t3)" }}>{formatDate(d.depose_le)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}

                  {/* RETRAITS */}
                  {activeClientTab === "retraits" && (
                    <div className="lb-table-scroll"><table className="lb-table" style={{ width: "100%" }}>
                      <thead><tr>
                        <th style={{ paddingLeft: 20 }}>ID</th>
                        <th>Compte</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Montant</th>
                        <th>Statut</th>
                        <th style={{ paddingRight: 20 }}>Date</th>
                      </tr></thead>
                      <tbody>
                        {ops.retraits.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Aucun retrait.</td></tr>}
                        {ops.retraits.map((r: any) => (
                          <tr key={r.id}>
                            <td style={{ paddingLeft: 20, color: "var(--t2)", fontWeight: 600 }}>#{r.id}</td>
                            <td className="type-mono" style={{ fontSize: 11 }}>{r.type_compte} ({r.numero_compte})</td>
                            <td style={{ fontSize: 12, color: "var(--t3)" }}>{r.description || "—"}</td>
                            <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#FCA5A5" }}>-{formatMoney(r.montant)}</td>
                            <td><StatutBadge statut={r.statut} /></td>
                            <td style={{ paddingRight: 20, fontSize: 11, color: "var(--t3)" }}>{formatDate(r.date_demande)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}

                  {/* FACTURES */}
                  {activeClientTab === "factures" && (
                    <div>
                      {isAdmin && (
                        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setShowFactureForm((v) => !v)}
                            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border-blue)", background: "var(--blue-dim)", color: "#93C5FD" }}
                          >
                            {showFactureForm ? "Annuler" : "+ Nouvelle facture"}
                          </button>
                        </div>
                      )}
                      {isAdmin && showFactureForm && (
                        <form onSubmit={handleCreateFacture} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12, background: "rgba(147,197,253,0.03)" }}>
                          <SectionTitle>Nouvelle facture pour {selectedClient?.prenom} {selectedClient?.nom}</SectionTitle>
                          <div className="lb-form-grid">
                            <Field label="Fournisseur *">
                              <input required value={factureForm.fournisseur} onChange={(e) => setFactureForm((f) => ({ ...f, fournisseur: e.target.value }))} placeholder="Hydro-Québec" style={iStyle()} />
                            </Field>
                            <Field label="Référence *">
                              <input required value={factureForm.reference_facture} onChange={(e) => setFactureForm((f) => ({ ...f, reference_facture: e.target.value }))} placeholder="HQ-2026-001" style={iStyle()} />
                            </Field>
                            <Field label="Montant (CAD) *">
                              <input type="number" step="0.01" min="0.01" required value={factureForm.montant} onChange={(e) => setFactureForm((f) => ({ ...f, montant: e.target.value }))} placeholder="145.78" style={iStyle()} />
                            </Field>
                            <Field label="Statut">
                              <select value={factureForm.statut} onChange={(e) => setFactureForm((f) => ({ ...f, statut: e.target.value }))} style={sStyle()}>
                                <option value="IMPAYEE">IMPAYEE</option>
                                <option value="A_VENIR">A_VENIR</option>
                                <option value="PAYEE">PAYEE</option>
                              </select>
                            </Field>
                            <Field label="Date d'émission *">
                              <input type="date" required value={factureForm.date_emission} onChange={(e) => setFactureForm((f) => ({ ...f, date_emission: e.target.value }))} style={iStyle()} />
                            </Field>
                            <Field label="Date d'échéance *">
                              <input type="date" required value={factureForm.date_echeance} onChange={(e) => setFactureForm((f) => ({ ...f, date_echeance: e.target.value }))} style={iStyle()} />
                            </Field>
                          </div>
                          <Field label="Description">
                            <input value={factureForm.description} onChange={(e) => setFactureForm((f) => ({ ...f, description: e.target.value }))} placeholder="Facture d'électricité — mars 2026" style={iStyle()} />
                          </Field>
                          <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            Créer la facture
                          </button>
                        </form>
                      )}
                      <div className="lb-table-scroll"><table className="lb-table" style={{ width: "100%" }}>
                        <thead><tr>
                          <th style={{ paddingLeft: 20 }}>ID</th>
                          <th>Fournisseur</th>
                          <th>Référence</th>
                          <th style={{ textAlign: "right" }}>Montant</th>
                          <th>Statut</th>
                          <th>Compte payeur</th>
                          <th style={{ paddingRight: 20 }}>Échéance</th>
                        </tr></thead>
                        <tbody>
                          {ops.factures.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Aucune facture.</td></tr>}
                          {ops.factures.map((f: any) => (
                            <tr key={f.id}>
                              <td style={{ paddingLeft: 20, color: "var(--t2)", fontWeight: 600 }}>#{f.id}</td>
                              <td style={{ fontSize: 13 }}>{f.fournisseur}</td>
                              <td className="type-mono" style={{ fontSize: 11 }}>{f.reference_facture}</td>
                              <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#93C5FD" }}>{formatMoney(f.montant)}</td>
                              <td><StatutBadge statut={f.statut} /></td>
                              <td style={{ fontSize: 11, color: "var(--t3)" }}>{f.compte_paiement_numero || "—"}</td>
                              <td style={{ paddingRight: 20, fontSize: 11, color: "var(--t3)" }}>{formatDate(f.date_echeance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  )}

                  {/* CARTES */}
                  {activeClientTab === "cartes" && (
                    <div>
                      {isAdmin && (
                        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setShowCarteForm((v) => !v)}
                            style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border-blue)", background: "var(--blue-dim)", color: "#93C5FD" }}
                          >
                            {showCarteForm ? "Annuler" : "+ Nouvelle carte"}
                          </button>
                        </div>
                      )}
                      {isAdmin && showCarteForm && (
                        <form onSubmit={handleCreateCarte} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12, background: "rgba(147,197,253,0.03)" }}>
                          <SectionTitle>Nouvelle carte pour {selectedClient?.prenom} {selectedClient?.nom}</SectionTitle>
                          <div className="lb-form-grid">
                            <Field label="Réseau *">
                              <select required value={carteForm.type_carte} onChange={(e) => setCarteForm((f) => ({ ...f, type_carte: e.target.value }))} style={sStyle()}>
                                <option value="VISA">Visa</option>
                                <option value="MASTERCARD">Mastercard</option>
                              </select>
                            </Field>
                            <Field label="4 derniers chiffres (optionnel)">
                              <input maxLength={4} pattern="\d{4}" value={carteForm.last_four} onChange={(e) => setCarteForm((f) => ({ ...f, last_four: e.target.value }))} placeholder="4242" style={iStyle()} />
                            </Field>
                            <Field label="Limite de crédit (CAD) *">
                              <input type="number" step="0.01" min="0.01" required value={carteForm.limite_credit} onChange={(e) => setCarteForm((f) => ({ ...f, limite_credit: e.target.value }))} placeholder="5000" style={iStyle()} />
                            </Field>
                            <Field label="Date d'expiration *">
                              <input required value={carteForm.date_expiration} onChange={(e) => setCarteForm((f) => ({ ...f, date_expiration: e.target.value }))} placeholder="2028-12-31" style={iStyle()} />
                            </Field>
                          </div>
                          <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            Émettre la carte
                          </button>
                        </form>
                      )}
                      <div className="lb-table-scroll"><table className="lb-table" style={{ width: "100%" }}>
                        <thead><tr>
                          <th style={{ paddingLeft: 20 }}>ID</th>
                          <th>Type</th>
                          <th>Numéro</th>
                          <th style={{ textAlign: "right" }}>Limite</th>
                          <th style={{ textAlign: "right" }}>Utilisé</th>
                          <th>Statut</th>
                          <th>Expiration</th>
                          {isAdmin && <th style={{ paddingRight: 20 }}>Actions</th>}
                        </tr></thead>
                        <tbody>
                          {ops.cartes.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} style={{ textAlign: "center", padding: 24, color: "var(--t3)" }}>Aucune carte.</td></tr>}
                          {ops.cartes.map((c: any) => (
                            <React.Fragment key={c.id}>
                              <tr>
                                <td style={{ paddingLeft: 20, color: "var(--t2)", fontWeight: 600 }}>#{c.id}</td>
                                <td><span className="lb-badge lb-badge-muted">{c.type_carte}</span></td>
                                <td className="type-mono" style={{ fontSize: 12 }}>**** {c.numero_compte.slice(-4)}</td>
                                <td className="type-mono" style={{ textAlign: "right", color: "#93C5FD" }}>{formatMoney(c.limite_credit)}</td>
                                <td className="type-mono" style={{ textAlign: "right", color: Number(c.solde_utilise) > 0 ? "#FCA5A5" : "var(--t3)" }}>{formatMoney(c.solde_utilise)}</td>
                                <td><StatutBadge statut={c.statut} /></td>
                                <td style={{ fontSize: 11, color: "var(--t3)" }}>{formatDate(c.date_expiration)}</td>
                                {isAdmin && (
                                  <td style={{ paddingRight: 20 }}>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {c.statut === "ACTIVE" && (
                                        <button onClick={() => handleBloquerCarte(c.id)} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5" }}>
                                          Bloquer
                                        </button>
                                      )}
                                      {c.statut === "BLOQUEE" && (
                                        <button onClick={() => handleActiverCarte(c.id)} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.15)", color: "#6EE7B7" }}>
                                          Activer
                                        </button>
                                      )}
                                      {c.statut === "ACTIVE" && (
                                        <button onClick={() => handleGelerCarte(c.id)} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.15)", color: "#A5B4FC" }}>
                                          Geler
                                        </button>
                                      )}
                                      {c.statut === "GELEE" && (
                                        <button onClick={() => handleDegelerCarte(c.id)} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.15)", color: "#6EE7B7" }}>
                                          Dégeler
                                        </button>
                                      )}
                                      {c.statut !== "EXPIREE" && (
                                        <button
                                          onClick={() => { setSelectedCarteId(selectedCarteId === c.id ? null : c.id); setSelectedCarteSoldeId(null); setLimiteForm({ limite_credit: "" }); }}
                                          style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: selectedCarteId === c.id ? "var(--blue-dim)" : "transparent", color: selectedCarteId === c.id ? "#93C5FD" : "var(--t3)" }}
                                        >
                                          Limite
                                        </button>
                                      )}
                                      <button
                                        onClick={() => { setSelectedCarteSoldeId(selectedCarteSoldeId === c.id ? null : c.id); setSelectedCarteId(null); setSoldeCarteInputs((cur) => ({ ...cur, [c.id]: "" })); }}
                                        style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: selectedCarteSoldeId === c.id ? "var(--blue-dim)" : "transparent", color: selectedCarteSoldeId === c.id ? "#93C5FD" : "var(--t3)" }}
                                      >
                                        Solde
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {isAdmin && selectedCarteId === c.id && (
                                <tr>
                                  <td colSpan={8} style={{ padding: 0 }}>
                                    <form onSubmit={(e) => handleModifierLimite(e, c.id)} style={{ padding: "12px 20px", background: "rgba(147,197,253,0.03)", borderTop: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-end" }}>
                                      <Field label="Nouvelle limite (CAD) *">
                                        <input type="number" step="0.01" min="0.01" required value={limiteForm.limite_credit} onChange={(e) => setLimiteForm({ limite_credit: e.target.value })} placeholder="8000.00" style={{ ...iStyle(), width: 180 }} />
                                      </Field>
                                      <button type="submit" style={{ padding: "9px 16px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                                        Modifier
                                      </button>
                                      <button type="button" onClick={() => setSelectedCarteId(null)} style={{ padding: "9px 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t3)", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                                        Annuler
                                      </button>
                                    </form>
                                  </td>
                                </tr>
                              )}
                              {isAdmin && selectedCarteSoldeId === c.id && (
                                <tr>
                                  <td colSpan={8} style={{ padding: 0 }}>
                                    <form onSubmit={(e) => handleModifierSoldeCarte(e, c.id)} style={{ padding: "12px 20px", background: "rgba(147,197,253,0.03)", borderTop: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-end" }}>
                                      <Field label="Solde utilisé (CAD) *">
                                        <input type="number" step="0.01" min="0" required value={soldeCarteInputs[c.id] ?? ""} onChange={(e) => setSoldeCarteInputs((cur) => ({ ...cur, [c.id]: e.target.value }))} placeholder={`actuel : ${formatMoney(c.solde_utilise)}`} style={{ ...iStyle(), width: 220 }} />
                                      </Field>
                                      <button type="submit" style={{ padding: "9px 16px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                                        Modifier
                                      </button>
                                      <button type="button" onClick={() => setSelectedCarteSoldeId(null)} style={{ padding: "9px 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t3)", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                                        Annuler
                                      </button>
                                    </form>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table></div>
                    </div>
                  )}

                  {/* INTERAC */}
                  {activeClientTab === "interac" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

                      {loadingInterac ? (
                        <p style={{ padding: 24, fontSize: 13, color: "var(--t3)" }} className="lb-loading">Chargement Interac…</p>
                      ) : (
                        <>
                          {/* ── Limites utilisées ── */}
                          {interacStats && (
                            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
                                  Limites d'envoi utilisées
                                </p>
                                {isAdmin && !editingLimites && (
                                  <button
                                    onClick={() => { setEditingLimites(true); setLimitesForm({ limite_24h: interacLimites?.limite_24h !== null && interacLimites?.limite_24h !== undefined ? String(interacLimites.limite_24h) : "", limite_7j: interacLimites?.limite_7j !== null && interacLimites?.limite_7j !== undefined ? String(interacLimites.limite_7j) : "", limite_30j: interacLimites?.limite_30j !== null && interacLimites?.limite_30j !== undefined ? String(interacLimites.limite_30j) : "" }); }}
                                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--t3)" }}
                                  >
                                    Modifier les limites
                                  </button>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                {[
                                  { label: "24 heures", used: Number(interacStats.total_24h), max: interacLimites?.limite_24h ?? 3000,  custom: interacLimites?.limite_24h !== null && interacLimites?.limite_24h !== undefined },
                                  { label: "7 jours",   used: Number(interacStats.total_7j),  max: interacLimites?.limite_7j  ?? 10000, custom: interacLimites?.limite_7j  !== null && interacLimites?.limite_7j  !== undefined },
                                  { label: "30 jours",  used: Number(interacStats.total_30j), max: interacLimites?.limite_30j ?? 20000, custom: interacLimites?.limite_30j !== null && interacLimites?.limite_30j !== undefined },
                                ].map(({ label, used, max, custom }) => {
                                  const pct = Math.min(100, (used / max) * 100);
                                  const color = pct >= 90 ? "#FCA5A5" : pct >= 60 ? "#FCD34D" : "#6EE7B7";
                                  return (
                                    <div key={label} style={{ flex: "1 1 160px", background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${custom ? "rgba(139,92,246,0.3)" : "var(--border)"}` }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                                        {custom && <span style={{ fontSize: 9, color: "var(--stripe-purple)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Perso</span>}
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                                        {used.toFixed(0)} $ / {(max as number).toLocaleString()} $
                                      </span>
                                      <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden", marginTop: 6 }}>
                                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 400ms ease" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* ── Formulaire modification des limites ── */}
                              {isAdmin && editingLimites && (
                                <form onSubmit={handleSaveLimites} style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                                  {[
                                    { key: "limite_24h" as const, label: "Plafond 24 h ($)", placeholder: "3000 (défaut)" },
                                    { key: "limite_7j"  as const, label: "Plafond 7 j ($)",  placeholder: "10000 (défaut)" },
                                    { key: "limite_30j" as const, label: "Plafond 30 j ($)", placeholder: "20000 (défaut)" },
                                  ].map(({ key, label, placeholder }) => (
                                    <div key={key}>
                                      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</label>
                                      <input
                                        type="number" min="1" step="0.01"
                                        value={limitesForm[key]}
                                        onChange={(e) => setLimitesForm((f) => ({ ...f, [key]: e.target.value }))}
                                        placeholder={placeholder}
                                        style={iStyle({ width: 160 })}
                                      />
                                    </div>
                                  ))}
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button type="submit" style={{ padding: "9px 14px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Enregistrer</button>
                                    <button type="button" onClick={() => setEditingLimites(false)} style={{ padding: "9px 14px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                                  </div>
                                </form>
                              )}
                            </div>
                          )}

                          {/* ── Auto-dépôt ── */}
                          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)" }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
                              Auto-dépôt Interac
                            </p>
                            {interacAutoDeposit?.statut === "ACTIVE" ? (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                                  <div>
                                    <p style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Email Interac</p>
                                    <p style={{ fontSize: 13, color: "var(--t1)", fontWeight: 600 }}>{interacAutoDeposit.email_interac}</p>
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Compte de dépôt</p>
                                    <p style={{ fontSize: 12, color: "var(--t2)", fontFamily: "monospace" }}>{interacAutoDeposit.numero_compte} <span style={{ color: "var(--t3)" }}>({interacAutoDeposit.type_compte})</span></p>
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Statut</p>
                                    <span className="lb-badge lb-badge-green">Actif</span>
                                  </div>
                                </div>
                                {isAdmin && (
                                  <button
                                    onClick={handleDesactiverAD}
                                    style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5" }}
                                  >
                                    Désactiver
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>
                                  {interacAutoDeposit?.statut === "EN_ATTENTE"
                                    ? "Profil en attente de confirmation — l'admin peut forcer l'activation."
                                    : "Aucun profil auto-dépôt enregistré pour ce client."}
                                </p>
                                {isAdmin && (
                                  <form onSubmit={handleForceActiverAD} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                                    <div>
                                      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                                        Email Interac *
                                      </label>
                                      <input
                                        required type="email"
                                        value={interacAdForm.email_interac}
                                        onChange={(e) => setInteracAdForm((f) => ({ ...f, email_interac: e.target.value }))}
                                        placeholder="client@exemple.com"
                                        style={iStyle({ width: 220 })}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                                        Compte de dépôt (ID) *
                                      </label>
                                      <select
                                        required
                                        value={interacAdForm.compte_depot_id}
                                        onChange={(e) => setInteracAdForm((f) => ({ ...f, compte_depot_id: e.target.value }))}
                                        style={sStyle()}
                                      >
                                        <option value="">— Choisir —</option>
                                        {ops?.comptes.map((c: any) => (
                                          <option key={c.id} value={c.id}>
                                            #{c.id} — {c.type_compte} {c.numero_compte}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <button
                                      type="submit"
                                      style={{ padding: "9px 16px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                                    >
                                      Forcer l'activation
                                    </button>
                                  </form>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── Historique transferts ── */}
                          <div>
                            <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Historique Interac</p>
                              <span className="lb-badge lb-badge-muted">{interacTransferts.length} ligne{interacTransferts.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="lb-table-scroll">
                              <table className="lb-table" style={{ width: "100%" }}>
                                <thead>
                                  <tr>
                                    <th style={{ paddingLeft: 24 }}>ID</th>
                                    <th>Date</th>
                                    <th>Expéditeur</th>
                                    <th>Destinataire</th>
                                    <th style={{ textAlign: "right" }}>Montant</th>
                                    <th>Statut</th>
                                    <th>Expiration</th>
                                    {isAdmin && <th style={{ paddingRight: 24 }}>Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {interacTransferts.length === 0 && (
                                    <tr><td colSpan={isAdmin ? 8 : 7} style={{ textAlign: "center", padding: 24, color: "var(--t3)", fontSize: 13 }}>Aucun virement Interac.</td></tr>
                                  )}
                                  {interacTransferts.map((t: any) => {
                                    const statutColor = t.statut === "ACCEPTEE" ? "#6EE7B7" : t.statut === "EN_ATTENTE" ? "#FCD34D" : "var(--t3)";
                                    const statutBadge = t.statut === "ACCEPTEE"
                                      ? <span className="lb-badge lb-badge-green">Acceptée</span>
                                      : t.statut === "ANNULEE" || t.statut === "EXPIREE"
                                      ? <span className="lb-badge lb-badge-red">{t.statut === "ANNULEE" ? "Annulée" : "Expirée"}</span>
                                      : <span className="lb-badge lb-badge-amber">En attente</span>;
                                    return (
                                      <tr key={t.id}>
                                        <td style={{ paddingLeft: 24, fontWeight: 600, color: "var(--t2)" }}>#{t.id}</td>
                                        <td style={{ fontSize: 12, color: "var(--t3)" }}>{new Date(t.date_envoi).toLocaleDateString("fr-CA")}</td>
                                        <td>
                                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{t.expediteur_nom}</p>
                                          <p style={{ fontSize: 11, color: "var(--t3)" }}>{t.expediteur_email}</p>
                                        </td>
                                        <td style={{ fontSize: 12, color: "var(--t2)" }}>{t.email_destinataire}</td>
                                        <td style={{ textAlign: "right", fontWeight: 700, color: statutColor, fontVariantNumeric: "tabular-nums" }}>
                                          {Number(t.montant).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                        </td>
                                        <td>{statutBadge}</td>
                                        <td style={{ fontSize: 11, color: "var(--t3)" }}>
                                          {t.statut === "EN_ATTENTE" ? new Date(t.date_expiration).toLocaleDateString("fr-CA") : "—"}
                                        </td>
                                        {isAdmin && (
                                          <td style={{ paddingRight: 24 }}>
                                            {t.statut === "EN_ATTENTE" && (
                                              <button
                                                onClick={() => handleCancelInterac(t.id)}
                                                style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5" }}
                                              >
                                                Annuler
                                              </button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* SIMULATION */}
                  {activeClientTab === "simulation" && isAdmin && (
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

                      {/* Liste des snapshots */}
                      {loadingSnaps ? (
                        <p className="lb-loading" style={{ fontSize: 13, color: "var(--t3)" }}>Chargement…</p>
                      ) : snapshots.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--t3)", textAlign: "center", padding: "20px 0" }}>
                          Aucun snapshot — créez-en un ci-dessous avant de modifier les données.
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {snapshots.map(snap => (
                            <div key={snap.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: snap.est_initial ? "var(--blue-dim)" : "var(--surface-2)" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{snap.nom}</span>
                                  {snap.est_initial === 1 && <span className="lb-badge lb-badge-info" style={{ fontSize: 10, padding: "1px 6px" }}>Initial</span>}
                                </div>
                                {snap.description && <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 3 }}>{snap.description}</p>}
                                <p style={{ fontSize: 11, color: "var(--t3)" }}>
                                  {new Date(snap.cree_le).toLocaleString("fr-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  {" · "}{snap.cree_par_email}
                                </p>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button
                                  onClick={() => setSnapRestoreTarget(snap)}
                                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border-blue, rgba(59,130,246,0.3))", background: "var(--blue-dim)", color: "#93C5FD" }}
                                >
                                  Restaurer
                                </button>
                                {snap.est_initial === 0 && (
                                  <button
                                    onClick={() => setSnapDeleteTarget(snap)}
                                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5" }}
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulaire de création */}
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", marginBottom: 10 }}>Sauvegarder l'état actuel</p>
                        {snapCreateErr && <div className="lb-alert-error" style={{ marginBottom: 10 }}>{snapCreateErr}</div>}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            placeholder="Nom du snapshot *"
                            value={snapNom}
                            onChange={e => setSnapNom(e.target.value)}
                            maxLength={100}
                            style={{ flex: "1 1 180px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--t1)", fontSize: 13, outline: "none" }}
                          />
                          <input
                            placeholder="Description (optionnel)"
                            value={snapDesc}
                            onChange={e => setSnapDesc(e.target.value)}
                            maxLength={255}
                            style={{ flex: "2 1 200px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--t1)", fontSize: 13, outline: "none" }}
                          />
                          <button
                            disabled={snapCreateLoad}
                            onClick={async () => {
                              setSnapCreateErr(null);
                              if (!snapNom.trim()) { setSnapCreateErr("Le nom est obligatoire."); return; }
                              setSnapCreateLoad(true);
                              try {
                                const r = await fetch("/api/simulation/snapshots", {
                                  method: "POST", credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ clientId: selectedClient!.id, nom: snapNom.trim(), description: snapDesc.trim() || undefined }),
                                });
                                const data = await r.json();
                                if (!r.ok) throw new Error(data.message);
                                setSnapNom(""); setSnapDesc("");
                                notify("ok", `Snapshot "${snapNom.trim()}" créé.`);
                                await loadSnapshots(selectedClient!.id);
                              } catch (e: any) { setSnapCreateErr(e.message ?? "Erreur"); }
                              finally { setSnapCreateLoad(false); }
                            }}
                            style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border-blue, rgba(59,130,246,0.3))", background: "var(--blue-dim)", color: "#93C5FD", whiteSpace: "nowrap" }}
                          >
                            {snapCreateLoad ? "Capture…" : "📸 Sauvegarder"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 14, color: "var(--t3)" }}>← Sélectionnez un client pour voir ses opérations</p>
          </div>
        )}
      </div>

      {/* Modal — Toggle statut compte */}
      {toggleConfirm && selectedCompte && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="lb-card" style={{ padding: "28px 32px", maxWidth: 420, width: "90%" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>
              {selectedCompte.est_actif ? "Bloquer" : "Débloquer"} le compte ?
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              Compte #{selectedCompte.id} — {selectedCompte.numero_compte}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setToggleConfirm(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={confirmToggleStatus} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Supprimer transaction */}
      {deleteTxId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="lb-card" style={{ padding: "28px 32px", maxWidth: 380, width: "90%" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>Supprimer la transaction ?</p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>Transaction #{deleteTxId} — action irréversible.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTxId(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={confirmDeleteTransaction} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Restaurer snapshot */}
      {snapRestoreTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }}
          onClick={e => { if (e.target === e.currentTarget) setSnapRestoreTarget(null); }}
        >
          <div className="lb-card" style={{ padding: "28px 28px 24px", maxWidth: 440, width: "100%" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>
              Restaurer « {snapRestoreTarget.nom} » ?
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 12 }}>
              Les données de <strong>{selectedClient?.prenom} {selectedClient?.nom}</strong> (comptes, transactions,
              virements, factures, cartes…) seront remplacées par celles capturées dans ce snapshot.
            </p>
            {snapRestoreTarget.est_initial === 1 && (
              <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "var(--red-dim)", fontSize: 13, color: "#FCA5A5", marginBottom: 12 }}>
                ⚠ Vous restaurez l&apos;<strong>état initial (seed)</strong>. Toutes les modifications seront perdues.
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 20 }}>Cette action est irréversible (sauf autre snapshot).</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setSnapRestoreTarget(null)} disabled={snapActionLoad}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button disabled={snapActionLoad} onClick={async () => {
                setSnapActionLoad(true);
                try {
                  const r = await fetch(`/api/simulation/snapshots/${snapRestoreTarget.id}/restaurer`, { method: "POST", credentials: "include" });
                  const data = await r.json();
                  if (!r.ok) throw new Error(data.message);
                  notify("ok", `Données restaurées vers « ${snapRestoreTarget.nom} ».`);
                  setSnapRestoreTarget(null);
                  await loadOps(selectedClient!.id);
                } catch (e: any) { notify("err", e.message ?? "Erreur"); setSnapRestoreTarget(null); }
                finally { setSnapActionLoad(false); }
              }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)", background: "var(--blue-dim)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {snapActionLoad ? "Restauration…" : "Restaurer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Supprimer snapshot */}
      {snapDeleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 16px" }}
          onClick={e => { if (e.target === e.currentTarget) setSnapDeleteTarget(null); }}
        >
          <div className="lb-card" style={{ padding: "28px 28px 24px", maxWidth: 400, width: "100%" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>
              Supprimer « {snapDeleteTarget.nom} » ?
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
              Ce snapshot sera définitivement supprimé. Vous ne pourrez plus restaurer les données à cet état.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setSnapDeleteTarget(null)} disabled={snapActionLoad}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button disabled={snapActionLoad} onClick={async () => {
                setSnapActionLoad(true);
                try {
                  const r = await fetch(`/api/simulation/snapshots/${snapDeleteTarget.id}`, { method: "DELETE", credentials: "include" });
                  const data = await r.json();
                  if (!r.ok) throw new Error(data.message);
                  notify("ok", "Snapshot supprimé.");
                  setSnapDeleteTarget(null);
                  await loadSnapshots(selectedClient!.id);
                } catch (e: any) { notify("err", e.message ?? "Erreur"); setSnapDeleteTarget(null); }
                finally { setSnapActionLoad(false); }
              }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {snapActionLoad ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
