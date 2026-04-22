"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, InteracAutoDeposit, InteracTransfert, InteracAReclamer, InteracBeneficiaire } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";

/* ── Utilitaires ──────────────────────────────────── */

function formatMoney(v: number | string) {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function formatDateShort(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function statutBadge(s: string) {
  if (s === "ACCEPTEE") return <span className="lb-badge lb-badge-green">Acceptée</span>;
  if (s === "ANNULEE")  return <span className="lb-badge lb-badge-red">Annulée</span>;
  if (s === "EXPIREE")  return <span className="lb-badge lb-badge-red">Expirée</span>;
  return <span className="lb-badge lb-badge-amber">En attente</span>;
}

function comptesToOptions(comptes: Account[], withEmpty?: boolean) {
  const opts = comptes.map(c => ({
    value: String(c.id),
    label: `${c.type_compte} — ${c.numero_compte} (${formatMoney(c.solde)})`,
  }));
  if (withEmpty) opts.unshift({ value: "", label: "— Sélectionner un compte —" });
  return opts;
}

/* ── Composant principal ──────────────────────────── */

export default function InteracPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isElevated = role === "ADMIN" || role === "MODERATEUR";
  const canSubmit   = role === "UTILISATEUR";

  /* ── State global ─────────────────────────────── */
  const [tab,        setTab]        = useState<"envoyer" | "reclamer" | "autodeposit" | "beneficiaires">("envoyer");
  const [transferts, setTransferts] = useState<InteracTransfert[]>([]);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [msg,        setMsg]        = useState<string | null>(null);
  const [err,        setErr]        = useState<string | null>(null);

  /* ── Onglet Envoyer ───────────────────────────── */
  const [comptes,      setComptes]      = useState<Account[]>([]);
  const [compteSource, setCompteSource] = useState("");
  const [emailDest,    setEmailDest]    = useState("");
  const [montant,      setMontant]      = useState("");
  const [description,  setDescription]  = useState("");
  const [motDePasse,   setMotDePasse]   = useState("");
  const [sendLoading,  setSendLoading]  = useState(false);
  const [cancelId,     setCancelId]     = useState<number | null>(null);

  /* ── Onglet À réclamer ────────────────────────── */
  const [aReclamer,       setAReclamer]       = useState<InteracAReclamer[]>([]);
  const [reclamerLoading, setReclamerLoading] = useState(false);
  const [reclamerComptes, setReclamerComptes] = useState<Account[]>([]);
  const [reclamerForm,    setReclamerForm]    = useState<{ id: number; expediteur: string; montant: string; requiert_mdp: boolean } | null>(null);
  const [reclamerCompte,  setReclamerCompte]  = useState("");
  const [reclamerMdp,     setReclamerMdp]     = useState("");

  /* ── Limites effectives ──────────────────────────── */
  const [limites, setLimites] = useState({
    limite_24h: 3000, limite_7j: 10000, limite_30j: 20000,
    utilise_24h: 0, utilise_7j: 0, utilise_30j: 0,
    restant_24h: 3000, restant_7j: 10000, restant_30j: 20000,
  });

  /* ── Onglet Auto-dépôt ────────────────────────── */
  const [autoDeposit,        setAutoDeposit]        = useState<InteracAutoDeposit | null>(null);
  const [adEmail,            setAdEmail]            = useState("");
  const [adCompte,           setAdCompte]           = useState("");
  const [adLoading,          setAdLoading]          = useState(false);
  const [adMsg,              setAdMsg]              = useState<string | null>(null);
  const [adErr,              setAdErr]              = useState<string | null>(null);
  const [adConfirmDesactiver, setAdConfirmDesactiver] = useState(false);

  /* ── Onglet Bénéficiaires ─────────────────────── */
  const [beneficiaires,      setBeneficiaires]      = useState<InteracBeneficiaire[]>([]);
  const [benLoading,         setBenLoading]         = useState(false);
  const [benAlias,           setBenAlias]           = useState("");
  const [benEmail,           setBenEmail]           = useState("");
  const [benFormLoading,     setBenFormLoading]     = useState(false);
  const [benMsg,             setBenMsg]             = useState<string | null>(null);
  const [benErr,             setBenErr]             = useState<string | null>(null);
  const [benDeleteTarget,    setBenDeleteTarget]    = useState<InteracBeneficiaire | null>(null);

  /* ── Sélecteur bénéficiaire (onglet Envoyer) ──── */
  const [selectedBenef,      setSelectedBenef]      = useState("");

  /* ── Chargement ──────────────────────────────── */
  const loadTransferts = async (q = search) => {
    setLoading(true);
    setErr(null);
    try {
      const query = isElevated && q.trim()
        ? `/interac?search=${encodeURIComponent(q.trim())}`
        : "/interac";
      const res = await apiGet<{ data: InteracTransfert[] }>(query);
      setTransferts(res.data);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadComptes = async () => {
    try {
      const res = await apiGet<{ data: Account[] }>("/comptes");
      const actifs = res.data.filter(c => c.est_actif);
      setComptes(actifs);
      setReclamerComptes(actifs);
      if (actifs.length > 0) {
        setCompteSource(String(actifs[0].id));
        setReclamerCompte(String(actifs[0].id));
      }
    } catch { /* silent */ }
  };

  const loadAReclamer = async () => {
    setReclamerLoading(true);
    try {
      const res = await apiGet<{ data: InteracAReclamer[] }>("/interac/a-reclamer");
      setAReclamer(res.data);
    } catch { /* silent */ }
    finally { setReclamerLoading(false); }
  };

  const loadAutoDeposit = async () => {
    try {
      const res = await apiGet<{ data: InteracAutoDeposit }>("/interac/autodeposit");
      setAutoDeposit(res.data);
    } catch { setAutoDeposit(null); }
  };

  const loadLimites = async () => {
    try {
      const res = await apiGet<{ data: {
        limite_24h: number; limite_7j: number; limite_30j: number;
        utilise_24h: number; utilise_7j: number; utilise_30j: number;
        restant_24h: number; restant_7j: number; restant_30j: number;
      } }>("/interac/limites");
      setLimites(res.data);
    } catch { /* garde les défauts */ }
  };

  const loadBeneficiaires = async () => {
    setBenLoading(true);
    try {
      const res = await apiGet<{ data: InteracBeneficiaire[] }>("/beneficiaires");
      setBeneficiaires(res.data);
    } catch { /* silent */ }
    finally { setBenLoading(false); }
  };

  useEffect(() => {
    loadTransferts("");
    if (canSubmit) {
      loadComptes();
      loadAReclamer();
      loadAutoDeposit();
      loadLimites();
      loadBeneficiaires();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Rafraîchit les limites/comptes/transferts quand l'onglet reprend le focus.
   * Utile si un admin a modifié les limites dans une autre session pendant
   * que cette page reste ouverte.
   */
  useEffect(() => {
    if (!canSubmit) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      loadLimites();
      loadComptes();
      loadTransferts(search);
      loadAutoDeposit();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit, search]);

  /* ── Stats ───────────────────────────────────── */
  const stats = useMemo(() => ({
    total:     transferts.length,
    enAttente: transferts.filter(t => t.statut === "EN_ATTENTE").length,
    acceptees: transferts.filter(t => t.statut === "ACCEPTEE").length,
    annulees:  transferts.filter(t => t.statut === "ANNULEE" || t.statut === "EXPIREE").length,
  }), [transferts]);

  /* ── Handlers Envoyer ────────────────────────── */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null); setSendLoading(true);
    try {
      const body: any = {
        compte_source_id:   Number(compteSource),
        email_destinataire: emailDest.trim(),
        montant:            Number(montant),
        description:        description.trim() || undefined,
      };
      if (motDePasse.trim()) body.mot_de_passe = motDePasse.trim();
      const res = await apiPost<{ message: string; statut: string }>("/interac", body);
      setMsg(res.message);
      setEmailDest(""); setMontant(""); setDescription(""); setMotDePasse(""); setSelectedBenef("");
      await loadTransferts("");
      await loadComptes();
      await loadLimites();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSendLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    setMsg(null); setErr(null);
    try {
      const res = await apiDelete<{ message: string }>(`/interac/${id}`);
      setMsg(res.message);
      setCancelId(null);
      await loadTransferts("");
      await loadComptes();
      await loadLimites();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de l'annulation");
      setCancelId(null);
    }
  };

  /* ── Handlers Réclamer ───────────────────────── */
  const handleReclamer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reclamerForm) return;
    setMsg(null); setErr(null); setReclamerLoading(true);
    try {
      const body: any = { compte_destination_id: Number(reclamerCompte) };
      if (reclamerMdp.trim()) body.mot_de_passe = reclamerMdp.trim();
      const res = await apiPost<{ message: string }>(`/interac/${reclamerForm.id}/reclamer`, body);
      setMsg(res.message);
      setReclamerForm(null); setReclamerMdp("");
      await loadAReclamer();
      await loadTransferts("");
      await loadComptes();
      await loadLimites();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de la réclamation");
    } finally {
      setReclamerLoading(false);
    }
  };

  /* ── Handlers Bénéficiaires ──────────────────── */
  const handleAddBenef = async (e: React.FormEvent) => {
    e.preventDefault();
    setBenMsg(null); setBenErr(null); setBenFormLoading(true);
    try {
      const res = await apiPost<{ message: string; id: number }>("/beneficiaires", {
        alias: benAlias.trim(),
        email_interac: benEmail.trim(),
      });
      setBenMsg(res.message);
      setBenAlias(""); setBenEmail("");
      await loadBeneficiaires();
    } catch (e: any) {
      setBenErr(e?.message ?? "Erreur lors de l'ajout");
    } finally {
      setBenFormLoading(false);
    }
  };

  const confirmDeleteBenef = async () => {
    if (!benDeleteTarget) return;
    setBenMsg(null); setBenErr(null);
    try {
      const res = await apiDelete<{ message: string }>(`/beneficiaires/${benDeleteTarget.id}`);
      setBenMsg(res.message);
      setBenDeleteTarget(null);
      if (selectedBenef === String(benDeleteTarget.id)) setSelectedBenef("");
      await loadBeneficiaires();
    } catch (e: any) {
      setBenErr(e?.message ?? "Erreur lors de la suppression");
      setBenDeleteTarget(null);
    }
  };

  /* ── Handler Auto-dépôt (activation directe, 1 étape) ─── */
  const handleActiverAD = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdMsg(null); setAdErr(null); setAdLoading(true);
    try {
      const res = await apiPost<{ message: string; data: InteracAutoDeposit }>(
        "/interac/autodeposit",
        { email_interac: adEmail.trim().toLowerCase(), compte_depot_id: Number(adCompte) }
      );
      setAdMsg(res.message);
      setAutoDeposit(res.data);
      setAdEmail(""); setAdCompte("");
    } catch (e: any) {
      setAdErr(e?.message ?? "Erreur");
    } finally {
      setAdLoading(false);
    }
  };

  const handleDesactiverAD = async () => {
    setAdMsg(null); setAdErr(null); setAdLoading(true);
    setAdConfirmDesactiver(false);
    try {
      const res = await apiDelete<{ message: string }>("/interac/autodeposit");
      setAdMsg(res.message);
      setAutoDeposit(null);
    } catch (e: any) {
      setAdErr(e?.message ?? "Erreur");
    } finally {
      setAdLoading(false);
    }
  };

  /* ── Tab style helper ────────────────────────── */
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    color: active ? "var(--stripe-purple)" : "var(--t3)",
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--stripe-purple)" : "2px solid transparent",
    cursor: "pointer",
    transition: "color 140ms, border-color 140ms",
    fontFamily: "inherit",
    fontFeatureSettings: '"ss01"',
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  });

  /* ── Rendu ───────────────────────────────────── */
  return (
    <div className="lb-page" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>
            {isElevated ? "Gestion" : "Mes transferts"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            Interac e-Transfert
          </h1>
          {canSubmit && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "24 heures", restant: limites.restant_24h ?? limites.limite_24h, max: limites.limite_24h },
                { label: "7 jours",   restant: limites.restant_7j  ?? limites.limite_7j,  max: limites.limite_7j  },
                { label: "30 jours",  restant: limites.restant_30j ?? limites.limite_30j, max: limites.limite_30j },
              ].map(({ label, restant, max }) => {
                const pct = max > 0 ? Math.min(100, ((max - restant) / max) * 100) : 0;
                const isLow = restant <= max * 0.15;
                return (
                  <div key={label} style={{
                    display: "flex", flexDirection: "column", gap: 3,
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "5px 10px", minWidth: 118,
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isLow ? "var(--red)" : "var(--t1)", fontVariantNumeric: "tabular-nums" }}>
                        {restant.toLocaleString("fr-CA")} $
                      </span>
                      <span style={{ fontSize: 10, color: "var(--t3)", fontVariantNumeric: "tabular-nums" }}>
                        / {max.toLocaleString("fr-CA")} $
                      </span>
                    </div>
                    <span className="type-label" style={{ fontSize: 10 }}>{label}</span>
                    <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: isLow ? "var(--red)" : "var(--accent)",
                        transition: "width 200ms ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 64 }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</p>
            <p className="type-label">Total</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 64, borderColor: "rgba(155,104,41,0.25)", background: "var(--amber-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--amber)" }}>{stats.enAttente}</p>
            <p className="type-label">En attente</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 64, borderColor: "rgba(21,190,83,0.2)", background: "var(--green-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--green)" }}>{stats.acceptees}</p>
            <p className="type-label">Acceptées</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 64, borderColor: "rgba(234,34,97,0.2)", background: "var(--red-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--red)" }}>{stats.annulees}</p>
            <p className="type-label">Annulées</p>
          </div>
        </div>
      </div>

      {/* ── Search (elevated) ──────────────────────── */}
      {isElevated && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par email, expéditeur, description…"
            />
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => loadTransferts(search)}>
            Rechercher
          </Button>
        </div>
      )}

      {/* ── Alerts ─────────────────────────────────── */}
      {msg && <div className="lb-alert-success">{msg}</div>}
      {err && <div className="lb-alert-error">{err}</div>}

      {/* ── Tabs + contenu utilisateur ─────────────── */}
      {canSubmit && (
        <>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
            <button style={tabStyle(tab === "envoyer")} onClick={() => { setMsg(null); setErr(null); setTab("envoyer"); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
              Envoyer
            </button>
            <button style={tabStyle(tab === "reclamer")} onClick={() => { setMsg(null); setErr(null); setTab("reclamer"); loadAReclamer(); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4M17 8l-5 5-5-5M12 13V3" />
              </svg>
              À réclamer
              {aReclamer.length > 0 && (
                <span className="lb-badge lb-badge-amber" style={{ marginLeft: 2 }}>{aReclamer.length}</span>
              )}
            </button>
            <button style={tabStyle(tab === "autodeposit")} onClick={() => { setAdMsg(null); setAdErr(null); setTab("autodeposit"); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Auto-dépôt
              {autoDeposit?.statut === "ACTIVE" && (
                <span className="lb-badge lb-badge-green" style={{ marginLeft: 2 }}>Actif</span>
              )}
            </button>
            <button style={tabStyle(tab === "beneficiaires")} onClick={() => { setBenMsg(null); setBenErr(null); setTab("beneficiaires"); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              Bénéficiaires
              {beneficiaires.length > 0 && (
                <span className="lb-badge lb-badge-muted" style={{ marginLeft: 2 }}>{beneficiaires.length}</span>
              )}
            </button>
          </div>

          {/* ── Onglet Envoyer ──────────────────── */}
          {tab === "envoyer" && (
            benLoading ? (
              <p style={{ fontSize: 13, color: "var(--t3)", padding: "24px 0" }} className="lb-loading">
                Chargement…
              </p>
            ) : beneficiaires.length === 0 ? (
              /* ── Aucun bénéficiaire : écran vide avec CTA ── */
              <Card className="p-6 md:p-7">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "24px 0", textAlign: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="26" height="26" fill="none" stroke="var(--t3)" strokeWidth={1.6} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>
                      Aucun bénéficiaire enregistré
                    </p>
                    <p style={{ fontSize: 13, color: "var(--t2)", maxWidth: 360 }}>
                      Pour envoyer un virement Interac, vous devez d'abord ajouter un bénéficiaire (alias + courriel) dans l'onglet Bénéficiaires.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => { setBenMsg(null); setBenErr(null); setTab("beneficiaires"); }}
                  >
                    Ajouter un bénéficiaire
                  </Button>
                </div>
              </Card>
            ) : (
              /* ── Formulaire d'envoi (bénéficiaires disponibles) ── */
              <Card className="p-6 md:p-7">
                <p className="type-label" style={{ marginBottom: 4 }}>Nouveau virement Interac</p>

                {/* Bénéficiaire sélectionné — aperçu */}
                {selectedBenef && (() => {
                  const b = beneficiaires.find(b => String(b.id) === selectedBenef);
                  return b ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "var(--blue-dim)", border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 10, padding: "12px 16px", marginBottom: 16, marginTop: 8,
                    }}>
                      <svg width="16" height="16" fill="none" stroke="var(--stripe-purple)" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
                      </svg>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{b.alias}</p>
                        <p style={{ fontSize: 12, color: "var(--t3)" }}>{b.email_interac}</p>
                      </div>
                    </div>
                  ) : null;
                })()}

                <form onSubmit={handleSend} className="lb-form-grid" style={{ gap: 14 }}>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Select
                      label="Destinataire"
                      value={selectedBenef}
                      onChange={(val) => {
                        setSelectedBenef(val);
                        const b = beneficiaires.find(b => String(b.id) === val);
                        setEmailDest(b ? b.email_interac : "");
                      }}
                      options={[
                        { value: "", label: "— Choisir un bénéficiaire —" },
                        ...beneficiaires.map(b => ({
                          value: String(b.id),
                          label: `${b.alias} — ${b.email_interac}`,
                        })),
                      ]}
                    />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Select
                      label="Compte source à débiter"
                      value={compteSource}
                      onChange={setCompteSource}
                      options={comptesToOptions(comptes)}
                    />
                  </div>
                  <Input
                    label="Montant CAD (0,50 – 3 000)"
                    type="number"
                    placeholder="150.00"
                    value={montant}
                    onChange={setMontant}
                  />
                  <div style={{ gridColumn: "1/-1" }}>
                    <Input
                      label="Message (optionnel)"
                      placeholder="Remboursement dîner…"
                      value={description}
                      onChange={setDescription}
                    />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <Input
                      label="Mot de passe de sécurité (3–25 car. · requis sans auto-dépôt)"
                      type="password"
                      placeholder="Omis si le destinataire a l'auto-dépôt actif"
                      value={motDePasse}
                      onChange={setMotDePasse}
                    />
                  </div>
                  <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={{ fontSize: 13, color: "var(--stripe-purple)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                      onClick={() => { setBenMsg(null); setBenErr(null); setTab("beneficiaires"); }}
                    >
                      + Ajouter un bénéficiaire
                    </button>
                    <Button type="submit" variant="primary" disabled={sendLoading || !selectedBenef || !compteSource || !montant}>
                      {sendLoading ? "Envoi en cours…" : "Envoyer le virement"}
                    </Button>
                  </div>
                </form>
              </Card>
            )
          )}

          {/* ── Onglet À réclamer ───────────────── */}
          {tab === "reclamer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reclamerLoading ? (
                <p style={{ fontSize: 13, color: "var(--t3)", padding: "16px 0" }} className="lb-loading">
                  Chargement…
                </p>
              ) : aReclamer.length === 0 ? (
                <Card className="p-6">
                  <p style={{ fontSize: 13, color: "var(--t3)", textAlign: "center", padding: "16px 0" }}>
                    Aucun virement en attente de réclamation.
                  </p>
                </Card>
              ) : (
                aReclamer.map(t => (
                  <div
                    key={t.id}
                    className="lb-card"
                    style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {/* Montant pill */}
                      <div style={{
                        background: "var(--green-dim)",
                        border: "1px solid rgba(21,190,83,0.2)",
                        borderRadius: 8,
                        padding: "10px 16px",
                        textAlign: "center",
                        minWidth: 100,
                        flexShrink: 0,
                      }}>
                        <p className="type-mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--green)", letterSpacing: "-0.02em" }}>
                          {formatMoney(t.montant)}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
                          De {t.expediteur_nom}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{t.expediteur_email}</p>
                        {t.description && (
                          <p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4, fontStyle: "italic" }}>
                            « {t.description} »
                          </p>
                        )}
                        <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>
                          Envoyé le {formatDateShort(t.date_envoi)} · Expire le {formatDateShort(t.date_expiration)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setReclamerForm({
                          id: t.id,
                          expediteur: t.expediteur_nom,
                          montant: formatMoney(t.montant),
                          requiert_mdp: t.requiert_mot_de_passe ?? true,
                        });
                        setReclamerMdp("");
                      }}
                    >
                      Réclamer
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Onglet Bénéficiaires ────────────── */}
          {tab === "beneficiaires" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {benMsg && <div className="lb-alert-success">{benMsg}</div>}
              {benErr && <div className="lb-alert-error">{benErr}</div>}

              {/* Formulaire d'ajout */}
              <Card className="p-6 md:p-7">
                <p className="type-label" style={{ marginBottom: 4 }}>Ajouter un bénéficiaire</p>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)", marginBottom: 16 }}>
                  Nouveau destinataire fréquent
                </h2>
                <form onSubmit={handleAddBenef} className="lb-form-grid" style={{ gap: 14 }}>
                  <Input
                    label="Alias (ex : Maman, Loyer Marc)"
                    placeholder="Nom court pour identifier ce bénéficiaire"
                    value={benAlias}
                    onChange={setBenAlias}
                  />
                  <Input
                    label="Courriel Interac"
                    type="email"
                    placeholder="destinataire@exemple.com"
                    value={benEmail}
                    onChange={setBenEmail}
                  />
                  <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}>
                    <Button type="submit" variant="primary" disabled={benFormLoading || !benAlias.trim() || !benEmail.trim()}>
                      {benFormLoading ? "Ajout en cours…" : "Ajouter le bénéficiaire"}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Liste des bénéficiaires */}
              <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Mes bénéficiaires</p>
                  <span className="lb-badge lb-badge-muted">
                    {beneficiaires.length} bénéficiaire{beneficiaires.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {benLoading ? (
                  <p style={{ padding: "24px", fontSize: 13, color: "var(--t3)" }} className="lb-loading">
                    Chargement…
                  </p>
                ) : beneficiaires.length === 0 ? (
                  <p style={{ padding: "28px 24px", fontSize: 13, color: "var(--t3)", textAlign: "center" }}>
                    Aucun bénéficiaire enregistré. Ajoutez-en un ci-dessus pour accélérer vos prochains envois Interac.
                  </p>
                ) : (
                  <div className="lb-scroll lb-table-scroll">
                    <table className="lb-table">
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: 24 }}>Alias</th>
                          <th>Courriel Interac</th>
                          <th>Ajouté le</th>
                          <th style={{ paddingRight: 24 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beneficiaires.map(b => (
                          <tr key={b.id}>
                            <td style={{ paddingLeft: 24 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{b.alias}</p>
                            </td>
                            <td style={{ fontSize: 13, color: "var(--t2)" }}>{b.email_interac}</td>
                            <td style={{ fontSize: 12, color: "var(--t3)" }}>
                              {new Date(b.cree_le).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" })}
                            </td>
                            <td style={{ paddingRight: 24 }}>
                              <Button type="button" variant="danger" onClick={() => setBenDeleteTarget(b)}>
                                Supprimer
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Onglet Auto-dépôt ───────────────── */}
          {tab === "autodeposit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {adMsg && <div className="lb-alert-success">{adMsg}</div>}
              {adErr && <div className="lb-alert-error">{adErr}</div>}

              {autoDeposit?.statut === "ACTIVE" ? (
                /* Profil actif */
                <Card className="p-6 md:p-7">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <p className="type-label" style={{ marginBottom: 4 }}>Auto-dépôt Interac</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>Profil actif</h2>
                        <span className="lb-badge lb-badge-green">Actif</span>
                      </div>
                    </div>
                    <Button variant="danger" disabled={adLoading} onClick={() => setAdConfirmDesactiver(true)}>
                      Désactiver
                    </Button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                    <div className="lb-surface" style={{ padding: "14px 16px" }}>
                      <p className="type-label" style={{ marginBottom: 6 }}>Courriel Interac</p>
                      <p style={{ fontSize: 14, color: "var(--t1)", fontWeight: 500 }}>{autoDeposit.email_interac}</p>
                    </div>
                    <div className="lb-surface" style={{ padding: "14px 16px" }}>
                      <p className="type-label" style={{ marginBottom: 6 }}>Compte de dépôt</p>
                      <p className="type-mono" style={{ fontSize: 12, color: "var(--t1)" }}>{autoDeposit.numero_compte}</p>
                      <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{autoDeposit.type_compte}</p>
                    </div>
                    <div className="lb-surface" style={{ padding: "14px 16px" }}>
                      <p className="type-label" style={{ marginBottom: 6 }}>Actif depuis</p>
                      <p style={{ fontSize: 13, color: "var(--t2)" }}>{formatDateShort(autoDeposit.cree_le ?? null)}</p>
                    </div>
                  </div>
                  <p style={{ marginTop: 16, fontSize: 13, color: "var(--t3)" }}>
                    Les virements envoyés à <strong style={{ color: "var(--t2)" }}>{autoDeposit.email_interac}</strong> seront crédités automatiquement sans mot de passe.
                  </p>
                </Card>
              ) : (
                /* Activation directe (1 étape) */
                <Card className="p-6 md:p-7">
                  <p className="type-label" style={{ marginBottom: 4 }}>Configuration</p>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>
                    Activer l'auto-dépôt
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
                    Recevez les virements directement sur votre compte, sans mot de passe à saisir.
                  </p>
                  <form onSubmit={handleActiverAD} className="lb-form-grid" style={{ gap: 14 }}>
                    <Input
                      label="Courriel Interac"
                      type="email"
                      placeholder="votre@courriel.com"
                      value={adEmail}
                      onChange={setAdEmail}
                    />
                    <Select
                      label="Compte de dépôt"
                      value={adCompte}
                      onChange={setAdCompte}
                      options={comptesToOptions(comptes, true)}
                    />
                    <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}>
                      <Button type="submit" variant="primary" disabled={adLoading || !adEmail || !adCompte}>
                        {adLoading ? "Activation…" : "Activer"}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Modal : Réclamer un virement ──────────── */}
      {reclamerForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>
              Réclamer le virement #{reclamerForm.id}
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              De <strong>{reclamerForm.expediteur}</strong> · <span style={{ color: "var(--green)", fontWeight: 600 }}>{reclamerForm.montant}</span>
            </p>
            <form onSubmit={handleReclamer} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Select
                label="Compte de réception"
                value={reclamerCompte}
                onChange={setReclamerCompte}
                options={comptesToOptions(reclamerComptes)}
              />
              {reclamerForm.requiert_mdp && (
                <Input
                  label="Mot de passe de sécurité"
                  type="password"
                  placeholder="Mot de passe communiqué par l'expéditeur"
                  value={reclamerMdp}
                  onChange={setReclamerMdp}
                />
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <Button type="button" variant="secondary" onClick={() => { setReclamerForm(null); setReclamerMdp(""); }}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={reclamerLoading || !reclamerCompte || (reclamerForm.requiert_mdp && !reclamerMdp.trim())}
                >
                  {reclamerLoading ? "Réclamation…" : "Confirmer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal : Annuler un virement ───────────── */}
      {cancelId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              Annuler le virement #{cancelId} ?
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              Le montant sera immédiatement remboursé sur votre compte source.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setCancelId(null)}>Retour</Button>
              <Button type="button" variant="danger" onClick={() => handleCancel(cancelId)}>Confirmer l'annulation</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Désactiver auto-dépôt ─────────── */}
      {adConfirmDesactiver && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              Désactiver l'auto-dépôt ?
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
              Les futurs virements envoyés à votre courriel Interac nécessiteront un mot de passe pour être réclamés.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setAdConfirmDesactiver(false)}>Annuler</Button>
              <Button type="button" variant="danger" onClick={handleDesactiverAD}>Désactiver</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Supprimer un bénéficiaire ─────── */}
      {benDeleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              Supprimer ce bénéficiaire ?
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 6 }}>
              <strong>{benDeleteTarget.alias}</strong> — {benDeleteTarget.email_interac}
            </p>
            <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 20 }}>
              Cette action est irréversible.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setBenDeleteTarget(null)}>Retour</Button>
              <Button type="button" variant="danger" onClick={confirmDeleteBenef}>Supprimer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Historique des transferts ──────────────── */}
      <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
            {isElevated ? "Tous les virements Interac" : "Historique Interac"}
          </p>
          <span className="lb-badge lb-badge-muted">{transferts.length} ligne{transferts.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="lb-scroll lb-table-scroll">
          {loading ? (
            <p style={{ padding: "24px", fontSize: 13, color: "var(--t3)" }} className="lb-loading">Chargement…</p>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>ID</th>
                  <th>Date</th>
                  {isElevated && <th>Expéditeur</th>}
                  <th>Destinataire</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                  <th>Description</th>
                  <th>Statut</th>
                  <th>Expiration</th>
                  {canSubmit && <th style={{ paddingRight: 24 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transferts.map(t => (
                  <tr key={t.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 600, color: "var(--t2)" }}>#{t.id}</td>
                    <td style={{ fontSize: 12, color: "var(--t3)" }}>{formatDateShort(t.date_envoi)}</td>
                    {isElevated && (
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{t.expediteur_nom}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)" }}>{t.expediteur_email}</p>
                      </td>
                    )}
                    <td style={{ fontSize: 13, color: "var(--t2)" }}>{t.email_destinataire}</td>
                    <td
                      className="type-mono"
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: t.statut === "ACCEPTEE"
                          ? "var(--green)"
                          : t.statut === "EN_ATTENTE"
                          ? "var(--amber)"
                          : "var(--t3)",
                      }}
                    >
                      {formatMoney(t.montant)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--t3)" }}>{t.description ?? "—"}</td>
                    <td>{statutBadge(t.statut)}</td>
                    <td style={{ fontSize: 12, color: "var(--t3)" }}>
                      {t.statut === "EN_ATTENTE" ? formatDateShort(t.date_expiration) : "—"}
                    </td>
                    {canSubmit && (
                      <td style={{ paddingRight: 24 }}>
                        {t.statut === "EN_ATTENTE" && t.expediteur_id === user?.id ? (
                          <Button type="button" variant="danger" onClick={() => setCancelId(t.id)}>
                            Annuler
                          </Button>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {transferts.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "28px", fontSize: 13, color: "var(--t3)" }}>
                      Aucun virement Interac trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
