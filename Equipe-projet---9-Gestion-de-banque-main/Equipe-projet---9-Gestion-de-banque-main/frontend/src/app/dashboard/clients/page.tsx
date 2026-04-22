"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, Client } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

function formatMoney(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

/* ── Account number reveal ───────────────────────────────────── */
function isFullNumber(n: string) { return /^\d{4} \d{4} \d{4}$/.test(n.trim()); }
function maskAccountNumber(n: string) {
  if (isFullNumber(n)) return `**** **** ${n.split(" ").pop()}`;
  return n;
}
function useAccountReveal(targetNumber: string) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canReveal = isFullNumber(targetNumber);
  const toggle = React.useCallback(() => { if (canReveal) setRevealed((v) => !v); }, [canReveal]);
  const copy   = React.useCallback(async () => {
    try { await navigator.clipboard.writeText(targetNumber.replace(/\s/g, "")); setCopied(true); timerRef.current = setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  }, [targetNumber]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return { revealed, display: revealed ? targetNumber : maskAccountNumber(targetNumber), toggle, copy, copied, canReveal };
}

/* ── Banking coord mini-row ──────────────────────────────────── */
function CoordRow({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* */ }
  };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.72)", letterSpacing: "0.06em" }}>{value}</span>
        <button onClick={handleCopy} style={{ background: "none", border: "none", padding: "1px 3px", cursor: "pointer", color: copied ? "#6EE7B7" : "rgba(255,255,255,0.28)", fontSize: 9, borderRadius: 3 }}>{copied ? "✓" : "⧉"}</button>
      </div>
    </div>
  );
}

/* ── Account card with reveal + coords ──────────────────────── */
function AccountCardReveal({ a, showClient = false, isElevated = false }: { a: Account; showClient?: boolean; isElevated?: boolean }) {
  const { revealed, display, toggle, copy, copied, canReveal } = useAccountReveal(a.numero_compte);
  const [showCoords, setShowCoords] = useState(false);
  return (
    <div className={cardClass(a.type_compte)}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="card-chip" />
          <span className="lb-badge" style={{ background: "rgba(0,0,0,0.25)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.65)", fontSize: 10 }}>
            {a.est_actif ? "ACTIF" : "INACTIF"}
          </span>
        </div>

        {/* Number row */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 5 }}>
          <p style={{ fontFamily: "monospace", fontSize: 14, letterSpacing: "0.14em", color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>
            {display}
          </p>
          <div style={{ display: "flex", gap: 5 }}>
            {canReveal ? (
              <>
                <button onClick={toggle} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "3px 8px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 10, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3 }}>
                  {revealed ? "Masquer" : "Voir"}
                </button>
                {revealed && (
                  <button onClick={copy} style={{ background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)", border: copied ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "3px 8px", color: copied ? "#6EE7B7" : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 10, fontFamily: "inherit", transition: "all 150ms" }}>
                    {copied ? "Copié !" : "Copier"}
                  </button>
                )}
              </>
            ) : (
              <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>Numéro partiel</span>
            )}
          </div>
        </div>

        {showClient && a.client_prenom && a.client_nom && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", marginTop: 4 }}>{a.client_prenom} {a.client_nom}</p>
        )}
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{a.type_compte} · {a.devise}</p>
        <p style={{ marginTop: 14, fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#fff" }}>{formatMoney(a.solde)}</p>

        {/* Banking coordinates */}
        {(a.numero_institution || a.numero_transit || a.swift_bic) && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowCoords((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10, color: "rgba(255,255,255,0.38)", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              {showCoords ? "▲" : "▼"} Coordonnées bancaires
            </button>
            {showCoords && (
              <div style={{ marginTop: 7, padding: "9px 11px", background: "rgba(0,0,0,0.22)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 5 }}>
                <CoordRow label="No compte"   value={revealed ? a.numero_compte : display} />
                <CoordRow label="Institution" value={a.numero_institution} />
                <CoordRow label="Transit"     value={a.numero_transit} />
                <CoordRow label="SWIFT / BIC" value={a.swift_bic} />
                {a.numero_transit && a.numero_institution && (
                  <div style={{ marginTop: 4, paddingTop: 5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", lineHeight: 1.5 }}>
                      Format chèque : {a.numero_transit}-{a.numero_institution} · Leon Bank
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <Link href={`/dashboard/comptes/${a.id}`} style={{ display: "block" }}>
            <button type="button" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Voir les transactions
            </button>
          </Link>

          {!isElevated && a.est_actif && (
            <div className="lb-form-grid">
              <Link href="/dashboard/virements" style={{ display: "block" }}>
                <button type="button" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "rgba(147,197,253,0.12)", border: "1px solid rgba(147,197,253,0.2)", color: "#93C5FD", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>⇄ Virement</button>
              </Link>
              <Link href="/dashboard/factures" style={{ display: "block" }}>
                <button type="button" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "rgba(252,211,77,0.10)", border: "1px solid rgba(252,211,77,0.2)", color: "#FCD34D", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✉ Facture</button>
              </Link>
              {(a.type_compte === "CHEQUES" || a.type_compte === "EPARGNE") && (
                <>
                  <Link href="/dashboard/retraits" style={{ display: "block" }}>
                    <button type="button" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "rgba(252,165,165,0.10)", border: "1px solid rgba(252,165,165,0.2)", color: "#FCA5A5", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↓ Retrait</button>
                  </Link>
                  <Link href="/dashboard/depots" style={{ display: "block" }}>
                    <button type="button" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "rgba(110,231,183,0.10)", border: "1px solid rgba(110,231,183,0.2)", color: "#6EE7B7", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↑ Dépôt</button>
                  </Link>
                </>
              )}
              {a.type_compte === "CREDIT" && (
                <Link href="/dashboard/cartes" style={{ display: "block", gridColumn: "1/-1" }}>
                  <button type="button" style={{ width: "100%", padding: "7px 8px", borderRadius: 8, background: "rgba(110,231,183,0.10)", border: "1px solid rgba(110,231,183,0.2)", color: "#6EE7B7", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>⊞ Mes cartes</button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── countUp hook ─────────────────────────────────────────────── */
function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) { setValue(target); return; }

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, durationMs]);

  return value;
}

/* ── Client avatar colors (ID-based) ────────────────────────── */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#047857,#10B981)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#BE185D,#F472B6)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
];
function clientAvatarGradient(id: number) {
  return AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];
}

function cardClass(type: string): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("épargne") || t.includes("epargne") || t.includes("saving")) return "account-card account-card-green";
  if (t.includes("chèque") || t.includes("cheque") || t.includes("courant") || t.includes("checking")) return "account-card account-card-blue";
  if (t.includes("or") || t.includes("gold") || t.includes("premium")) return "account-card account-card-gold";
  return "account-card account-card-dark";
}

/* ╔══════════════════════════════════════════════════╗
   ║  CLIENT VIEW — "Mes comptes"                     ║
   ╚══════════════════════════════════════════════════╝ */
function ClientView() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiGet<{ data: Account[] }>("/comptes")
      .then((res) => { if (mounted) setAccounts(res.data); })
      .catch((e: any) => { if (mounted) setError(e?.message ?? "Erreur de chargement"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.solde), 0),
    [accounts]
  );
  const animatedBalance = useCountUp(totalBalance);

  const activeCount = accounts.filter((a) => a.est_actif).length;
  const today = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
        <p style={{ color: "var(--t3)", fontSize: 14 }} className="lb-loading">Chargement de vos comptes…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header row ─────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>Bonjour</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            {user?.prenom} {user?.nom}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4, textAlign: "right" }}>{today}</p>
      </div>

      {/* ── Balance hero ───────────────────────────── */}
      <div
        style={{
          borderRadius: 20,
          padding: "32px 36px",
          background: "linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 60%, #0F2060 100%)",
          border: "1px solid rgba(29,78,216,0.35)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -40, top: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", right: 40, bottom: -80, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <div style={{ position: "relative" }}>
          <p className="type-label" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>Solde total disponible</p>
          <p className="balance-hero" style={{ color: "#fff" }}>{formatMoney(animatedBalance)}</p>
          <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
            <div><p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{accounts.length} compte{accounts.length > 1 ? "s" : ""}</p></div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.15)" }} />
            <div><p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{activeCount} actif{activeCount > 1 ? "s" : ""}</p></div>
          </div>
        </div>
      </div>

      {error && <div className="lb-alert-error">{error}</div>}

      {/* ── Account cards ──────────────────────────── */}
      <div>
        <p className="type-label" style={{ marginBottom: 14 }}>Mes comptes</p>
        <div className="lb-grid-cards" style={{ gap: 16 }}>
          {accounts.map((a) => (
            <AccountCardReveal key={a.id} a={a} />
          ))}
          {accounts.length === 0 && (
            <p style={{ color: "var(--t3)", fontSize: 14, gridColumn: "1/-1", padding: "24px 0" }}>Aucun compte associé à votre profil.</p>
          )}
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────── */}
      <div>
        <p className="type-label" style={{ marginBottom: 14 }}>Actions rapides</p>
        <div className="lb-grid-cards">
          <Link href="/dashboard/virements" className="lb-quick-action">
            <div className="lb-quick-action-icon">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0-4-4m4 4-4 4M16 17H4m0 0 4 4m-4-4 4-4" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Virement</p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>Transférer des fonds</p>
          </Link>
          <Link href="/dashboard/factures" className="lb-quick-action">
            <div className="lb-quick-action-icon">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Factures</p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>Consulter et payer</p>
          </Link>
          <Link href="/dashboard/cartes" className="lb-quick-action">
            <div className="lb-quick-action-icon">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="6" y1="15" x2="9" y2="15" />
                <line x1="11" y1="15" x2="14" y2="15" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Cartes</p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>Gérer vos cartes</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════╗
   ║  ELEVATED VIEW — Admin / Modérateur              ║
   ╚══════════════════════════════════════════════════╝ */
function ElevatedView() {
  const { user } = useAuth();

  // ── Client list state ────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ── Nouveau client form ──────────────────────────
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState({ prenom: "", nom: "", email_fictif: "", ville: "", utilisateur_id: "", auto_validation: false });
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [clientFormLoading, setClientFormLoading] = useState(false);

  // ── Nouveau compte form ──────────────────────────
  const [showCompteForm, setShowCompteForm] = useState(false);
  const [compteType, setCompteType] = useState<"CHEQUES" | "EPARGNE" | "CREDIT">("CHEQUES");
  const [compteFormError, setCompteFormError] = useState<string | null>(null);
  const [compteFormLoading, setCompteFormLoading] = useState(false);

  // ── Load clients ─────────────────────────────────
  const loadClients = async (nextSearch = search) => {
    setError(null);
    setLoadingClients(true);
    try {
      const query = nextSearch.trim().length > 0
        ? `/clients?search=${encodeURIComponent(nextSearch.trim())}`
        : "/clients";
      const res = await apiGet<{ data: Client[] }>(query);
      setClients(res.data);
      setSelectedClientId((current) => {
        if (res.data.length === 0) return null;
        if (current && res.data.some((c) => c.id === current)) return current;
        return res.data[0]?.id ?? null;
      });
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement");
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadClients("").catch(() => {}).finally(() => { if (!mounted) return; });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedClientId) { setAccounts([]); return; }
    let mounted = true;
    setLoadingAccounts(true);
    apiGet<{ data: Account[] }>(`/clients/${selectedClientId}/comptes`)
      .then((res) => { if (mounted) setAccounts(res.data); })
      .catch((e: any) => { if (mounted) setError(e?.message ?? "Erreur"); })
      .finally(() => { if (mounted) setLoadingAccounts(false); });
    return () => { mounted = false; };
  }, [selectedClientId]);

  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId), [clients, selectedClientId]);
  const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.solde), 0), [accounts]);

  // ── Créer un client ──────────────────────────────
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientFormError(null);
    setClientFormLoading(true);
    try {
      const body: Record<string, unknown> = {
        prenom: clientForm.prenom.trim(),
        nom: clientForm.nom.trim(),
        email_fictif: clientForm.email_fictif.trim(),
      };
      if (clientForm.ville.trim()) body.ville = clientForm.ville.trim();
      if (clientForm.utilisateur_id.trim()) {
        body.utilisateur_id = Number(clientForm.utilisateur_id.trim());
      }
      body.auto_validation = clientForm.auto_validation;

      await apiPost("/clients", body);
      setShowClientForm(false);
      setClientForm({ prenom: "", nom: "", email_fictif: "", ville: "", utilisateur_id: "", auto_validation: false });
      await loadClients(search);
    } catch (e: any) {
      setClientFormError(e?.message ?? "Erreur lors de la création");
    } finally {
      setClientFormLoading(false);
    }
  };

  // ── Ouvrir un compte ─────────────────────────────
  const handleCreateCompte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;
    setCompteFormError(null);
    setCompteFormLoading(true);
    try {
      await apiPost("/comptes", { client_id: selectedClientId, type_compte: compteType });
      setShowCompteForm(false);
      // Reload accounts for selected client
      const res = await apiGet<{ data: Account[] }>(`/clients/${selectedClientId}/comptes`);
      setAccounts(res.data);
    } catch (e: any) {
      setCompteFormError(e?.message ?? "Erreur lors de la création");
    } finally {
      setCompteFormLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ───────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>
            {user?.role === "ADMIN" ? "Administration" : "Supervision"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            Gestion des clients
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="lb-stat" style={{ textAlign: "center" }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700 }}>{clients.length}</p>
            <p className="type-label">Clients</p>
          </div>
          <div className="lb-stat-accent" style={{ textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#93C5FD" }}>{accounts.length}</p>
            <p className="type-label">Comptes</p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => { setShowClientForm((v) => !v); setShowCompteForm(false); }}
          >
            {showClientForm ? "Annuler" : "+ Nouveau client"}
          </Button>
        </div>
      </div>

      {/* ── Formulaire nouveau client ─────────────────── */}
      {showClientForm && (
        <Card>
          <form onSubmit={handleCreateClient} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>Nouveau client</p>
            <div className="lb-form-grid" style={{ gap: 12 }}>
              <Input
                label="Prénom *"
                value={clientForm.prenom}
                onChange={(v) => setClientForm((f) => ({ ...f, prenom: v }))}
                placeholder="Alice"
              />
              <Input
                label="Nom *"
                value={clientForm.nom}
                onChange={(v) => setClientForm((f) => ({ ...f, nom: v }))}
                placeholder="Martin"
              />
              <Input
                label="Email fictif *"
                value={clientForm.email_fictif}
                onChange={(v) => setClientForm((f) => ({ ...f, email_fictif: v }))}
                placeholder="alice.martin@demo.com"
              />
              <Input
                label="Ville (optionnel)"
                value={clientForm.ville}
                onChange={(v) => setClientForm((f) => ({ ...f, ville: v }))}
                placeholder="Montréal"
              />
              <Input
                label="ID utilisateur à lier (optionnel)"
                value={clientForm.utilisateur_id}
                onChange={(v) => setClientForm((f) => ({ ...f, utilisateur_id: v }))}
                placeholder="ex: 3"
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: clientForm.auto_validation ? "rgba(110,231,183,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${clientForm.auto_validation ? "rgba(110,231,183,0.25)" : "var(--border)"}`, cursor: "pointer", transition: "all 150ms" }}>
                <div style={{ position: "relative", width: 40, height: 22, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={clientForm.auto_validation}
                    onChange={(e) => setClientForm((f) => ({ ...f, auto_validation: e.target.checked }))}
                    style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
                  />
                  <div style={{ position: "absolute", inset: 0, borderRadius: 11, background: clientForm.auto_validation ? "#10B981" : "var(--surface-2)", border: "1px solid var(--border)", transition: "background 200ms" }} />
                  <div style={{ position: "absolute", top: 3, left: clientForm.auto_validation ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: clientForm.auto_validation ? "#6EE7B7" : "var(--t1)" }}>Auto-validation</p>
                  <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Les dépôts et retraits de cet utilisateur seront approuvés automatiquement</p>
                </div>
              </label>
            {clientFormError && <div className="lb-alert-error">{clientFormError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <Button type="submit" variant="primary" disabled={clientFormLoading}>
                {clientFormLoading ? "Création…" : "Créer le client"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowClientForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Search bar ───────────────────────────────── */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Rechercher par ID, prénom, nom…"
          />
        </div>
        <Button type="button" variant="secondary" disabled={loadingClients} onClick={() => loadClients(search)}>
          Rechercher
        </Button>
      </div>

      {error && <div className="lb-alert-error">{error}</div>}

      {/* ── Main split grid ──────────────────────────── */}
      <div className="lb-layout-sidebar" style={{ alignItems: "start" }}>

        {/* Client list */}
        <Card className="p-0">
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Liste des clients</p>
            {loadingClients ? (
              <span style={{ fontSize: 12, color: "var(--t3)" }} className="lb-loading">Chargement…</span>
            ) : (
              <span className="lb-badge lb-badge-muted">{clients.length}</span>
            )}
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }} className="lb-scroll">
            {clients.map((c) => {
              const active = c.id === selectedClientId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClientId(c.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 20px",
                    background: active ? "var(--blue-dim)" : "transparent",
                    cursor: "pointer",
                    transition: "background 130ms",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: clientAvatarGradient(c.id),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                    color: "rgba(255,255,255,0.92)",
                    opacity: active ? 1 : 0.75,
                    transition: "opacity 130ms",
                  }}>
                    {c.prenom?.charAt(0)?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: active ? "#93C5FD" : "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.prenom} {c.nom}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.email_fictif}
                    </p>
                  </div>
                  <span className="lb-badge lb-badge-muted" style={{ flexShrink: 0 }}>#{c.id}</span>
                </button>
              );
            })}
            {clients.length === 0 && !loadingClients && (
              <p style={{ padding: "24px 20px", fontSize: 13, color: "var(--t3)" }}>Aucun client trouvé.</p>
            )}
          </div>
        </Card>

        {/* Account panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {selectedClient && (
            /* Client info strip + bouton ouvrir compte */
            <div
              style={{
                borderRadius: 14,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                padding: "16px 22px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <p className="type-label" style={{ marginBottom: 4 }}>Client sélectionné</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>
                  {selectedClient.prenom} {selectedClient.nom}
                </p>
                <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{selectedClient.email_fictif}</p>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "right" }}>
                  <p className="type-label">Comptes</p>
                  <p className="lb-num" style={{ fontSize: 18, fontWeight: 700 }}>{accounts.length}</p>
                </div>
                {accounts.length > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <p className="type-label">Solde total</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: totalBalance >= 0 ? "#6EE7B7" : "#FCA5A5" }}>
                      {formatMoney(totalBalance)}
                    </p>
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowCompteForm((v) => !v); setShowClientForm(false); }}
                >
                  {showCompteForm ? "Annuler" : "+ Ouvrir un compte"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Formulaire nouveau compte ──────────────── */}
          {showCompteForm && selectedClient && (
            <Card>
              <form onSubmit={handleCreateCompte} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>
                  Ouvrir un compte — {selectedClient.prenom} {selectedClient.nom}
                </p>
                <div>
                  <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 8 }}>Type de compte *</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["CHEQUES", "EPARGNE", "CREDIT"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setCompteType(type)}
                        style={{
                          flex: 1,
                          padding: "12px 8px",
                          borderRadius: 10,
                          border: `1px solid ${compteType === type ? "var(--blue)" : "var(--border)"}`,
                          background: compteType === type ? "var(--blue-dim)" : "var(--surface)",
                          color: compteType === type ? "#93C5FD" : "var(--t2)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 150ms",
                        }}
                      >
                        {type === "CHEQUES" ? "Chèques" : type === "EPARGNE" ? "Épargne" : "Crédit"}
                      </button>
                    ))}
                  </div>
                </div>
                {compteFormError && <div className="lb-alert-error">{compteFormError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <Button type="submit" variant="primary" disabled={compteFormLoading}>
                    {compteFormLoading ? "Ouverture…" : "Ouvrir le compte"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowCompteForm(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Account cards */}
          <div className="lb-grid-cards" style={{ gap: 14 }}>
            {accounts.map((a) => (
              <AccountCardReveal key={a.id} a={a} isElevated={true} />
            ))}
            {!loadingAccounts && selectedClientId && accounts.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--t3)", padding: "16px 0" }}>Aucun compte pour ce client.</p>
            )}
            {loadingAccounts && (
              <p style={{ fontSize: 13, color: "var(--t3)" }} className="lb-loading">Chargement des comptes…</p>
            )}
            {!selectedClientId && (
              <p style={{ fontSize: 13, color: "var(--t3)", gridColumn: "1/-1" }}>Sélectionnez un client pour voir ses comptes.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Router ─────────────────────────────────────────── */
export default function ClientsPage() {
  const { user } = useAuth();
  const isElevated = user?.role === "ADMIN" || user?.role === "MODERATEUR";
  return isElevated ? <ElevatedView /> : <ClientView />;
}
