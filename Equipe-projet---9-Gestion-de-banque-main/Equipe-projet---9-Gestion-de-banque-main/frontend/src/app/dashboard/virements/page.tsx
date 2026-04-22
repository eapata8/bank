"use client";

import React, { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { apiGet, apiPost, apiDownloadCSV } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, Virement } from "@/lib/types";

function formatMoney(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export default function VirementsPage() {
  const { user } = useAuth();
  const canSearchAll = user?.role === "ADMIN" || user?.role === "MODERATEUR";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [virements, setVirements] = useState<Virement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [tab, setTab] = useState<"interne" | "externe">("interne");

  // Interne form
  const [compteSourceId, setCompteSourceId] = useState("");
  const [compteDestinationId, setCompteDestinationId] = useState("");
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");

  // Externe form
  const [extSourceId, setExtSourceId] = useState("");
  const [extNumeroCompte, setExtNumeroCompte] = useState("");
  const [extInstitution, setExtInstitution] = useState("");
  const [extTransit, setExtTransit] = useState("");
  const [extSwift, setExtSwift] = useState("");
  const [extMontant, setExtMontant] = useState("");
  const [extDescription, setExtDescription] = useState("");

  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try { await apiDownloadCSV("/export/virements", "virements.csv"); }
    catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  const loadVirements = async (nextSearch = search) => {
    setLoadingHistory(true);
    try {
      const query = nextSearch.trim() ? `/virements?search=${encodeURIComponent(nextSearch.trim())}` : "/virements";
      const res = await apiGet<{ data: Virement[] }>(query);
      setVirements(res.data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors du chargement");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiGet<{ data: Account[] }>("/comptes")
      .then((res) => {
        if (!mounted) return;
        setAccounts(res.data);
        if (res.data.length >= 2) {
          setCompteSourceId(String(res.data[0].id));
          setCompteDestinationId(String(res.data[1].id));
        }
        if (res.data.length >= 1) {
          setExtSourceId(String(res.data[0].id));
        }
      })
      .catch((e: any) => setError(e?.message ?? "Erreur"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => { loadVirements(""); }, []); // eslint-disable-line

  const accountOptions = accounts.map((a) => ({
    value: String(a.id),
    label: `${a.type_compte} (${a.numero_compte}) — ${formatMoney(a.solde)}`,
  }));

  const onSubmitInterne = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const montantValue = Number(montant);
    if (!compteSourceId || !compteDestinationId || !montant) { setError("Champs manquants"); return; }
    if (Number.isNaN(montantValue) || montantValue <= 0) { setError("Le montant doit être positif"); return; }
    if (compteSourceId === compteDestinationId) { setError("Le compte source et destination doivent être différents"); return; }

    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string; id: number }>("/virements/", {
        compte_source_id: Number(compteSourceId),
        compte_destination_id: Number(compteDestinationId),
        montant: montantValue,
        description: description.trim() || undefined,
      });
      setSuccess(`Virement effectué avec succès (réf. #${res.id})`);
      const updated = await apiGet<{ data: Account[] }>("/comptes");
      setAccounts(updated.data);
      await loadVirements();
      setMontant("");
      setDescription("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors du virement");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitExterne = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const montantValue = Number(extMontant);
    if (!extSourceId || !extNumeroCompte || !extInstitution || !extTransit || !extMontant) {
      setError("Champs manquants");
      return;
    }
    if (Number.isNaN(montantValue) || montantValue <= 0) { setError("Le montant doit être positif"); return; }

    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string; id: number }>("/virements/externe", {
        compte_source_id: Number(extSourceId),
        numero_compte_dest: extNumeroCompte.trim(),
        numero_institution_dest: extInstitution.trim(),
        numero_transit_dest: extTransit.trim(),
        swift_bic_dest: extSwift.trim() || undefined,
        montant: montantValue,
        description: extDescription.trim() || undefined,
      });
      setSuccess(`Virement externe effectué avec succès (réf. #${res.id})`);
      const updated = await apiGet<{ data: Account[] }>("/comptes");
      setAccounts(updated.data);
      await loadVirements();
      setExtMontant("");
      setExtDescription("");
      setExtNumeroCompte("");
      setExtInstitution("");
      setExtTransit("");
      setExtSwift("");
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors du virement externe");
    } finally {
      setSubmitting(false);
    }
  };

  const arrowIcon = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--blue-dim)", border: "1px solid rgba(37,99,235,0.30)", display: "flex", alignItems: "center", justifyContent: "center", color: "#93C5FD" }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <polyline points="19 12 12 19 5 12" />
        </svg>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ───────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>Transferts bancaires</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Virements</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            Transférez de l'argent entre comptes autorisés.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="lb-stat" style={{ textAlign: "center" }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700 }}>{accounts.length}</p>
            <p className="type-label">Comptes</p>
          </div>
          <div className="lb-stat-accent" style={{ textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#93C5FD" }}>{virements.length}</p>
            <p className="type-label">Virements</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(110,231,183,0.10)", border: "1px solid rgba(110,231,183,0.25)", color: "#6EE7B7", fontSize: 12, cursor: "pointer", opacity: exporting ? 0.6 : 1, alignSelf: "center" }}
          >
            {exporting ? "Export…" : "Exporter CSV"}
          </button>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────── */}
      {error   && <div className="lb-alert-error">{error}</div>}
      {success && <div className="lb-alert-success">✓ {success}</div>}

      {/* ── Main grid ────────────────────────────────── */}
      <div className={canSearchAll ? undefined : "lb-layout-form-panel"} style={canSearchAll ? { display: "grid", gridTemplateColumns: "1fr", gap: 24 } : { gap: 24, alignItems: "start" }}>

        {/* Form — masqué pour ADMIN/MODERATEUR */}
        {!canSearchAll && <Card>
          {/* Tab toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 18, padding: 4, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
            {(["interne", "externe"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 150ms",
                  background: tab === t ? "var(--surface)" : "transparent",
                  color: tab === t ? "var(--t1)" : "var(--t3)",
                  boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {t === "interne" ? "⇄ Entre mes comptes" : "⇢ Virement externe"}
              </button>
            ))}
          </div>

          {tab === "interne" ? (
            <form style={{ display: "flex", flexDirection: "column", gap: 0 }} onSubmit={onSubmitInterne}>
              <div style={{ padding: "16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 10 }}>De</p>
                <Select label="" value={compteSourceId} onChange={setCompteSourceId} options={accountOptions} />
              </div>
              {arrowIcon}
              <div style={{ padding: "16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 10 }}>Vers</p>
                <Select label="" value={compteDestinationId} onChange={setCompteDestinationId} options={accountOptions} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                <Input label="Montant (CAD)" value={montant} onChange={setMontant} type="number" placeholder="0.00" />
                <Input label="Description (optionnel)" value={description} onChange={setDescription} placeholder="Ex: Loyer mars" />
              </div>
              <Button type="submit" disabled={submitting || loading} className="w-full">
                {submitting ? "Traitement en cours…" : "Effectuer le virement"}
              </Button>
            </form>
          ) : (
            <form style={{ display: "flex", flexDirection: "column", gap: 0 }} onSubmit={onSubmitExterne}>
              <div style={{ padding: "16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 10 }}>De</p>
                <Select label="" value={extSourceId} onChange={setExtSourceId} options={accountOptions} />
              </div>
              {arrowIcon}
              <div style={{ padding: "16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--t3)" }}>Coordonnées du destinataire</p>
                <Input label="Numéro de compte *" value={extNumeroCompte} onChange={setExtNumeroCompte} placeholder="XXXX XXXX XXXX" />
                <div className="lb-form-grid" style={{ gap: 10 }}>
                  <Input label="N° institution *" value={extInstitution} onChange={setExtInstitution} placeholder="621" />
                  <Input label="N° transit *" value={extTransit} onChange={setExtTransit} placeholder="10482" />
                </div>
                <Input label="SWIFT / BIC (optionnel)" value={extSwift} onChange={setExtSwift} placeholder="NXBKCA2TXXX" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                <Input label="Montant (CAD)" value={extMontant} onChange={setExtMontant} type="number" placeholder="0.00" />
                <Input label="Description (optionnel)" value={extDescription} onChange={setExtDescription} placeholder="Ex: Remboursement loyer" />
              </div>
              <Button type="submit" disabled={submitting || loading} className="w-full">
                {submitting ? "Traitement en cours…" : "Envoyer le virement"}
              </Button>
            </form>
          )}
        </Card>}

        {/* History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Search (elevated) */}
          {canSearchAll && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Input value={search} onChange={setSearch} placeholder="Rechercher par client, compte, ID…" />
              </div>
              <Button type="button" variant="secondary" disabled={loadingHistory} onClick={() => loadVirements(search)}>
                Rechercher
              </Button>
            </div>
          )}

          <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Historique</p>
              {loadingHistory ? (
                <span style={{ fontSize: 12, color: "var(--t3)" }} className="lb-loading">Chargement…</span>
              ) : (
                <span className="lb-badge lb-badge-muted">{virements.length} virements</span>
              )}
            </div>

            <div className="lb-scroll lb-table-scroll">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 24 }}>Réf.</th>
                    <th>De</th>
                    <th>Vers</th>
                    <th>Note</th>
                    <th style={{ textAlign: "right" }}>Montant</th>
                    <th style={{ textAlign: "right", paddingRight: 24 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {!loadingHistory && virements.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px 24px", color: "var(--t3)" }}>
                        Aucun virement trouvé.
                      </td>
                    </tr>
                  )}
                  {virements.map((v) => (
                    <tr key={v.id}>
                      <td style={{ paddingLeft: 24, color: "var(--t2)", fontWeight: 600 }}>#{v.id}</td>
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{v.client_source_nom}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)" }}>{v.compte_source_type} ({v.compte_source_numero})</p>
                      </td>
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{v.client_destination_nom}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)" }}>{v.compte_destination_type} ({v.compte_destination_numero})</p>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--t3)" }}>{v.description || "—"}</td>
                      <td className="type-mono" style={{ textAlign: "right", fontWeight: 700, color: "#6EE7B7" }}>
                        {formatMoney(v.montant)}
                      </td>
                      <td className="type-mono" style={{ textAlign: "right", fontSize: 11, color: "var(--t3)", paddingRight: 24 }}>
                        {new Date(v.date_virement).toLocaleString("fr-CA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
