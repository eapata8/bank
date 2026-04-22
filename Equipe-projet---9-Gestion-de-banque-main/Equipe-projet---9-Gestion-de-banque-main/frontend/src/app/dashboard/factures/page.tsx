"use client";

import React, { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, Facture } from "@/lib/types";

function formatMoney(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PAYEE:   { cls: "lb-badge-green",  label: "Payée" },
    IMPAYEE: { cls: "lb-badge-red",    label: "Impayée" },
    A_VENIR: { cls: "lb-badge-amber",  label: "À venir" },
  };
  const { cls, label } = map[statut] ?? { cls: "lb-badge-muted", label: statut };
  return <span className={`lb-badge ${cls}`}>{label}</span>;
}

export default function FacturesPage() {
  const { user } = useAuth();
  const isElevated = user?.role === "ADMIN" || user?.role === "MODERATEUR";

  const [factures, setFactures] = useState<Facture[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<number, string>>({});

  // Formulaire paiement direct (utilisateur régulier)
  const initialUserPayForm = { fournisseur: "", reference_facture: "", montant: "", date_echeance: "", description: "", compte_id: "" };
  const [userPayForm, setUserPayForm] = useState(initialUserPayForm);
  const [submittingUserPay, setSubmittingUserPay] = useState(false);

  const loadFactures = async (nextSearch = search) => {
    setLoading(true); setError(null);
    try {
      const q = isElevated && nextSearch.trim() ? `/factures?search=${encodeURIComponent(nextSearch.trim())}` : "/factures";
      const res = await apiGet<{ data: Facture[] }>(q);
      setFactures(res.data);
    } catch (e: any) { setError(e?.message ?? "Erreur"); }
    finally { setLoading(false); }
  };

  const loadSupportingData = async () => {
    try {
      const a = await apiGet<{ data: Account[] }>("/comptes");
      setAccounts(a.data);
    } catch (e: any) { setError(e?.message ?? "Erreur"); }
  };

  useEffect(() => {
    loadFactures("").catch(() => {});
    loadSupportingData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElevated]);

  const accountOptionsByFacture = useMemo(() => {
    return factures.reduce<Record<number, { value: string; label: string }[]>>((acc, f) => {
      acc[f.id] = accounts
        .filter((a) => a.client_id === f.client_id)
        .map((a) => ({ value: String(a.id), label: `${a.type_compte} (${a.numero_compte}) — ${formatMoney(a.solde)}` }));
      return acc;
    }, {});
  }, [accounts, factures]);

  // Initialiser le compte du formulaire utilisateur dès que les comptes chargent
  useEffect(() => {
    if (!isElevated && accounts.length > 0) {
      setUserPayForm((cur) => cur.compte_id ? cur : { ...cur, compte_id: String(accounts[0].id) });
    }
  }, [accounts, isElevated]);

  useEffect(() => {
    setSelectedAccounts((cur) => {
      const next = { ...cur };
      for (const [idStr, opts] of Object.entries(accountOptionsByFacture)) {
        const id = Number(idStr);
        if (!next[id] && opts.length > 0) next[id] = opts[0].value;
      }
      return next;
    });
  }, [accountOptionsByFacture]);

  const payFacture = async (facture: Facture) => {
    const accountId = selectedAccounts[facture.id];
    if (!accountId) { setError("Sélectionnez un compte de paiement"); return; }
    setError(null); setSuccess(null); setPayingId(facture.id);
    try {
      await apiPost(`/factures/${facture.id}/payer`, { compte_id: Number(accountId) });
      setSuccess(`Facture #${facture.id} payée avec succès`);
      await Promise.all([loadFactures(), loadSupportingData()]);
    } catch (e: any) { setError(e?.message ?? "Erreur de paiement"); }
    finally { setPayingId(null); }
  };

  const updateUserPay = (f: keyof typeof initialUserPayForm) => (v: string) =>
    setUserPayForm((c) => ({ ...c, [f]: v }));

  const handleUserPayFacture = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null);
    const { fournisseur, reference_facture, montant, date_echeance, description, compte_id } = userPayForm;
    if (!fournisseur || !reference_facture || !montant || !date_echeance || !compte_id) {
      setError("Tous les champs obligatoires doivent être remplis"); return;
    }
    const montantNum = Number(montant);
    if (Number.isNaN(montantNum) || montantNum <= 0) { setError("Le montant doit être positif"); return; }
    setSubmittingUserPay(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      // 1. Créer la facture
      const created = await apiPost<{ message: string; id: number }>("/factures", {
        fournisseur, reference_facture, montant: montantNum,
        date_emission: today, date_echeance,
        description: description.trim() || undefined,
      });
      // 2. Payer immédiatement (débit du compte)
      await apiPost(`/factures/${created.id}/payer`, { compte_id: Number(compte_id) });
      setSuccess(`Paiement de ${formatMoney(montantNum)} à ${fournisseur} effectué avec succès`);
      setUserPayForm(initialUserPayForm);
      await Promise.all([loadFactures(), loadSupportingData()]);
    } catch (e: any) { setError(e?.message ?? "Erreur lors du paiement"); }
    finally { setSubmittingUserPay(false); }
  };

  const paidCount   = factures.filter((f) => f.statut === "PAYEE").length;
  const unpaidCount = factures.filter((f) => f.statut === "IMPAYEE").length;
  const pendingCount = factures.filter((f) => f.statut === "A_VENIR").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>Gestion des paiements</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Factures</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            {isElevated ? "Supervision des factures de tous les clients." : "Vos factures en attente et réglées."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="lb-stat" style={{ textAlign: "center" }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700 }}>{factures.length}</p>
            <p className="type-label">Total</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(52,211,153,0.2)", background: "var(--green-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#6EE7B7" }}>{paidCount}</p>
            <p className="type-label">Payées</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(252,165,165,0.2)", background: "var(--red-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#FCA5A5" }}>{unpaidCount}</p>
            <p className="type-label">Impayées</p>
          </div>
        </div>
      </div>

      {/* ── Search (elevated) ────────────────────────── */}
      {isElevated && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input value={search} onChange={setSearch} placeholder="Rechercher par ID, client, fournisseur, statut…" />
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => loadFactures(search)}>
            Rechercher
          </Button>
        </div>
      )}

      {error   && <div className="lb-alert-error">{error}</div>}
      {success && <div className="lb-alert-success">✓ {success}</div>}

      {/* ── Paiement de facture (utilisateur régulier) ── */}
      {!isElevated && (
        <Card>
          <p className="type-label" style={{ marginBottom: 16 }}>Payer une facture</p>
          <form className="lb-form-grid" style={{ gap: 14 }} onSubmit={handleUserPayFacture}>
            <Input label="Fournisseur *" value={userPayForm.fournisseur} onChange={updateUserPay("fournisseur")} placeholder="Hydro-Québec, Vidéotron…" />
            <Input label="Référence de facture *" value={userPayForm.reference_facture} onChange={updateUserPay("reference_facture")} placeholder="INV-2026-0042" />
            <Input label="Montant (CAD) *" value={userPayForm.montant} onChange={updateUserPay("montant")} type="number" placeholder="0.00" />
            <Input label="Date d'échéance *" value={userPayForm.date_echeance} onChange={updateUserPay("date_echeance")} placeholder="2026-04-15" />
            <Select
              label="Compte à débiter *"
              value={userPayForm.compte_id}
              onChange={updateUserPay("compte_id")}
              options={accounts.map((a) => ({ value: String(a.id), label: `${a.type_compte} (${a.numero_compte}) — ${formatMoney(a.solde)}` }))}
            />
            <Input label="Description (opt.)" value={userPayForm.description} onChange={updateUserPay("description")} placeholder="Optionnel" />
            <div style={{ gridColumn: "1/-1" }}>
              <Button type="submit" disabled={submittingUserPay || accounts.length === 0} className="w-full">
                {submittingUserPay ? "Paiement en cours…" : "Payer la facture"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Table ────────────────────────────────────── */}
      <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Registre des factures</p>
          {loading ? (
            <span style={{ fontSize: 12, color: "var(--t3)" }} className="lb-loading">Chargement…</span>
          ) : (
            <span className="lb-badge lb-badge-muted">{factures.length} lignes</span>
          )}
        </div>

        <div className="lb-scroll lb-table-scroll">
          <table className="lb-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 24 }}>ID</th>
                <th>Client</th>
                <th>Fournisseur</th>
                <th>Référence</th>
                <th>Statut</th>
                <th style={{ textAlign: "right" }}>Montant</th>
                <th style={{ textAlign: "right" }}>Échéance</th>
                <th style={{ paddingRight: 24 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && factures.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 24px", color: "var(--t3)" }}>Aucune facture trouvée.</td></tr>
              )}
              {factures.map((f) => {
                const options = accountOptionsByFacture[f.id] ?? [];
                const canPay = user?.role !== "MODERATEUR" && f.statut !== "PAYEE" && options.length > 0;
                return (
                  <tr key={f.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 600, color: "var(--t2)" }}>#{f.id}</td>
                    <td>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{f.client_nom}</p>
                      {isElevated && <p style={{ fontSize: 11, color: "var(--t3)" }}>{f.client_email}</p>}
                    </td>
                    <td>
                      <p style={{ fontSize: 13, color: "var(--t1)" }}>{f.fournisseur}</p>
                      <p style={{ fontSize: 11, color: "var(--t3)" }}>{f.description || "—"}</p>
                    </td>
                    <td className="type-mono" style={{ fontSize: 12, color: "var(--t2)" }}>{f.reference_facture}</td>
                    <td><StatutBadge statut={f.statut} /></td>
                    <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#93C5FD" }}>{formatMoney(f.montant)}</td>
                    <td className="type-mono" style={{ textAlign: "right", fontSize: 12, color: "var(--t3)" }}>
                      {new Date(f.date_echeance).toLocaleDateString("fr-CA")}
                    </td>
                    <td style={{ paddingRight: 24 }}>
                      {f.statut === "PAYEE" ? (
                        <p style={{ fontSize: 12, color: "var(--green)" }}>
                          ✓ Payée {f.compte_paiement_numero ? `(${f.compte_paiement_numero})` : ""}
                        </p>
                      ) : canPay ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 200 }}>
                          <Select
                            label="Compte"
                            value={selectedAccounts[f.id] ?? ""}
                            onChange={(v) => setSelectedAccounts((cur) => ({ ...cur, [f.id]: v }))}
                            options={options}
                          />
                          <Button type="button" disabled={payingId === f.id} onClick={() => payFacture(f)} className="w-full">
                            {payingId === f.id ? "Paiement…" : `Payer #${f.id}`}
                          </Button>
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "var(--t3)" }}>
                          {user?.role === "MODERATEUR" ? "Lecture seule" : "Aucun compte éligible"}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
