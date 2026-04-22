"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Transaction, Account, TransactionRecurrente } from "@/lib/types";

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function formatMoney(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function formatDate(dateValue: string) {
  if (!dateValue) return "—";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleString("fr-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(dateValue: string) {
  if (!dateValue) return "—";
  const d = new Date(dateValue + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function TransactionTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    DEPOT: "lb-badge-green",
    RETRAIT: "lb-badge-red",
    VIREMENT: "lb-badge-blue",
    PAIEMENT: "lb-badge-amber",
    REMBOURSEMENT: "lb-badge-green",
    INTERAC_DEBIT: "lb-badge-red",
    INTERAC_CREDIT: "lb-badge-green",
  };
  return <span className={`lb-badge ${map[type] ?? "lb-badge-muted"}`}>{type.replace("_", " ")}</span>;
}

function StatutBadge({ statut }: { statut: TransactionRecurrente["statut"] }) {
  const map: Record<string, string> = {
    ACTIVE:    "lb-badge-green",
    SUSPENDUE: "lb-badge-amber",
    ANNULEE:   "lb-badge-red",
    TERMINEE:  "lb-badge-muted",
  };
  return <span className={`lb-badge ${map[statut] ?? "lb-badge-muted"}`}>{statut}</span>;
}

function FrequenceBadge({ frequence }: { frequence: string }) {
  const labels: Record<string, string> = {
    HEBDOMADAIRE: "Hebdo",
    MENSUEL: "Mensuel",
    ANNUEL: "Annuel",
  };
  return (
    <span className="lb-badge lb-badge-blue" style={{ fontVariantNumeric: "tabular-nums" }}>
      {labels[frequence] ?? frequence}
    </span>
  );
}

// ─── Icônes inline ────────────────────────────────────────────────────────────

const IconArrowLeft = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" width={16} height={16}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const IconRepeat = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" width={14} height={14}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4m14-2v2a4 4 0 01-4 4H3" />
  </svg>
);

const IconPlus = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" width={14} height={14}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const IconCalendar = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" width={13} height={13}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconWarning = () => (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" width={14} height={14}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

// ─── Composant : formulaire d'ajout de récurrente ─────────────────────────────

type DestInfo = { id: number; type_compte: string; client_nom: string };

type AddRecurrenteFormProps = {
  compteSourceId: number;
  comptes: Account[];
  onSuccess: () => void;
  onCancel: () => void;
};

function AddRecurrenteForm({ compteSourceId, comptes, onSuccess, onCancel }: AddRecurrenteFormProps) {
  const mesComptes = comptes.filter((c) => c.id !== compteSourceId);

  // Mode : "mes-comptes" = dropdown propres comptes, "numero" = saisie libre
  const [mode, setMode] = useState<"mes-comptes" | "numero">(mesComptes.length > 0 ? "mes-comptes" : "numero");

  // Mode mes-comptes
  const [compteDestId, setCompteDestId] = useState(String(mesComptes[0]?.id ?? ""));

  // Mode saisie numéro
  const [numeroSaisi, setNumeroSaisi]     = useState("");
  const [destInfo, setDestInfo]           = useState<DestInfo | null>(null);
  const [verifying, setVerifying]         = useState(false);
  const [verifyErr, setVerifyErr]         = useState<string | null>(null);

  const handleVerifier = async () => {
    if (!numeroSaisi.trim()) return;
    setVerifying(true);
    setVerifyErr(null);
    setDestInfo(null);
    try {
      const res = await apiGet<DestInfo>(`/recurrentes/verifier-compte?numero=${encodeURIComponent(numeroSaisi.trim())}`);
      if (res.id === compteSourceId) {
        setVerifyErr("Ce compte est le compte source — choisissez un autre compte.");
      } else {
        setDestInfo(res);
      }
    } catch (e: any) {
      setVerifyErr(e?.message ?? "Numéro de compte introuvable.");
    } finally {
      setVerifying(false);
    }
  };

  const effectiveDestId = mode === "mes-comptes" ? Number(compteDestId) : destInfo?.id ?? 0;

  const [montant, setMontant]     = useState("");
  const [frequence, setFrequence] = useState("MENSUEL");
  const [description, setDescription] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!effectiveDestId) {
      setError(mode === "numero" ? "Vérifiez d'abord le numéro de compte destination." : "Sélectionnez un compte destination.");
      return;
    }
    const montantNum = Number(montant);
    if (!montant || montantNum <= 0) { setError("Le montant doit être supérieur à 0."); return; }

    setSubmitting(true);
    try {
      await apiPost("/recurrentes", {
        compte_source_id: compteSourceId,
        compte_destination_id: effectiveDestId,
        montant: montantNum,
        frequence,
        description: description.trim() || undefined,
        date_debut: dateDebut || undefined,
        date_fin: dateFin || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lb-card" style={{ border: "1px solid var(--border-blue)", marginTop: 4 }}>
      {/* En-tête du formulaire */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "var(--blue-dim)", color: "var(--blue-light)" }}>
            <IconRepeat />
          </span>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Nouveau paiement récurrent</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 20, lineHeight: 1, padding: "0 4px" }}
          aria-label="Fermer"
        >
          ×
        </button>
      </div>

      {error && <div className="lb-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>

          {/* Compte destination */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 8 }}>
              Compte destination
            </label>

            {/* Sélecteur de mode */}
            <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
              {mesComptes.length > 0 && (
                <button type="button" onClick={() => { setMode("mes-comptes"); setDestInfo(null); setVerifyErr(null); }}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: mode === "mes-comptes" ? 600 : 400, background: mode === "mes-comptes" ? "var(--surface)" : "transparent", color: mode === "mes-comptes" ? "var(--t1)" : "var(--t3)" }}>
                  Mes comptes
                </button>
              )}
              <button type="button" onClick={() => { setMode("numero"); setCompteDestId(""); }}
                style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: mode === "numero" ? 600 : 400, background: mode === "numero" ? "var(--surface)" : "transparent", color: mode === "numero" ? "var(--t1)" : "var(--t3)" }}>
                Numéro de compte
              </button>
            </div>

            {/* Mode : mes propres comptes */}
            {mode === "mes-comptes" && (
              mesComptes.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--t3)", fontStyle: "italic" }}>Aucun autre compte disponible.</p>
              ) : (
                <select className="lb-select" value={compteDestId} onChange={(e) => setCompteDestId(e.target.value)} required={mode === "mes-comptes"}>
                  {mesComptes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero_compte} — {c.type_compte}
                    </option>
                  ))}
                </select>
              )
            )}

            {/* Mode : saisie d'un numéro de compte */}
            {mode === "numero" && (
              <div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="lb-input"
                    type="text"
                    placeholder="Ex : CA0023456"
                    value={numeroSaisi}
                    onChange={(e) => { setNumeroSaisi(e.target.value); setDestInfo(null); setVerifyErr(null); }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="lb-btn lb-btn-ghost"
                    onClick={handleVerifier}
                    disabled={verifying || !numeroSaisi.trim()}
                    style={{ fontSize: 12, padding: "0 14px", whiteSpace: "nowrap" }}
                  >
                    {verifying ? "…" : "Vérifier"}
                  </button>
                </div>
                {verifyErr && (
                  <p style={{ fontSize: 12, color: "#FCA5A5", marginTop: 6 }}>{verifyErr}</p>
                )}
                {destInfo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "var(--green-dim)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    <span style={{ fontSize: 16 }}>✓</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#6EE7B7" }}>{destInfo.client_nom}</p>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{destInfo.type_compte}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Montant */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 6 }}>
              Montant (CAD)
            </label>
            <input
              className="lb-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
            />
          </div>

          {/* Fréquence */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 6 }}>
              Fréquence
            </label>
            <select className="lb-select" value={frequence} onChange={(e) => setFrequence(e.target.value)}>
              <option value="HEBDOMADAIRE">Hebdomadaire (chaque semaine)</option>
              <option value="MENSUEL">Mensuel (chaque mois)</option>
              <option value="ANNUEL">Annuel (chaque année)</option>
            </select>
          </div>

          {/* Description */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 6 }}>
              Description <span style={{ color: "var(--t3)", fontWeight: 400 }}>(optionnel)</span>
            </label>
            <input
              className="lb-input"
              type="text"
              placeholder="Ex : Épargne mensuelle, Cotisation annuelle…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Date de début */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 6 }}>
              Première exécution <span style={{ color: "var(--t3)", fontWeight: 400 }}>(optionnel)</span>
            </label>
            <input
              className="lb-input"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              Par défaut : dans 1 période à partir d'aujourd'hui
            </p>
          </div>

          {/* Date de fin */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 6 }}>
              Date de fin <span style={{ color: "var(--t3)", fontWeight: 400 }}>(optionnel)</span>
            </label>
            <input
              className="lb-input"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              Laisser vide = illimité
            </p>
          </div>

        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button type="button" className="lb-btn lb-btn-ghost" onClick={onCancel} disabled={submitting}>
            Annuler
          </button>
          <button
            type="submit"
            className="lb-btn lb-btn-primary"
            disabled={submitting || (mode === "numero" && !destInfo) || (mode === "mes-comptes" && mesComptes.length === 0)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {submitting ? "Création…" : "Créer le paiement récurrent"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Composant : panneau dates planifiées ─────────────────────────────────────

function DatesPanel({ dates }: { dates: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
      {dates.slice(0, 3).map((d, i) => (
        <div key={d} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: i === 0 ? "var(--blue-light)" : "var(--t3)", flexShrink: 0 }}>
            <IconCalendar />
          </span>
          <span
            className="type-mono"
            style={{ fontSize: 11, color: i === 0 ? "var(--t2)" : "var(--t3)", fontWeight: i === 0 ? 600 : 400 }}
          >
            {formatDateShort(d)}
          </span>
        </div>
      ))}
      {dates.length > 3 && (
        <span style={{ fontSize: 11, color: "var(--t3)", paddingLeft: 18 }}>+ {dates.length - 3} autres</span>
      )}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

type Tab = "transactions" | "recurrentes";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = Number(params.id);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isModerator = user?.role === "MODERATEUR";

  // ── État global ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("transactions");

  // ── Transactions ────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading]       = useState(true);
  const [txError, setTxError]           = useState<string | null>(null);

  // ── Récurrentes ─────────────────────────────────────────────────────────────
  const [recurrentes, setRecurrentes]   = useState<TransactionRecurrente[]>([]);
  const [recLoading, setRecLoading]     = useState(false);
  const [recError, setRecError]         = useState<string | null>(null);
  const [recSuccess, setRecSuccess]     = useState<string | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [annulerTarget, setAnnulerTarget] = useState<TransactionRecurrente | null>(null);
  const [execNowLoading, setExecNowLoading] = useState(false);

  // ── Comptes utilisateur (pour le formulaire) ────────────────────────────────
  const [comptes, setComptes] = useState<Account[]>([]);

  // ── Chargement des transactions ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setTxLoading(true);
    apiGet<{ data: Transaction[] }>(`/comptes/${accountId}/transactions`)
      .then((res) => { if (mounted) setTransactions(res.data); })
      .catch((e: any) => { if (mounted) setTxError(e?.message ?? "Erreur lors du chargement."); })
      .finally(() => { if (mounted) setTxLoading(false); });
    return () => { mounted = false; };
  }, [accountId]);

  // ── Chargement des récurrentes ───────────────────────────────────────────────
  const loadRecurrentes = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const endpoint = isAdmin ? "/recurrentes/admin/all" : "/recurrentes";
      const res = await apiGet<{ data: TransactionRecurrente[] }>(endpoint);
      // Filtrer côté client pour ne garder que celles liées à ce compte
      setRecurrentes(res.data.filter((r) => r.compte_source_id === accountId));
    } catch (e: any) {
      setRecError(e?.message ?? "Erreur lors du chargement.");
    } finally {
      setRecLoading(false);
    }
  }, [accountId, isAdmin]);

  // ── Chargement de ses propres comptes (pour le formulaire — mode "Mes comptes") ─
  const loadComptes = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Account[] }>("/comptes");
      setComptes(res.data);
    } catch {
      // Silencieux — le formulaire basculera en mode saisie manuelle
    }
  }, []);

  // Charger récurrentes au montage si onglet récurrentes sélectionné
  useEffect(() => {
    if (tab === "recurrentes" && !isModerator) {
      loadRecurrentes();
      if (!isAdmin) loadComptes();
    }
  }, [tab, isModerator, isAdmin, loadRecurrentes, loadComptes]);

  // ── Actions sur les récurrentes ─────────────────────────────────────────────
  const handleSuspendre = async (id: number) => {
    setActionLoading(id);
    setRecSuccess(null);
    setRecError(null);
    try {
      await apiPatch<{ message: string }>(`/recurrentes/${id}/suspendre`, {});
      setRecSuccess("Paiement récurrent suspendu.");
      await loadRecurrentes();
    } catch (e: any) {
      setRecError(e?.message ?? "Erreur lors de la suspension.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReprendre = async (id: number) => {
    setActionLoading(id);
    setRecSuccess(null);
    setRecError(null);
    try {
      await apiPatch<{ message: string }>(`/recurrentes/${id}/reprendre`, {});
      setRecSuccess("Paiement récurrent repris.");
      await loadRecurrentes();
    } catch (e: any) {
      setRecError(e?.message ?? "Erreur lors de la reprise.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAnnuler = (rec: TransactionRecurrente) => {
    setAnnulerTarget(rec);
  };

  const confirmAnnuler = async () => {
    if (!annulerTarget) return;
    const target = annulerTarget;
    setAnnulerTarget(null);
    setActionLoading(target.id);
    setRecSuccess(null);
    setRecError(null);
    try {
      await apiDelete<{ message: string }>(`/recurrentes/${target.id}`);
      setRecSuccess("Paiement récurrent annulé.");
      await loadRecurrentes();
    } catch (e: any) {
      setRecError(e?.message ?? "Erreur lors de l'annulation.");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Exécution manuelle des récurrentes (admin) ──────────────────────────────
  const handleExecNow = async () => {
    setExecNowLoading(true);
    setRecSuccess(null);
    setRecError(null);
    try {
      await apiPost<{ message: string }>("/recurrentes/admin/executer", {});
      setRecSuccess("Exécution déclenchée — les récurrentes échues ont été traitées.");
      await loadRecurrentes();
    } catch (e: any) {
      setRecError(e?.message ?? "Erreur lors de l'exécution.");
    } finally {
      setExecNowLoading(false);
    }
  };

  // ── Stats transactions ───────────────────────────────────────────────────────
  const credits = transactions.filter((t) => Number(t.montant) > 0).reduce((s, t) => s + Number(t.montant), 0);
  const debits  = transactions.filter((t) => Number(t.montant) < 0).reduce((s, t) => s + Number(t.montant), 0);

  // ── Stats récurrentes ────────────────────────────────────────────────────────
  const activeCount = recurrentes.filter((r) => r.statut === "ACTIVE").length;

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Modal confirmation annulation ─────────────────────────────── */}
      {annulerTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>
              Annuler le paiement récurrent
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>
              {annulerTarget.client_destination_nom && (
                <span style={{ fontWeight: 600 }}>{annulerTarget.client_destination_nom} · </span>
              )}
              {annulerTarget.compte_destination_numero} — <span style={{ color: "var(--t3)" }}>{annulerTarget.compte_destination_type}</span>
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>
              {annulerTarget.description && <span style={{ color: "var(--t3)" }}>{annulerTarget.description} · </span>}
              <span className="type-mono" style={{ fontWeight: 600 }}>−{formatMoney(annulerTarget.montant)}</span>
              {" · "}
              <span style={{ color: "var(--t3)" }}>{annulerTarget.frequence.charAt(0) + annulerTarget.frequence.slice(1).toLowerCase()}</span>
            </p>
            <p style={{ fontSize: 13, color: "#FCA5A5", marginBottom: 20, marginTop: 10 }}>
              Cette action est irréversible.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setAnnulerTarget(null)}
                style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 12, cursor: "pointer" }}
              >
                Retour
              </button>
              <button
                type="button"
                onClick={confirmAnnuler}
                style={{ padding: "9px 16px", borderRadius: 8, background: "var(--red-dim)", border: "1px solid rgba(220,38,38,0.3)", color: "#FCA5A5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Retour ───────────────────────────────────────────────────── */}
      <Link
        href="/dashboard/comptes"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--t3)", textDecoration: "none", width: "fit-content" }}
      >
        <IconArrowLeft />
        Retour aux comptes
      </Link>

      {/* ── En-tête ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>Détail du compte</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            Compte #{accountId}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Stat : mouvements */}
          <div className="lb-stat" style={{ textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>{transactions.length}</p>
            <p className="type-label">Mouvements</p>
          </div>

          {/* Stat : crédits */}
          {transactions.length > 0 && (
            <>
              <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(52,211,153,0.2)", background: "var(--green-dim)" }}>
                <p className="type-mono" style={{ fontSize: 16, fontWeight: 700, color: "#6EE7B7" }}>{formatMoney(credits)}</p>
                <p className="type-label">Crédits</p>
              </div>
              <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(252,165,165,0.2)", background: "var(--red-dim)" }}>
                <p className="type-mono" style={{ fontSize: 16, fontWeight: 700, color: "#FCA5A5" }}>{formatMoney(debits)}</p>
                <p className="type-label">Débits</p>
              </div>
            </>
          )}

          {/* Stat : récurrentes actives (seulement si non-modérateur) */}
          {!isModerator && (
            <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(99,179,237,0.2)", background: "var(--blue-dim)" }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--blue-light)" }}>
                {tab === "recurrentes" ? activeCount : <span style={{ color: "var(--t3)", fontSize: 16 }}>—</span>}
              </p>
              <p className="type-label">Récurrentes actives</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sélecteur d'onglets ───────────────────────────────────────── */}
      {!isModerator && (
        <div
          style={{
            display: "inline-flex",
            gap: 4,
            padding: 4,
            background: "var(--surface-2)",
            borderRadius: 10,
            border: "1px solid var(--border)",
            width: "fit-content",
          }}
        >
          {(["transactions", "recurrentes"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                background: tab === t ? "var(--surface)" : "transparent",
                color: tab === t ? "var(--t1)" : "var(--t3)",
                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                transition: "all 150ms ease",
              }}
            >
              {t === "recurrentes" && <IconRepeat />}
              {t === "transactions" ? "Transactions" : "Récurrentes"}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ONGLET TRANSACTIONS                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(tab === "transactions" || isModerator) && (
        <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Historique des transactions</p>
            {txLoading ? (
              <span className="lb-loading" style={{ fontSize: 12, color: "var(--t3)" }}>Chargement…</span>
            ) : (
              <span className="lb-badge lb-badge-muted">{transactions.length} lignes</span>
            )}
          </div>

          {txError && <div className="lb-alert-error" style={{ margin: "16px 24px" }}>{txError}</div>}

          <div className="lb-scroll" style={{ overflowX: "auto" }}>
            <table className="lb-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                  <th style={{ textAlign: "right", paddingRight: 24 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {!txLoading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "40px 24px", color: "var(--t3)" }}>
                      Aucune transaction pour ce compte.
                    </td>
                  </tr>
                )}
                {transactions.map((t) => {
                  const amount = Number(t.montant);
                  const isPos = !Number.isNaN(amount) && amount >= 0;
                  return (
                    <tr key={t.id}>
                      <td style={{ paddingLeft: 24 }}>
                        <TransactionTypeBadge type={t.type_transaction} />
                      </td>
                      <td style={{ color: "var(--t1)" }}>{t.description}</td>
                      <td
                        className="type-mono"
                        style={{ textAlign: "right", fontWeight: 600, color: isPos ? "#6EE7B7" : "#FCA5A5" }}
                      >
                        {isPos ? "+" : ""}{formatMoney(t.montant)}
                      </td>
                      <td className="type-mono" style={{ textAlign: "right", fontSize: 12, color: "var(--t3)", paddingRight: 24 }}>
                        {formatDate(t.date_transaction)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ONGLET RÉCURRENTES                                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "recurrentes" && !isModerator && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Alertes globales ──────────────────────────────────────── */}
          {recError   && <div className="lb-alert-error">{recError}</div>}
          {recSuccess && <div className="lb-alert-success">{recSuccess}</div>}

          {/* ── Tableau des récurrentes ───────────────────────────────── */}
          <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Paiements récurrents</p>
                {!recLoading && recurrentes.length > 0 && (
                  <span className="lb-badge lb-badge-muted">{recurrentes.length}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {recLoading && (
                  <span className="lb-loading" style={{ fontSize: 12, color: "var(--t3)" }}>Chargement…</span>
                )}
                {/* Bouton exécution manuelle — ADMIN uniquement */}
                {isAdmin && (
                  <button
                    type="button"
                    className="lb-btn lb-btn-ghost"
                    disabled={execNowLoading}
                    onClick={handleExecNow}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px", color: "var(--blue-light)", borderColor: "rgba(99,179,237,0.3)" }}
                    title="Déclencher immédiatement l'exécution de toutes les récurrentes échues"
                  >
                    ▶ {execNowLoading ? "Exécution…" : "Exécuter maintenant"}
                  </button>
                )}
                {/* Bouton d'ajout — uniquement pour les utilisateurs (pas les admins sur les comptes d'autrui) */}
                {!isAdmin && !showForm && (
                  <button
                    type="button"
                    className="lb-btn lb-btn-primary"
                    onClick={() => { setShowForm(true); setRecSuccess(null); setRecError(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 14px" }}
                  >
                    <IconPlus />
                    Ajouter
                  </button>
                )}
              </div>
            </div>

            {/* Formulaire d'ajout inline */}
            {showForm && !isAdmin && (
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <AddRecurrenteForm
                  compteSourceId={accountId}
                  comptes={comptes}
                  onSuccess={async () => {
                    setShowForm(false);
                    setRecSuccess("Paiement récurrent créé avec succès.");
                    await loadRecurrentes();
                  }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            )}

            {/* Tableau */}
            <div className="lb-scroll" style={{ overflowX: "auto" }}>
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>Destination</th>
                    <th>Montant</th>
                    <th>Fréquence</th>
                    <th>Statut</th>
                    <th>Prochaines exécutions</th>
                    <th style={{ paddingRight: 24, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!recLoading && recurrentes.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "48px 24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--t3)" }}>
                          <IconRepeat />
                          <p style={{ fontSize: 14 }}>Aucun paiement récurrent pour ce compte.</p>
                          {!isAdmin && (
                            <button
                              type="button"
                              className="lb-btn lb-btn-ghost"
                              onClick={() => setShowForm(true)}
                              style={{ marginTop: 4, fontSize: 12 }}
                            >
                              Créer le premier paiement récurrent
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {recurrentes.map((rec) => {
                    const isLoading = actionLoading === rec.id;
                    const canAct = rec.statut !== "ANNULEE" && rec.statut !== "TERMINEE";

                    return (
                      <tr key={rec.id} style={{ opacity: rec.statut === "ANNULEE" || rec.statut === "TERMINEE" ? 0.55 : 1 }}>
                        {/* Destination */}
                        <td style={{ paddingLeft: 24 }}>
                          <div>
                            {rec.client_destination_nom && (
                              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>
                                {rec.client_destination_nom}
                              </p>
                            )}
                            <p className="type-mono" style={{ fontSize: 12, color: "var(--t2)" }}>
                              {rec.compte_destination_numero}
                            </p>
                            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>
                              {rec.compte_destination_type}
                              {rec.description && ` · ${rec.description}`}
                            </p>
                          </div>
                        </td>

                        {/* Montant */}
                        <td>
                          <p className="type-mono" style={{ fontSize: 14, fontWeight: 700, color: "#FCA5A5" }}>
                            −{formatMoney(rec.montant)}
                          </p>
                          {rec.date_fin && (
                            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                              Fin : {formatDateShort(rec.date_fin)}
                            </p>
                          )}
                        </td>

                        {/* Fréquence */}
                        <td><FrequenceBadge frequence={rec.frequence} /></td>

                        {/* Statut */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <StatutBadge statut={rec.statut} />
                            {rec.nb_echecs > 0 && rec.statut !== "ANNULEE" && rec.statut !== "TERMINEE" && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#FCA5A5", fontSize: 11 }}>
                                <IconWarning />
                                {rec.nb_echecs} échec{rec.nb_echecs > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Prochaines dates */}
                        <td>
                          {(rec.statut === "ACTIVE" || rec.statut === "SUSPENDUE") && rec.prochaines_executions?.length > 0 ? (
                            <DatesPanel dates={rec.prochaines_executions} />
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: "right", paddingRight: 24 }}>
                          {canAct ? (
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                              {rec.statut === "ACTIVE" && (
                                <button
                                  type="button"
                                  className="lb-btn lb-btn-ghost"
                                  disabled={isLoading}
                                  onClick={() => handleSuspendre(rec.id)}
                                  style={{ fontSize: 12, padding: "4px 10px", color: "var(--t2)" }}
                                  title="Suspendre"
                                >
                                  {isLoading ? "…" : "Suspendre"}
                                </button>
                              )}
                              {rec.statut === "SUSPENDUE" && (
                                <button
                                  type="button"
                                  className="lb-btn lb-btn-ghost"
                                  disabled={isLoading}
                                  onClick={() => handleReprendre(rec.id)}
                                  style={{ fontSize: 12, padding: "4px 10px", color: "var(--blue-light)" }}
                                  title="Reprendre"
                                >
                                  {isLoading ? "…" : "Reprendre"}
                                </button>
                              )}
                              <button
                                type="button"
                                className="lb-btn"
                                disabled={isLoading}
                                onClick={() => handleAnnuler(rec)}
                                style={{ fontSize: 12, padding: "4px 10px", color: "#FCA5A5", background: "var(--red-dim)", border: "1px solid rgba(252,165,165,0.2)" }}
                                title="Annuler définitivement"
                              >
                                {isLoading ? "…" : "Annuler"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Note informative sur le scheduler ─────────────────────── */}
          {!recLoading && recurrentes.some((r) => r.statut === "ACTIVE") && (
            <p style={{ fontSize: 12, color: "var(--t3)", display: "flex", alignItems: "center", gap: 5 }}>
              <IconCalendar />
              Les paiements sont exécutés automatiquement une fois par heure. Après 3 échecs consécutifs (solde insuffisant), le paiement est suspendu automatiquement.
            </p>
          )}

        </div>
      )}

    </div>
  );
}
