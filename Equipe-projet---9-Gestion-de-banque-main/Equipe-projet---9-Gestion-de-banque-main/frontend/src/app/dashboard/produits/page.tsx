"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { DemandeProduit } from "@/lib/types";
import AdminDemandesView from "@/components/AdminDemandesView";

const CreditCard3D = dynamic(() => import("@/components/CreditCard3D"), { ssr: false });

/* ── helpers ─────────────────────────────────────── */
function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}
function fmtLabel(tp: string) {
  return tp === "CARTE_VISA" ? "Carte VISA"
       : tp === "CARTE_MASTERCARD" ? "Carte Mastercard"
       : tp === "COMPTE_CHEQUES"   ? "Compte chèques"
       : "Compte épargne";
}

/* ── status badge ────────────────────────────────── */
function StatutBadge({ statut, small }: { statut: string; small?: boolean }) {
  const sz = small ? { fontSize: 9, padding: "2px 7px" } : { fontSize: 10, padding: "3px 9px" };
  const style: React.CSSProperties = {
    ...sz,
    borderRadius: 20, fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase" as const, display: "inline-block",
    ...(statut === "APPROUVEE"
      ? { background: "rgba(16,185,129,0.18)", color: "#34d399", border: "1px solid rgba(16,185,129,0.35)" }
      : statut === "REFUSEE"
      ? { background: "rgba(239,68,68,0.18)", color: "#f87171", border: "1px solid rgba(239,68,68,0.35)" }
      : { background: "rgba(245,158,11,0.18)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.35)" }),
  };
  return <span style={style}>{statut === "APPROUVEE" ? "Approuvée" : statut === "REFUSEE" ? "Refusée" : "En attente"}</span>;
}

/* ── EMV chip SVG ─────────────────────────────────── */
function Chip() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
      <rect width="36" height="28" rx="4" fill="url(#chip)" />
      <line x1="12" y1="0" x2="12" y2="28" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <line x1="24" y1="0" x2="24" y2="28" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <line x1="0" y1="9"  x2="36" y2="9"  stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <line x1="0" y1="19" x2="36" y2="19" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <defs>
        <linearGradient id="chip" x1="0" y1="0" x2="36" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d4a84b" />
          <stop offset="0.5" stopColor="#f0c860" />
          <stop offset="1" stopColor="#b8922e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── full visual card inside each product tile ───── */
function ProductCard({
  type, cardholderName, statut,
}: {
  type: "CARTE_VISA" | "CARTE_MASTERCARD" | "COMPTE_CHEQUES" | "COMPTE_EPARGNE";
  cardholderName: string;
  statut?: string;
}) {
  const isVisa  = type === "CARTE_VISA";
  const isMC    = type === "CARTE_MASTERCARD";
  const isCarte = isVisa || isMC;

  const gradient = isVisa
    ? "linear-gradient(135deg,#1a3a8f 0%,#1e3a8a 40%,#0f2460 100%)"
    : isMC
    ? "linear-gradient(135deg,#7c2d12 0%,#6b2d04 40%,#431a02 100%)"
    : type === "COMPTE_CHEQUES"
    ? "linear-gradient(135deg,#064e3b 0%,#065f46 40%,#022c22 100%)"
    : "linear-gradient(135deg,#3b0764 0%,#4c1d95 40%,#1e0a3c 100%)";

  const maskedNum = isCarte ? "•••• •••• •••• ••••" : "•••• •••• ••••";
  const rightLabel = isCarte
    ? "EXPIRATION"
    : type === "COMPTE_CHEQUES" ? "CHÈQUES" : "ÉPARGNE";
  const rightVal   = isCarte ? "—— / ——" : "LEON BANK · 621";

  return (
    <div style={{
      position: "relative",
      borderRadius: 18,
      padding: "20px 22px 18px",
      background: gradient,
      overflow: "hidden",
      boxShadow: "0 20px 50px rgba(0,0,0,0.70), 0 4px 12px rgba(0,0,0,0.5)",
      minHeight: 180,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      transition: "transform 280ms ease, box-shadow 280ms ease",
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.015) translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 28px 60px rgba(0,0,0,0.80), 0 6px 16px rgba(0,0,0,0.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 50px rgba(0,0,0,0.70), 0 4px 12px rgba(0,0,0,0.5)";
      }}
    >
      {/* shimmer overlay */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
        background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,transparent 50%)",
      }} />
      {/* decorative circles */}
      <div style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 20, bottom: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

      {/* status badge overlay */}
      {statut && (
        <div style={{ position: "absolute", top: 14, right: 14, zIndex: 10 }}>
          <StatutBadge statut={statut} small />
        </div>
      )}

      {/* top row: chip + network */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {isCarte
          ? <Chip />
          : <svg width={24} height={20} viewBox="0 0 24 16" fill="none">
              <rect width="24" height="16" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none" />
              <line x1="0" y1="5.5" x2="24" y2="5.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
            </svg>
        }
        {/* NFC rings for cards */}
        {isCarte && (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" opacity={0.5}>
            {[0,1,2].map((i) => (
              <path key={i} d={`M ${14 - i * 4} 3 Q 20 11 ${14 - i * 4} 19`}
                stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" fill="none"
                strokeLinecap="round" />
            ))}
          </svg>
        )}
      </div>

      {/* number + footer */}
      <div>
        <p style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 13, letterSpacing: "0.20em",
          color: "rgba(255,255,255,0.50)", marginBottom: 16,
        }}>
          {maskedNum}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: 3 }}>
              Titulaire
            </p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.88)", letterSpacing: "0.05em" }}>
              {cardholderName.toUpperCase()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: 3 }}>
              {rightLabel}
            </p>
            <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.70)", letterSpacing: "0.04em" }}>
              {rightVal}
            </p>
          </div>
        </div>

        {/* network watermark — carte uniquement (évite la superposition sur les comptes) */}
        {isCarte && (
          <div style={{ position: "absolute", bottom: 16, right: 20, opacity: 0.22, pointerEvents: "none" }}>
            {isVisa
              ? <span style={{ fontFamily: "serif", fontStyle: "italic", fontWeight: 900, fontSize: 28, color: "#fff", letterSpacing: "-0.02em" }}>VISA</span>
              : <span style={{ fontFamily: "sans-serif", fontWeight: 900, fontSize: 16, color: "#fff", letterSpacing: "0.05em" }}>MASTERCARD</span>
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ── product definitions ─────────────────────────── */
const PRODUCTS = [
  {
    id: "CARTE_VISA" as const,
    label: "Carte VISA",
    sub: "Crédit • International",
    description: "Paiements mondiaux, protection acheteur et plafond personnalisable.",
    features: ["Acceptée dans 200+ pays", "Protection fraude incluse", "Limite sur mesure"],
    accent: "#3b82f6",
  },
  {
    id: "CARTE_MASTERCARD" as const,
    label: "Carte Mastercard",
    sub: "Crédit • Premium",
    description: "Réseau mondial Mastercard avec avantages exclusifs et assurances voyage.",
    features: ["Couverture voyage incluse", "Avantages concierge", "Zéro responsabilité fraude"],
    accent: "#f59e0b",
  },
  {
    id: "COMPTE_CHEQUES" as const,
    label: "Compte chèques",
    sub: "Courant • Sans frais",
    description: "Compte courant pour vos opérations quotidiennes, virements et paiements.",
    features: ["Virements illimités", "Accès instantané 24/7", "Aucun frais de tenue"],
    accent: "#10b981",
  },
  {
    id: "COMPTE_EPARGNE" as const,
    label: "Compte épargne",
    sub: "Placement • Garanti",
    description: "Faites fructifier votre patrimoine avec un taux d'intérêt compétitif.",
    features: ["Taux garanti annuel", "Dépôts et retraits libres", "Aucun minimum requis"],
    accent: "#a855f7",
  },
] as const;

/* ── page ────────────────────────────────────────── */
export default function ProduitsPage() {
  const { user } = useAuth();
  const role = user?.role;

  // Les admins et modérateurs ne peuvent pas soumettre de demande pour
  // leur propre compte : on leur présente plutôt la vue de gestion des
  // demandes soumises par les clients.
  if (role === "ADMIN" || role === "MODERATEUR") {
    return <AdminDemandesView />;
  }

  return <ClientProduitsView user={user} />;
}

function ClientProduitsView({ user }: { user: ReturnType<typeof useAuth>["user"] }) {

  const [demandes, setDemandes]     = useState<DemandeProduit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [cancelId, setCancelId]     = useState<number | null>(null);

  const notify = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4200);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: DemandeProduit[] }>("/demandes-produits");
      setDemandes(res.data);
    } catch (e: any) {
      notify("err", e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const confirmAnnuler = async () => {
    if (cancelId === null) return;
    const id = cancelId;
    setSubmitting(`cancel-${id}`);
    try {
      const res = await apiDelete<{ message: string }>(`/demandes-produits/${id}`);
      notify("ok", res.message);
      setCancelId(null);
      await load();
    } catch (e: any) {
      notify("err", e?.message ?? "Erreur");
    } finally {
      setSubmitting(null);
    }
  };

  const handleDemander = async (type_produit: string) => {
    setSubmitting(type_produit);
    try {
      const res = await apiPost<{ message: string; id: number }>("/demandes-produits", { type_produit });
      notify("ok", res.message);
      await load();
    } catch (e: any) {
      notify("err", e?.message ?? "Erreur");
    } finally {
      setSubmitting(null);
    }
  };

  // Conserve uniquement la demande la plus récente par type (l'API renvoie
  // en ORDER BY cree_le DESC → on garde la première occurrence rencontrée).
  // Sans ça, après un refus, la nouvelle demande EN_ATTENTE est écrasée par
  // l'ancienne REFUSEE et le bouton "Redemander" reste affiché.
  const byType: Record<string, DemandeProduit> = {};
  for (const d of demandes) {
    if (!byType[d.type_produit]) byType[d.type_produit] = d;
  }
  const cardholderName = user ? `${user.prenom} ${user.nom}` : "Leon Bank";

  return (
    <div className="lb-page" style={{ maxWidth: 920, margin: "0 auto" }}>

      {/* ── toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10,
          background: toast.type === "ok" ? "#065f46" : "#7f1d1d",
          border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: toast.type === "ok" ? "#6ee7b7" : "#fca5a5",
          fontSize: 13, boxShadow: "0 8px 30px rgba(0,0,0,0.40)", maxWidth: 340,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ══ Cancel confirmation modal (portal — fixed viewport centering) ══ */}
      {cancelId !== null && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.60)", backdropFilter: "blur(3px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={() => setCancelId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: 24, maxWidth: 420, width: "100%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.60)",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 500, color: "var(--t1)", marginBottom: 8, fontFeatureSettings: '"ss01"' }}>
              Annuler la demande #{cancelId} ?
            </h3>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20, lineHeight: 1.5 }}>
              Cette demande sera définitivement supprimée. Vous pourrez en soumettre une nouvelle à tout moment.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setCancelId(null)}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                Retour
              </button>
              <button
                onClick={confirmAnnuler}
                disabled={submitting === `cancel-${cancelId}`}
                style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                {submitting === `cancel-${cancelId}` ? "Annulation…" : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══ PAGE HEADER ═══════════════════════════════ */}
      <div style={{ marginBottom: 36 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
          textTransform: "uppercase", color: "var(--stripe-purple)", marginBottom: 6,
        }}>
          Leon Bank — Catalogue
        </p>
        <h1 style={{
          fontSize: 28, fontWeight: 300, color: "var(--t1)",
          letterSpacing: "-0.02em", fontFeatureSettings: '"ss01"', lineHeight: 1.15,
        }}>
          Vos produits financiers
        </h1>
      </div>

      {/* ══ CATALOGUE ═════════════════════════════════ */}
      <div style={{ marginBottom: 48 }}>
        {/* section header */}
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          marginBottom: 22, paddingBottom: 14,
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>
              Disponibles
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 400, color: "var(--t1)", letterSpacing: "-0.01em", fontFeatureSettings: '"ss01"' }}>
              Choisissez votre produit
            </h2>
          </div>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>4 produits</span>
        </div>

        {/* 2×2 grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {PRODUCTS.map((p) => {
            const existing   = byType[p.id];
            const isPending  = existing?.statut === "EN_ATTENTE";
            const isApproved = existing?.statut === "APPROUVEE";
            const isRefused  = existing?.statut === "REFUSEE";

            return (
              <div
                key={p.id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 220ms ease, box-shadow 220ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${p.accent}55`;
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 1px ${p.accent}22, 0 12px 40px rgba(0,0,0,0.25)`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                }}
              >
                {/* visual card — full width, prominent */}
                {(p.id === "CARTE_VISA" || p.id === "CARTE_MASTERCARD") ? (
                  /* 3D rotating card for credit card products */
                  <div style={{ position: "relative", height: 210, overflow: "hidden", borderRadius: "16px 16px 0 0" }}>
                    <CreditCard3D
                      cardholderName={cardholderName}
                      variant={p.id === "CARTE_MASTERCARD" ? "mastercard" : "visa"}
                    />
                    {existing?.statut && (
                      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                        <StatutBadge statut={existing.statut} small />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "18px 18px 0" }}>
                    <ProductCard
                      type={p.id}
                      cardholderName={cardholderName}
                      statut={existing?.statut}
                    />
                  </div>
                )}

                {/* product info */}
                <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* name + sub */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      {/* accent dot */}
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.accent, flexShrink: 0, boxShadow: `0 0 6px ${p.accent}` }} />
                      <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)", fontFeatureSettings: '"ss01"' }}>
                        {p.label}
                      </h3>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--t3)", paddingLeft: 14 }}>{p.sub}</p>
                  </div>

                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{p.description}</p>

                  {/* features */}
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {p.features.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t3)" }}>
                        <svg width={9} height={9} viewBox="0 0 9 9" fill="none">
                          <circle cx="4.5" cy="4.5" r="4" fill={`${p.accent}22`} stroke={p.accent} strokeWidth="1" />
                          <polyline points="2.5,4.5 4,6 6.5,3" stroke={p.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* separator */}
                  <div style={{ height: 1, background: "var(--border)", margin: "0 0 2px" }} />

                  {/* CTA */}
                  <div>
                    {isApproved ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width={10} height={10} viewBox="0 0 12 12" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        </div>
                        <span style={{ fontSize: 12.5, color: "#34d399", fontWeight: 500 }}>Produit activé sur votre compte</span>
                      </div>
                    ) : isPending ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.30)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width={10} height={10} viewBox="0 0 12 12" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round">
                              <circle cx="6" cy="6" r="5" /><polyline points="6,3 6,6 8,8" />
                            </svg>
                          </div>
                          <span style={{ fontSize: 12.5, color: "#fbbf24" }}>Traitement en cours…</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => existing && setCancelId(existing.id)}
                          disabled={submitting === `cancel-${existing?.id}`}
                          style={{
                            fontSize: 11, fontWeight: 600,
                            padding: "5px 11px", borderRadius: 8,
                            background: "transparent",
                            color: "#f87171",
                            border: "1px solid rgba(239,68,68,0.35)",
                            cursor: "pointer",
                            letterSpacing: "0.03em",
                            transition: "background 160ms ease, border-color 160ms ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.55)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.35)";
                          }}
                        >
                          {submitting === `cancel-${existing?.id}` ? "…" : "Annuler"}
                        </button>
                      </div>
                    ) : (
                      <Button
                        variant={isRefused ? "ghost" : "primary"}
                        disabled={submitting === p.id}
                        onClick={() => handleDemander(p.id)}
                      >
                        {submitting === p.id ? "Envoi…" : isRefused ? "Redemander" : "Demander"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ MES DEMANDES ══════════════════════════════ */}
      <div>
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          marginBottom: 18, paddingBottom: 14,
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>
              Historique
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 400, color: "var(--t1)", letterSpacing: "-0.01em", fontFeatureSettings: '"ss01"' }}>
              Mes demandes
            </h2>
          </div>
          {demandes.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: "rgba(83,58,253,0.12)", color: "var(--stripe-purple)", border: "1px solid rgba(83,58,253,0.22)" }}>
              {demandes.length}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement…</p>
          </div>
        ) : demandes.length === 0 ? (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "40px 24px", textAlign: "center",
          }}>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>Aucune demande pour le moment.</p>
            <p style={{ fontSize: 12, color: "var(--t3)" }}>Sélectionnez un produit ci-dessus.</p>
          </div>
        ) : (
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 16, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  {["#", "Produit", "Statut", "Demandé le", "Traité le", ""].map((h) => (
                    <th key={h} style={{
                      padding: "10px 18px", textAlign: "left",
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                      textTransform: "uppercase", color: "var(--t3)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandes.map((d, i) => (
                  <tr key={d.id} style={{
                    borderBottom: i < demandes.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 120ms",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--surface)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                  >
                    <td style={{ padding: "14px 18px", color: "var(--t3)", fontSize: 12 }}>{d.id}</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ color: "var(--t1)", fontWeight: 400 }}>{fmtLabel(d.type_produit)}</span>
                    </td>
                    <td style={{ padding: "14px 18px" }}><StatutBadge statut={d.statut} /></td>
                    <td style={{ padding: "14px 18px", color: "var(--t2)", fontSize: 12 }}>{fmt(d.cree_le)}</td>
                    <td style={{ padding: "14px 18px", color: "var(--t2)", fontSize: 12 }}>
                      {d.traite_le ? fmt(d.traite_le) : <span style={{ color: "var(--t3)" }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      {d.statut === "EN_ATTENTE" ? (
                        <button
                          type="button"
                          onClick={() => setCancelId(d.id)}
                          disabled={submitting === `cancel-${d.id}`}
                          style={{
                            fontSize: 11, fontWeight: 600,
                            padding: "4px 10px", borderRadius: 6,
                            background: "transparent",
                            color: "#f87171",
                            border: "1px solid rgba(239,68,68,0.30)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          {submitting === `cancel-${d.id}` ? "…" : "Annuler"}
                        </button>
                      ) : (
                        <span style={{ color: "var(--t3)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
