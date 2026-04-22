"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete, apiDownloadCSV } from "@/lib/api";
import type { Account, Transaction } from "@/lib/types";

/* ── Types locaux ────────────────────────────────── */
type AccountWithClient = Account & { client_prenom?: string; client_nom?: string };

type Tab = "balance" | "type" | "transactions" | "virements" | "transfer";

const TYPES_COMPTE = ["CHEQUES", "EPARGNE", "CREDIT"] as const;
const TYPES_TX = ["DEPOT", "RETRAIT", "VIREMENT", "PAIEMENT", "REMBOURSEMENT"] as const;
const STATUTS_VIREMENT = ["ACCEPTE", "REFUSE", "EN_ATTENTE"] as const;

/* ── Sous-composants ─────────────────────────────── */
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

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "9px 12px", color: "var(--t1)", fontSize: 13, outline: "none", width: "100%",
    ...extra,
  };
}

function selectStyle(): React.CSSProperties {
  return { ...inputStyle(), cursor: "pointer" };
}

/* ── Page principale ─────────────────────────────── */
export default function AdminComptesPage() {
  const { user } = useAuth();

  const [comptes, setComptes] = useState<AccountWithClient[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AccountWithClient | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("balance");
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState(false);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);

  // Formulaires
  const [balanceForm, setBalanceForm] = useState({ montant: "", motif: "", type_transaction: "DEPOT" });
  const [typeForm, setTypeForm] = useState({ type_compte: "CHEQUES" });
  const [txForm, setTxForm] = useState({ type_transaction: "DEPOT", description: "", montant: "", statut: "TERMINEE", ajuster_solde: true });
  const [virForm, setVirForm] = useState({ src_numero: "", src_institution: "", src_transit: "", dest_numero: "", dest_institution: "", dest_transit: "", montant: "", description: "", statut: "ACCEPTE", ajuster_soldes: true });
  const [transferForm, setTransferForm] = useState({ dest_numero: "", dest_institution: "", dest_transit: "", montant: "", description: "" });

  const notify = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadComptes = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: AccountWithClient[] }>(`/comptes?search=${encodeURIComponent(search)}`);
      setComptes(res.data);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
    finally { setLoading(false); }
  };

  const loadTransactions = async (compteId: number) => {
    setLoadingTx(true);
    try {
      const res = await apiGet<{ data: Transaction[] }>(`/comptes/${compteId}/transactions`);
      setTransactions(res.data);
    } catch { setTransactions([]); }
    finally { setLoadingTx(false); }
  };

  useEffect(() => { if (user?.role === "ADMIN") loadComptes(); }, []);

  const selectCompte = (c: AccountWithClient) => {
    setSelected(c);
    setActiveTab("balance");
    setMsg(null);
    loadTransactions(c.id);
  };

  const refreshSelected = async () => {
    if (!selected) return;
    await loadComptes();
    await loadTransactions(selected.id);
    // Recharger le compte sélectionné depuis la liste fraîche
    try {
      const res = await apiGet<{ data: AccountWithClient[] }>(`/comptes?search=${encodeURIComponent(search)}`);
      setComptes(res.data);
      const updated = res.data.find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    } catch {}
  };

  /* ── Actions ──────────────────────────────────── */

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await apiPatch<{ message: string; nouveau_solde: number }>(
        `/admin/comptes/${selected.id}/balance`,
        balanceForm
      );
      notify("ok", `${res.message} — nouveau solde: ${Number(res.nouveau_solde).toFixed(2)} CAD`);
      setBalanceForm({ montant: "", motif: "", type_transaction: "DEPOT" });
      refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleToggleStatus = () => {
    if (!selected) return;
    setToggleConfirm(true);
  };

  const confirmToggleStatus = async () => {
    if (!selected) return;
    setToggleConfirm(false);
    try {
      const res = await apiPatch<{ message: string }>(`/admin/comptes/${selected.id}/status`, {});
      notify("ok", res.message);
      refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleChangeType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await apiPatch<{ message: string }>(`/admin/comptes/${selected.id}/type`, typeForm);
      notify("ok", res.message);
      refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await apiPost<{ message: string; id: number }>(
        `/admin/comptes/${selected.id}/transactions`,
        txForm
      );
      notify("ok", `${res.message} (id: ${res.id})`);
      setTxForm({ type_transaction: "DEPOT", description: "", montant: "", statut: "TERMINEE", ajuster_solde: true });
      refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleDeleteTransaction = (txId: number) => {
    setDeleteTxId(txId);
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteTxId) return;
    const txId = deleteTxId;
    setDeleteTxId(null);
    try {
      const res = await apiDelete<{ message: string }>(`/admin/transactions/${txId}`);
      notify("ok", res.message);
      refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleAddVirement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        numero_compte_source: virForm.src_numero, numero_institution_source: virForm.src_institution, numero_transit_source: virForm.src_transit,
        numero_compte_dest: virForm.dest_numero,  numero_institution_dest: virForm.dest_institution,  numero_transit_dest: virForm.dest_transit,
        montant: virForm.montant, description: virForm.description, statut: virForm.statut, ajuster_soldes: virForm.ajuster_soldes,
      };
      const res = await apiPost<{ message: string; id: number }>("/admin/virements", body);
      notify("ok", `${res.message} (id: ${res.id})`);
      setVirForm({ src_numero: "", src_institution: "", src_transit: "", dest_numero: "", dest_institution: "", dest_transit: "", montant: "", description: "", statut: "ACCEPTE", ajuster_soldes: true });
      if (selected) refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleForceTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const body = {
        compte_source_id: selected.id,
        numero_compte_dest: transferForm.dest_numero,
        numero_institution_dest: transferForm.dest_institution,
        numero_transit_dest: transferForm.dest_transit,
        montant: transferForm.montant,
        description: transferForm.description,
      };
      const res = await apiPost<{ message: string; id: number }>("/admin/virements/force", body);
      notify("ok", `${res.message} (virement #${res.id})`);
      setTransferForm({ dest_numero: "", dest_institution: "", dest_transit: "", montant: "", description: "" });
      refreshSelected();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  /* ── Guards ──────────────────────────────────── */
  if (user?.role !== "ADMIN") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <p style={{ color: "var(--t3)" }}>Section réservée à l'administrateur.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "balance", label: "Solde" },
    { id: "type", label: "Type / Statut" },
    { id: "transactions", label: "Transactions" },
    { id: "virements", label: "Virements" },
    { id: "transfer", label: "Transfert forcé" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <p className="type-label" style={{ marginBottom: 4 }}>Contrôle des comptes</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Gestion des comptes</h1>
        <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
          Contrôle intégral — ajustement de solde, transactions, virements, blocage.
        </p>
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "lb-alert-success" : "lb-alert-error"}>
          {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Liste des comptes ─────────────────── */}
        <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input
              placeholder="Rechercher un compte…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadComptes()}
              style={{ ...inputStyle(), flex: 1 }}
            />
            <button
              onClick={loadComptes}
              style={{ padding: "8px 14px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {loading ? "…" : "Chercher"}
            </button>
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {comptes.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCompte(c)}
                style={{
                  padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: selected?.id === c.id ? "var(--blue-dim)" : "transparent",
                  transition: "background 120ms",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
                      {c.client_prenom} {c.client_nom}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--t3)" }}>#{c.id} · {c.numero_compte} · {c.type_compte}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
                      {Number(c.solde).toFixed(2)} $
                    </p>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      background: c.est_actif ? "var(--green-dim, rgba(16,185,129,0.15))" : "var(--red-dim)",
                      color: c.est_actif ? "#6EE7B7" : "#FCA5A5",
                    }}>
                      {c.est_actif ? "Actif" : "Bloqué"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {!loading && comptes.length === 0 && (
              <p style={{ padding: 20, fontSize: 13, color: "var(--t3)", textAlign: "center" }}>
                Aucun compte. Lancez une recherche.
              </p>
            )}
          </div>
        </div>

        {/* ── Panneau de contrôle ───────────────── */}
        {selected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Info compte */}
            <div className="lb-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>
                    {selected.client_prenom} {selected.client_nom}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t3)" }}>
                    Compte #{selected.id} · {selected.numero_compte} · {selected.type_compte} · {selected.devise}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>
                      {Number(selected.solde).toFixed(2)} $
                    </p>
                    <span style={{ fontSize: 11 }}>Solde actuel</span>
                  </div>
                  <button
                    onClick={handleToggleStatus}
                    style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: selected.est_actif ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(16,185,129,0.3)",
                      background: selected.est_actif ? "var(--red-dim)" : "rgba(16,185,129,0.15)",
                      color: selected.est_actif ? "#FCA5A5" : "#6EE7B7",
                    }}
                  >
                    {selected.est_actif ? "Bloquer" : "Débloquer"}
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: "8px 14px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: "1px solid var(--border)", borderBottom: activeTab === t.id ? "1px solid var(--bg)" : "1px solid var(--border)",
                    background: activeTab === t.id ? "var(--surface-2)" : "transparent",
                    color: activeTab === t.id ? "var(--t1)" : "var(--t3)",
                    marginBottom: activeTab === t.id ? -1 : 0,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="lb-card" style={{ padding: "20px 24px" }}>

              {/* Onglet Solde */}
              {activeTab === "balance" && (
                <form onSubmit={handleAdjustBalance} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <SectionTitle>Ajuster le solde (+ pour crédit, - pour débit)</SectionTitle>
                  <Field label="Montant (ex: 100 ou -50)">
                    <input
                      type="number" step="0.01" required
                      value={balanceForm.montant}
                      onChange={(e) => setBalanceForm((f) => ({ ...f, montant: e.target.value }))}
                      placeholder="+100.00 ou -50.00"
                      style={inputStyle()}
                    />
                  </Field>
                  <Field label="Type de transaction">
                    <select value={balanceForm.type_transaction}
                      onChange={(e) => setBalanceForm((f) => ({ ...f, type_transaction: e.target.value }))}
                      style={selectStyle()}>
                      {TYPES_TX.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Motif (optionnel)">
                    <input value={balanceForm.motif}
                      onChange={(e) => setBalanceForm((f) => ({ ...f, motif: e.target.value }))}
                      placeholder="Correction, bonus, pénalité…"
                      style={inputStyle()}
                    />
                  </Field>
                  <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Appliquer l'ajustement
                  </button>
                </form>
              )}

              {/* Onglet Type / Statut */}
              {activeTab === "type" && (
                <form onSubmit={handleChangeType} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <SectionTitle>Changer le type de compte</SectionTitle>
                  <Field label="Nouveau type">
                    <select value={typeForm.type_compte}
                      onChange={(e) => setTypeForm({ type_compte: e.target.value })}
                      style={selectStyle()}>
                      {TYPES_COMPTE.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Modifier le type
                  </button>
                  <div style={{ marginTop: 8, padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 12, color: "var(--t2)" }}>
                      Bloquer / Débloquer le compte directement depuis le bouton en haut du panneau.
                    </p>
                  </div>
                </form>
              )}

              {/* Onglet Transactions */}
              {activeTab === "transactions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Formulaire d'insertion */}
                  <form onSubmit={handleAddTransaction} style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                    <SectionTitle>Insérer une transaction</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <Field label="Type">
                        <select value={txForm.type_transaction}
                          onChange={(e) => setTxForm((f) => ({ ...f, type_transaction: e.target.value }))}
                          style={selectStyle()}>
                          {TYPES_TX.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Statut">
                        <select value={txForm.statut}
                          onChange={(e) => setTxForm((f) => ({ ...f, statut: e.target.value }))}
                          style={selectStyle()}>
                          <option value="TERMINEE">TERMINEE</option>
                          <option value="EN_ATTENTE">EN_ATTENTE</option>
                        </select>
                      </Field>
                      <Field label="Montant (+ crédit, - débit)">
                        <input type="number" step="0.01" required
                          value={txForm.montant}
                          onChange={(e) => setTxForm((f) => ({ ...f, montant: e.target.value }))}
                          placeholder="ex: 200 ou -50"
                          style={inputStyle()}
                        />
                      </Field>
                      <Field label="Description (optionnel)">
                        <input value={txForm.description}
                          onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Note…"
                          style={inputStyle()}
                        />
                      </Field>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", cursor: "pointer" }}>
                      <input type="checkbox" checked={txForm.ajuster_solde}
                        onChange={(e) => setTxForm((f) => ({ ...f, ajuster_solde: e.target.checked }))} />
                      Ajuster automatiquement le solde du compte
                    </label>
                    <button type="submit" style={{ padding: "9px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Insérer la transaction
                    </button>
                  </form>

                  {/* Historique */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <SectionTitle>Historique des transactions</SectionTitle>
                      {selected && (
                        <button
                          onClick={() => apiDownloadCSV(`/export/transactions/${selected.id}`, `transactions-${selected.numero_compte}.csv`).catch(() => {})}
                          style={{ padding: "5px 10px", borderRadius: 6, background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)", color: "#6EE7B7", fontSize: 11, cursor: "pointer" }}
                        >
                          ⬇ CSV
                        </button>
                      )}
                    </div>
                    {loadingTx ? (
                      <p style={{ fontSize: 12, color: "var(--t3)" }}>Chargement…</p>
                    ) : transactions.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--t3)" }}>Aucune transaction.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
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

              {/* Onglet Virements */}
              {activeTab === "virements" && (
                <form onSubmit={handleAddVirement} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <SectionTitle>Insérer un virement</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="N° compte source *">
                      <input required value={virForm.src_numero} onChange={(e) => setVirForm((f) => ({ ...f, src_numero: e.target.value }))} placeholder="XXXX XXXX XXXX" style={inputStyle()} />
                    </Field>
                    <Field label="N° compte destination *">
                      <input required value={virForm.dest_numero} onChange={(e) => setVirForm((f) => ({ ...f, dest_numero: e.target.value }))} placeholder="XXXX XXXX XXXX" style={inputStyle()} />
                    </Field>
                    <Field label="Institution source *">
                      <input required value={virForm.src_institution} onChange={(e) => setVirForm((f) => ({ ...f, src_institution: e.target.value }))} placeholder="621" style={inputStyle()} />
                    </Field>
                    <Field label="Institution destination *">
                      <input required value={virForm.dest_institution} onChange={(e) => setVirForm((f) => ({ ...f, dest_institution: e.target.value }))} placeholder="621" style={inputStyle()} />
                    </Field>
                    <Field label="Transit source *">
                      <input required value={virForm.src_transit} onChange={(e) => setVirForm((f) => ({ ...f, src_transit: e.target.value }))} placeholder="10482" style={inputStyle()} />
                    </Field>
                    <Field label="Transit destination *">
                      <input required value={virForm.dest_transit} onChange={(e) => setVirForm((f) => ({ ...f, dest_transit: e.target.value }))} placeholder="23815" style={inputStyle()} />
                    </Field>
                    <Field label="Montant (> 0)">
                      <input type="number" step="0.01" min="0.01" required value={virForm.montant} onChange={(e) => setVirForm((f) => ({ ...f, montant: e.target.value }))} placeholder="200.00" style={inputStyle()} />
                    </Field>
                    <Field label="Statut">
                      <select value={virForm.statut} onChange={(e) => setVirForm((f) => ({ ...f, statut: e.target.value }))} style={selectStyle()}>
                        {STATUTS_VIREMENT.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Description (optionnel)">
                      <input value={virForm.description} onChange={(e) => setVirForm((f) => ({ ...f, description: e.target.value }))} placeholder="Note…" style={inputStyle()} />
                    </Field>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={virForm.ajuster_soldes} onChange={(e) => setVirForm((f) => ({ ...f, ajuster_soldes: e.target.checked }))} />
                    Ajuster les soldes + créer les transactions associées (si statut ACCEPTE)
                  </label>
                  <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Insérer le virement
                  </button>
                </form>
              )}

              {/* Onglet Transfert forcé */}
              {activeTab === "transfer" && (
                <form onSubmit={handleForceTransfer} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <SectionTitle>Transfert forcé depuis le compte #{selected.id} ({selected.numero_compte})</SectionTitle>
                  <p style={{ fontSize: 12, color: "var(--t2)" }}>
                    Débit immédiat du compte sélectionné. Aucune restriction de solde. Les transactions et le virement sont créés automatiquement.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="N° compte destination *">
                      <input required value={transferForm.dest_numero} onChange={(e) => setTransferForm((f) => ({ ...f, dest_numero: e.target.value }))} placeholder="XXXX XXXX XXXX" style={inputStyle()} />
                    </Field>
                    <Field label="Institution *">
                      <input required value={transferForm.dest_institution} onChange={(e) => setTransferForm((f) => ({ ...f, dest_institution: e.target.value }))} placeholder="621" style={inputStyle()} />
                    </Field>
                    <Field label="Transit *">
                      <input required value={transferForm.dest_transit} onChange={(e) => setTransferForm((f) => ({ ...f, dest_transit: e.target.value }))} placeholder="10482" style={inputStyle()} />
                    </Field>
                    <Field label="Montant (> 0)">
                      <input type="number" step="0.01" min="0.01" required value={transferForm.montant} onChange={(e) => setTransferForm((f) => ({ ...f, montant: e.target.value }))} placeholder="500.00" style={inputStyle()} />
                    </Field>
                  </div>
                  <Field label="Description (optionnel)">
                    <input value={transferForm.description} onChange={(e) => setTransferForm((f) => ({ ...f, description: e.target.value }))} placeholder="Motif du transfert…" style={inputStyle()} />
                  </Field>
                  <button type="submit" style={{ padding: "10px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#FCA5A5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Exécuter le transfert forcé
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 14, color: "var(--t3)" }}>← Sélectionnez un compte pour le gérer</p>
          </div>
        )}
      </div>

      {/* Modal confirmation blocage/déblocage compte */}
      {toggleConfirm && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              {selected.est_actif ? "Bloquer" : "Débloquer"} le compte #{selected.id}
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              {selected.numero_compte} — {selected.client_prenom} {selected.client_nom}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setToggleConfirm(false)} style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                Annuler
              </button>
              <button type="button" onClick={confirmToggleStatus} style={{ padding: "9px 16px", borderRadius: 8, background: selected.est_actif ? "var(--red-dim)" : "rgba(16,185,129,0.15)", border: selected.est_actif ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(16,185,129,0.3)", color: selected.est_actif ? "#FCA5A5" : "#6EE7B7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression transaction */}
      {deleteTxId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              Supprimer la transaction #{deleteTxId}
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              Le solde du compte sera reversé. Cette action est irréversible.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDeleteTxId(null)} style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                Annuler
              </button>
              <button type="button" onClick={confirmDeleteTransaction} style={{ padding: "9px 16px", borderRadius: 8, background: "var(--red-dim)", border: "1px solid rgba(220,38,38,0.3)", color: "#FCA5A5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
