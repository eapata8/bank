"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, Retrait } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";

function formatMoney(v: number | string) {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function statutBadge(s: string) {
  if (s === "APPROUVE") return <span className="lb-badge lb-badge-green">Approuvé</span>;
  if (s === "REJETE")   return <span className="lb-badge lb-badge-red">Rejeté</span>;
  return <span className="lb-badge lb-badge-amber">En attente</span>;
}

export default function RetraitsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isElevated = role === "ADMIN" || role === "MODERATEUR";
  const canSubmit  = role === "UTILISATEUR";

  /* ── State ─────────────────────────────────────── */
  const [retraits,  setRetraits]  = useState<Retrait[]>([]);
  const [comptes,   setComptes]   = useState<Account[]>([]);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState<string | null>(null);
  const [err,       setErr]       = useState<string | null>(null);

  /* form */
  const [compteId,    setCompteId]    = useState("");
  const [montant,     setMontant]     = useState("");
  const [description, setDescription] = useState("");

  /* reject modal */
  const [rejectId, setRejectId] = useState<number | null>(null);

  /* ── Loaders ───────────────────────────────────── */
  const loadRetraits = async (q = search) => {
    setLoading(true);
    setErr(null);
    try {
      const query = isElevated && q.trim()
        ? `/retraits?search=${encodeURIComponent(q.trim())}`
        : "/retraits";
      const res = await apiGet<{ data: Retrait[] }>(query);
      setRetraits(res.data);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadComptes = async () => {
    try {
      const res = await apiGet<{ data: Account[] }>("/comptes");
      const filtered = res.data.filter(c => (c.type_compte === "CHEQUES" || c.type_compte === "EPARGNE") && c.est_actif);
      setComptes(filtered);
      if (filtered.length > 0) setCompteId(String(filtered[0].id));
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadRetraits("");
    if (canSubmit) loadComptes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Stats ─────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:    retraits.length,
    attente:  retraits.filter(r => r.statut === "EN_ATTENTE").length,
    approuve: retraits.filter(r => r.statut === "APPROUVE").length,
  }), [retraits]);

  /* ── Submit ────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    const montantNum = parseFloat(montant);
    if (!compteId || !montant) return setErr("Le compte et le montant sont requis");
    if (isNaN(montantNum) || montantNum <= 0) return setErr("Montant invalide");
    if (montantNum > 1000) return setErr("Le montant ne peut pas dépasser 1 000 CAD");
    try {
      const res = await apiPost<{ message: string; id: number; auto_valide?: boolean }>("/retraits", {
        compte_id:   Number(compteId),
        montant:     montantNum,
        description: description.trim() || undefined,
      });
      setMsg(res.auto_valide ? `✓ Retrait #${res.id} approuvé et débité automatiquement` : `✓ Demande de retrait #${res.id} soumise — en attente de validation`);
      setCompteId(""); setMontant(""); setDescription("");
      await loadRetraits("");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de la soumission");
    }
  };

  /* ── Approve ───────────────────────────────────── */
  const handleApprouver = async (id: number) => {
    setMsg(null); setErr(null);
    try {
      await apiPatch(`/retraits/${id}/approuver`);
      setMsg(`✓ Retrait #${id} approuvé — remettez l'argent au client`);
      await loadRetraits("");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de l'approbation");
    }
  };

  /* ── Reject ────────────────────────────────────── */
  const handleRejeter = async (id: number) => {
    setMsg(null); setErr(null);
    try {
      await apiPatch(`/retraits/${id}/rejeter`);
      setMsg(`Retrait #${id} rejeté`);
      setRejectId(null);
      await loadRetraits("");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors du rejet");
    }
  };

  /* ── Render ────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>
            {isElevated ? "Validation" : "Mes retraits"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            Retraits en espèces
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            {isElevated
              ? "Approuvez ou rejetez les demandes de retrait des clients."
              : "Soumettez une demande de retrait en espèces (max 1 000 CAD)."}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10 }}>
          <div className="lb-stat" style={{ textAlign: "center" }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</p>
            <p className="type-label">Total</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(252,211,77,0.25)", background: "var(--amber-dim, rgba(252,211,77,0.06))" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#FCD34D" }}>{stats.attente}</p>
            <p className="type-label">En attente</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", borderColor: "rgba(52,211,153,0.2)", background: "var(--green-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#6EE7B7" }}>{stats.approuve}</p>
            <p className="type-label">Approuvés</p>
          </div>
        </div>
      </div>

      {/* ── Search (elevated) ──────────────────────── */}
      {isElevated && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input value={search} onChange={setSearch} placeholder="Rechercher par client, compte, statut ou ID…" />
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => loadRetraits(search)}>
            Rechercher
          </Button>
        </div>
      )}

      {/* ── Messages ───────────────────────────────── */}
      {msg && <div className="lb-alert-success">{msg}</div>}
      {err && <div className="lb-alert-error">{err}</div>}

      {/* ── Submit form ────────────────────────────── */}
      {canSubmit && (
        <Card className="p-6 md:p-7">
          <p className="type-label" style={{ marginBottom: 16 }}>Nouvelle demande de retrait</p>
          <form onSubmit={handleSubmit} className="lb-form-grid" style={{ gap: 14 }}>
            <Select
              label="Compte à débiter"
              value={compteId}
              onChange={setCompteId}
              options={comptes.map(c => ({
                value: String(c.id),
                label: `${c.numero_compte} — ${c.type_compte} (${formatMoney(c.solde)})`,
              }))}
            />
            <Input
              label="Montant (CAD, max 1 000)"
              type="number"
              value={montant}
              onChange={setMontant}
              placeholder="ex: 200.00"
            />
            <div style={{ gridColumn: "1/-1" }}>
              <Input
                label="Description (optionnel)"
                value={description}
                onChange={setDescription}
                placeholder="ex: Retrait mensuel"
              />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary">Soumettre la demande</Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Confirm reject modal ────────────────────── */}
      {rejectId !== null && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 380,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              Rejeter le retrait #{rejectId}
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              Cette action est irréversible. Le solde du client ne sera pas débité.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setRejectId(null)}>
                Annuler
              </Button>
              <Button type="button" variant="primary" onClick={() => handleRejeter(rejectId)}>
                Confirmer le rejet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Registre des retraits</p>
          <span className="lb-badge lb-badge-muted">{retraits.length} ligne{retraits.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="lb-scroll lb-table-scroll">
          {loading ? (
            <p style={{ padding: "24px", fontSize: 13, color: "var(--t3)" }} className="lb-loading">Chargement…</p>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>ID</th>
                  {isElevated && <th>Client</th>}
                  <th>Compte</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                  <th>Description</th>
                  <th>Statut</th>
                  <th>Demandé le</th>
                  {isElevated && <th style={{ paddingRight: 24 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {retraits.map(r => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 600, color: "var(--t2)" }}>#{r.id}</td>
                    {isElevated && (
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{r.client_nom}</p>
                      </td>
                    )}
                    <td className="type-mono" style={{ fontSize: 12, color: "var(--t2)" }}>
                      {r.compte_numero}
                      <span style={{ display: "block", fontSize: 11, color: "var(--t3)" }}>{r.compte_type}</span>
                    </td>
                    <td className="type-mono" style={{ textAlign: "right", color: "#f87171", fontWeight: 700 }}>
                      -{formatMoney(r.montant)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--t3)" }}>{r.description || "—"}</td>
                    <td>{statutBadge(r.statut)}</td>
                    <td style={{ fontSize: 12, color: "var(--t3)" }}>
                      {new Date(r.date_demande).toLocaleDateString("fr-CA")}
                    </td>
                    {isElevated && (
                      <td style={{ paddingRight: 24 }}>
                        {r.statut === "EN_ATTENTE" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <Button type="button" variant="secondary" onClick={() => handleApprouver(r.id)}>
                              Approuver
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setRejectId(r.id)}>
                              Rejeter
                            </Button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>
                            {r.approuve_par_nom ?? "—"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {retraits.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "28px", fontSize: 13, color: "var(--t3)" }}>
                      Aucun retrait trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
