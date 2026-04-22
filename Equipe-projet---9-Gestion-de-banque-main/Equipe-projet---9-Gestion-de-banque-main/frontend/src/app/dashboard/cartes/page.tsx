"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, Carte, Client } from "@/lib/types";

/* ─── Formatters ──────────────────────────────────────────────── */
function formatMoney(value: number | string) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

/* ─── SVG Icons ───────────────────────────────────────────────── */
const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconUnlock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

const IconSnowflake = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
    <polyline points="6,6 12,2 18,6"/><polyline points="6,18 12,22 18,18"/>
    <polyline points="2,8 6,6 6,12"/><polyline points="22,8 18,6 18,12"/>
    <polyline points="2,16 6,18 6,12"/><polyline points="22,16 18,18 18,12"/>
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconRefreshCw = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconEyeOff = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

/* ─── Card Number Reveal Hook ─────────────────────────────────── */
type RevealState = "hidden" | "revealing" | "revealed";

const SCRAMBLE_CHARS = "0123456789ABCDEF*#@!$%";

function maskedDisplay(numero: string): string {
  // If it's a full 19-char card number ("XXXX XXXX XXXX XXXX"), show masked with last 4
  const lastFour = numero.slice(-4);
  if (/^\d{4}$/.test(lastFour)) return `•••• •••• •••• ${lastFour}`;
  return "•••• •••• •••• ••••";
}

function useCardReveal(targetNumber: string) {
  const [state, setState]   = useState<RevealState>("hidden");
  const [display, setDisplay] = useState(() => maskedDisplay(targetNumber));
  const [copied, setCopied]   = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const stopTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current)  clearTimeout(timeoutRef.current);
  };

  const reveal = useCallback(() => {
    if (state === "revealing") return;
    if (state === "revealed") {
      stopTimers();
      setState("hidden");
      setDisplay(maskedDisplay(targetNumber));
      return;
    }

    // Check prefers-reduced-motion
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState("revealing");

    if (reducedMotion) {
      setDisplay(targetNumber);
      setState("revealed");
      return;
    }

    const totalMs  = 1200;
    const frameMs  = 50;
    let   elapsed  = 0;

    intervalRef.current = setInterval(() => {
      elapsed += frameMs;
      const progress = Math.min(elapsed / totalMs, 1);
      const revealedChars = Math.floor(progress * targetNumber.length);

      let scrambled = "";
      for (let i = 0; i < targetNumber.length; i++) {
        if (targetNumber[i] === " ") { scrambled += " "; continue; }
        if (i < revealedChars) {
          scrambled += targetNumber[i];
        } else if (i < revealedChars + 3) {
          scrambled += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        } else {
          scrambled += "•";
        }
      }
      setDisplay(scrambled);

      if (progress >= 1) {
        stopTimers();
        setDisplay(targetNumber);
        setState("revealed");
      }
    }, frameMs);
  }, [state, targetNumber]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(targetNumber.replace(/\s/g, ""));
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch { /* silencieux */ }
  }, [targetNumber]);

  // Cleanup on unmount
  useEffect(() => () => stopTimers(), []);

  return { state, display, reveal, copy, copied };
}

/* ─── Badges ──────────────────────────────────────────────────── */
function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ACTIVE:  { cls: "lb-badge-green",  label: "Active" },
    GELEE:   { cls: "lb-badge-indigo", label: "Gelée" },
    BLOQUEE: { cls: "lb-badge-red",    label: "Bloquée" },
    EXPIREE: { cls: "lb-badge-muted",  label: "Expirée" },
  };
  const { cls, label } = map[statut] ?? { cls: "lb-badge-muted", label: statut };
  return <span className={`lb-badge ${cls}`}>{label}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const cls = type === "VISA" ? "lb-badge-amber" : "lb-badge-blue";
  return <span className={`lb-badge ${cls}`}>{type}</span>;
}

/* ─── Visual Credit Card ──────────────────────────────────────── */
interface CreditCardProps {
  carte: Carte;
  isAdmin?: boolean;
  processing: boolean;
  confirmingFreeze: boolean;
  onFreezeRequest: () => void;
  onFreezeConfirm: () => void;
  onFreezeCancel: () => void;
  onUnfreeze: () => void;
  compteOptions: { value: string; label: string }[];
  selectedCompte: string;
  onSelectCompte: (v: string) => void;
  montantRembours: string;
  onMontantChange: (v: string) => void;
  onRembourser: () => void;
  canRembourser: boolean;
}

function CreditCardVisual({
  carte,
  isAdmin = false,
  processing,
  confirmingFreeze,
  onFreezeRequest,
  onFreezeConfirm,
  onFreezeCancel,
  onUnfreeze,
  compteOptions,
  selectedCompte,
  onSelectCompte,
  montantRembours,
  onMontantChange,
  onRembourser,
  canRembourser,
}: CreditCardProps) {
  const isGelee   = carte.statut === "GELEE";
  const isBloquee = carte.statut === "BLOQUEE";
  const isFrozen  = isGelee || isBloquee;    // visual dimming for both
  const isExpired = carte.statut === "EXPIREE";
  const isVisa    = carte.type_carte === "VISA";

  const soldeNum  = Number(carte.solde_utilise);
  const limiteNum = Number(carte.limite_credit);
  const usagePct  = limiteNum > 0 ? Math.min((soldeNum / limiteNum) * 100, 100) : 0;

  const barColor  = usagePct > 80
    ? "linear-gradient(90deg,#DC2626,#EF4444)"
    : usagePct > 50
    ? "linear-gradient(90deg,#D97706,#F59E0B)"
    : "linear-gradient(90deg,#059669,#10B981)";

  const usageTextColor = usagePct > 80 ? "#FCA5A5" : usagePct > 50 ? "#FCD34D" : "#6EE7B7";

  const cardGradient = isVisa
    ? "linear-gradient(135deg,#1E40AF 0%,#1E3A8A 55%,#0F2460 100%)"
    : "linear-gradient(135deg,#78350F 0%,#6B2D04 55%,#3D1C02 100%)";

  const cardBorder = isVisa
    ? "1px solid rgba(37,99,235,0.35)"
    : "1px solid rgba(180,83,9,0.45)";

  const { state: revealState, display: numDisplay, reveal, copy, copied } = useCardReveal(carte.numero_compte);

  return (
    <div
      className="lb-card"
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* ── Visual card ──────────────────────────────── */}
      <div
        role="img"
        aria-label={`Carte ${carte.type_carte} ${carte.numero_compte}${isFrozen ? ", gelée" : ""}`}
        style={{
          position: "relative",
          borderRadius: 20,
          padding: "22px 24px",
          background: cardGradient,
          border: cardBorder,
          minHeight: 172,
          overflow: "hidden",
          boxShadow: isFrozen
            ? "0 4px 16px rgba(147,197,253,0.12)"
            : "0 8px 28px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)",
          filter: isFrozen ? "brightness(0.72) saturate(0.6)" : "none",
          transition: "filter 380ms ease, box-shadow 380ms ease",
        }}
      >
        {/* Shimmer overlay */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "inherit",
          background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 55%)",
          pointerEvents: "none",
        }} />
        {/* Circular decoration */}
        <div style={{
          position: "absolute", right: -30, top: -30,
          width: 140, height: 140, borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 10, top: 30,
          width: 90, height: 90, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          pointerEvents: "none",
        }} />

        {/* Frozen overlay */}
        {isFrozen && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute", inset: 0, borderRadius: "inherit",
              background: isBloquee ? "rgba(40,10,10,0.60)" : "rgba(14,30,64,0.55)",
              backdropFilter: "blur(3px)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              zIndex: 10, gap: 6,
            }}
          >
            {isGelee
              ? <div style={{ color: "#93C5FD", opacity: 0.9 }}><IconSnowflake /></div>
              : <div style={{ color: "#FCA5A5", opacity: 0.9 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
            }
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              color: isGelee ? "#93C5FD" : "#FCA5A5",
            }}>
              {isGelee ? "Carte gelée" : "Bloquée par admin"}
            </p>
          </div>
        )}

        {/* Chip + Network */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div className="card-chip" />
          <span style={{
            fontSize: 13, fontWeight: 800, letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.75)", textTransform: "uppercase",
          }}>
            {carte.type_carte}
          </span>
        </div>

        {/* Masked number with reveal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          <p
            className={`type-mono lb-card-number-${revealState}`}
            aria-label={revealState === "revealed" ? `Numéro: ${carte.numero_compte}` : "Numéro masqué"}
            style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.18em" }}
          >
            {numDisplay}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={reveal}
              aria-label={revealState === "revealed" ? "Masquer le numéro" : "Révéler le numéro de carte"}
              style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6, padding: "4px 9px", color: "rgba(255,255,255,0.65)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11,
                transition: "background 180ms ease, color 180ms ease",
              }}
            >
              {revealState === "revealed" ? <IconEyeOff /> : <IconEye />}
              {revealState === "revealed" ? "Masquer" : "Voir"}
            </button>
            {revealState === "revealed" && (
              <button
                onClick={copy}
                aria-label="Copier le numéro de carte"
                style={{
                  background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)",
                  border: copied ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6, padding: "4px 9px",
                  color: copied ? "#6EE7B7" : "rgba(255,255,255,0.65)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11,
                  transition: "background 200ms ease, color 200ms ease, border-color 200ms ease",
                }}
              >
                <IconCopy /> {copied ? "Copié !" : "Copier"}
              </button>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
              Titulaire
            </p>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
              {carte.client_nom || "—"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
                Expire
              </p>
              <p className="type-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
                {new Date(carte.date_expiration).toLocaleDateString("fr-CA", { year: "2-digit", month: "2-digit" })}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
                CVV
              </p>
              <p
                className="type-mono"
                aria-label={revealState === "revealed" ? `CVV: ${carte.cvv}` : "CVV masqué"}
                style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.88)", letterSpacing: "0.12em" }}
              >
                {revealState === "revealed" ? (carte.cvv ?? "—") : "•••"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Usage bar ────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="type-label">Utilisation du crédit</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: usageTextColor }}>{usagePct.toFixed(0)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(usagePct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Utilisation du crédit: ${usagePct.toFixed(0)}%`}
          style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}
        >
          <div style={{
            height: "100%", borderRadius: 99,
            width: `${usagePct}%`,
            background: barColor,
            transition: "width 600ms cubic-bezier(0.22,1,0.36,1)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>
            Utilisé&nbsp;
            <span style={{ color: soldeNum > 0 ? "#FCA5A5" : "#6EE7B7", fontWeight: 600 }}>
              {formatMoney(carte.solde_utilise)}
            </span>
          </span>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>
            Limite&nbsp;
            <span style={{ color: "#93C5FD", fontWeight: 600 }}>{formatMoney(carte.limite_credit)}</span>
          </span>
        </div>
      </div>

      {/* ── Freeze / Unfreeze ─────────────────────────── */}
      {!isExpired && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Admin-blocked card: user sees a message, cannot unblock */}
          {isBloquee && !isAdmin && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.22)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <IconLock />
              <p style={{ fontSize: 12, color: "#FCA5A5", lineHeight: 1.5 }}>
                Cette carte a été bloquée par l'administrateur. Contactez le support pour la réactiver.
              </p>
            </div>
          )}
          {!isFrozen && !confirmingFreeze && (
            <button
              onClick={onFreezeRequest}
              disabled={processing}
              aria-label="Geler cette carte en cas de vol ou de perte"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 18px", borderRadius: 10,
                border: "1px solid rgba(220,38,38,0.28)",
                background: "rgba(220,38,38,0.07)",
                color: "#FCA5A5", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1,
                transition: "background 140ms, border-color 140ms",
                width: "100%",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.12)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.07)"; }}
            >
              <IconLock />
              Geler la carte
            </button>
          )}

          {/* Freeze confirmation prompt */}
          {confirmingFreeze && (
            <div
              role="alertdialog"
              aria-modal="false"
              aria-labelledby="freeze-confirm-title"
              style={{
                borderRadius: 12,
                border: "1px solid rgba(220,38,38,0.28)",
                background: "rgba(220,38,38,0.06)",
                padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ color: "#FCA5A5", marginTop: 1, flexShrink: 0 }}><IconAlertTriangle /></div>
                <div>
                  <p id="freeze-confirm-title" style={{ fontSize: 13, fontWeight: 700, color: "#FCA5A5", marginBottom: 4 }}>
                    Geler cette carte ?
                  </p>
                  <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
                    Toute transaction sera immédiatement refusée. Vous pourrez dégeler votre carte à tout moment depuis cette page.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onFreezeConfirm}
                  disabled={processing}
                  aria-label="Confirmer le gel de la carte"
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px 14px", borderRadius: 9,
                    border: "1px solid rgba(220,38,38,0.35)",
                    background: "rgba(220,38,38,0.16)",
                    color: "#FCA5A5", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                    cursor: processing ? "not-allowed" : "pointer",
                    opacity: processing ? 0.6 : 1,
                  }}
                >
                  <IconLock />
                  {processing ? "Gel en cours…" : "Confirmer le gel"}
                </button>
                <button
                  onClick={onFreezeCancel}
                  disabled={processing}
                  aria-label="Annuler"
                  style={{
                    padding: "9px 16px", borderRadius: 9,
                    border: "1px solid var(--border-md)",
                    background: "rgba(255,255,255,0.045)",
                    color: "var(--t2)", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                    cursor: processing ? "not-allowed" : "pointer",
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Unfreeze: user can only unfreeze GELEE cards; admin can unfreeze both */}
          {(isGelee || (isBloquee && isAdmin)) && (
            <button
              onClick={onUnfreeze}
              disabled={processing}
              aria-label="Dégeler la carte"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 18px", borderRadius: 10,
                border: "1px solid rgba(59,130,246,0.3)",
                background: "rgba(37,99,235,0.10)",
                color: "#93C5FD", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit",
                cursor: processing ? "not-allowed" : "pointer",
                opacity: processing ? 0.5 : 1,
                transition: "background 140ms, border-color 140ms",
                width: "100%",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,99,235,0.16)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(37,99,235,0.10)"; }}
            >
              <IconUnlock />
              {processing ? "Dégel en cours…" : "Dégeler la carte"}
            </button>
          )}
        </div>
      )}

      {/* ── Repayment ─────────────────────────────────── */}
      {canRembourser && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
          <p className="type-label">Remboursement</p>
          <Select
            label="Compte source"
            value={selectedCompte}
            onChange={onSelectCompte}
            options={compteOptions}
          />
          <Input
            label="Montant (CAD)"
            value={montantRembours}
            onChange={onMontantChange}
            type="number"
            placeholder={`max ${formatMoney(carte.solde_utilise)}`}
          />
          <Button
            type="button"
            disabled={processing}
            onClick={onRembourser}
            className="w-full"
          >
            <IconRefreshCw />
            {processing ? "Remboursement…" : "Rembourser"}
          </Button>
        </div>
      )}

      {carte.statut === "ACTIVE" && Number(carte.solde_utilise) === 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>Aucun solde dû</p>
        </div>
      )}

      {isExpired && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>Cette carte a expiré</p>
        </div>
      )}
    </div>
  );
}

/* ─── Form defaults ───────────────────────────────────────────── */
const initialCreateForm = {
  client_id: "",
  type_carte: "VISA",
  last_four: "",
  limite_credit: "",
  date_expiration: "",
};

/* ═══════════════════════════════════════════════════════════════ */
/*  Page Component                                                 */
/* ═══════════════════════════════════════════════════════════════ */
export default function CartesPage() {
  const { user } = useAuth();
  const isElevated = user?.role === "ADMIN" || user?.role === "MODERATEUR";
  const isAdmin    = user?.role === "ADMIN";
  const isUser     = user?.role === "UTILISATEUR";

  const [cartes, setCartes]   = useState<Carte[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients]  = useState<Client[]>([]);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState("");
  const [error, setError]      = useState<string | null>(null);
  const [success, setSuccess]  = useState<string | null>(null);

  const [processingId, setProcessingId]          = useState<number | null>(null);
  const [confirmingFreezeId, setConfirmingFreezeId] = useState<number | null>(null);
  const [selectedComptes, setSelectedComptes]    = useState<Record<number, string>>({});
  const [remboursementMontants, setRemboursementMontants] = useState<Record<number, string>>({});
  const [limiteInputs, setLimiteInputs]          = useState<Record<number, string>>({});
  const [soldeInputs, setSoldeInputs]            = useState<Record<number, string>>({});

  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [creating, setCreating]     = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  /* ── Data loading ─────────────────────────────────────────── */
  const loadCartes = async (nextSearch = search) => {
    setLoading(true);
    setError(null);
    try {
      const q = isElevated && nextSearch.trim()
        ? `/cartes?search=${encodeURIComponent(nextSearch.trim())}`
        : "/cartes";
      const res = await apiGet<{ data: Carte[] }>(q);
      setCartes(res.data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadSupportingData = async () => {
    try {
      const [a, c] = await Promise.all([
        apiGet<{ data: Account[] }>("/comptes"),
        isAdmin
          ? apiGet<{ data: Client[] }>("/clients")
          : Promise.resolve({ data: [] as Client[] }),
      ]);
      setAccounts(a.data);
      setClients(c.data);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    }
  };

  useEffect(() => {
    loadCartes("").catch(() => {});
    loadSupportingData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElevated, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !clients.length) return;
    setCreateForm((cur) =>
      cur.client_id ? cur : { ...cur, client_id: String(clients[0].id) }
    );
  }, [clients, isAdmin]);

  /* ── Computed ─────────────────────────────────────────────── */
  const compteOptionsByCarte = useMemo(() => {
    return cartes.reduce<Record<number, { value: string; label: string }[]>>((acc, c) => {
      acc[c.id] = accounts
        .filter(
          (a) =>
            a.client_id === c.client_id &&
            (a.type_compte === "CHEQUES" || a.type_compte === "EPARGNE") &&
            a.est_actif
        )
        .map((a) => ({
          value: String(a.id),
          label: `${a.type_compte} (${a.numero_compte}) — ${formatMoney(a.solde)}`,
        }));
      return acc;
    }, {});
  }, [accounts, cartes]);

  const createClientOptions = clients.map((c) => ({
    value: String(c.id),
    label: `${c.prenom} ${c.nom} (#${c.id})`,
  }));

  const update = (f: keyof typeof initialCreateForm) => (v: string) =>
    setCreateForm((cur) => ({ ...cur, [f]: v }));

  const activeCount  = cartes.filter((c) => c.statut === "ACTIVE").length;
  const bloqueeCount = cartes.filter((c) => c.statut === "BLOQUEE").length;
  const expireeCount = cartes.filter((c) => c.statut === "EXPIREE").length;

  /* ── Actions ──────────────────────────────────────────────── */
  const createCarte = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!createForm.client_id || !createForm.limite_credit || !createForm.date_expiration) {
      setError("Tous les champs obligatoires doivent être remplis");
      return;
    }
    setCreating(true);
    try {
      const res = await apiPost<{ message: string; id: number }>("/cartes", {
        client_id:      Number(createForm.client_id),
        type_carte:     createForm.type_carte,
        last_four:      createForm.last_four,
        limite_credit:  Number(createForm.limite_credit),
        date_expiration: createForm.date_expiration,
      });
      setSuccess(`${res.message} (ID: ${res.id})`);
      setCreateForm(initialCreateForm);
      setShowCreateForm(false);
      await loadCartes();
    } catch (e: any) {
      setError(e?.message ?? "Erreur de création");
    } finally {
      setCreating(false);
    }
  };

  // Admin: bloquer/activer administratif
  const bloquerCarte = async (carte: Carte) => {
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carte.id}/bloquer`);
      setSuccess(res.message);
      setConfirmingFreezeId(null);
      await Promise.all([loadCartes(), loadSupportingData()]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setProcessingId(null);
    }
  };

  const activerCarte = async (carte: Carte) => {
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carte.id}/activer`);
      setSuccess(res.message);
      await Promise.all([loadCartes(), loadSupportingData()]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setProcessingId(null);
    }
  };

  // Utilisateur: gel/dégel self-service (endpoints dédiés)
  const gelerCarte = async (carte: Carte) => {
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carte.id}/geler`);
      setSuccess(res.message);
      setConfirmingFreezeId(null);
      await Promise.all([loadCartes(), loadSupportingData()]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setProcessingId(null);
    }
  };

  const degelerCarte = async (carte: Carte) => {
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carte.id}/degeler`);
      setSuccess(res.message);
      await Promise.all([loadCartes(), loadSupportingData()]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setProcessingId(null);
    }
  };

  const modifierLimite = async (carte: Carte) => {
    const nouvelleLimit = Number(limiteInputs[carte.id]);
    if (!nouvelleLimit || nouvelleLimit <= 0) { setError("Entrez une limite valide"); return; }
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carte.id}/limite`, {
        limite_credit: nouvelleLimit,
      });
      setSuccess(res.message);
      setLimiteInputs((cur) => ({ ...cur, [carte.id]: "" }));
      await loadCartes();
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setProcessingId(null);
    }
  };

  const modifierSolde = async (carte: Carte) => {
    const nouveauSolde = Number(soldeInputs[carte.id]);
    if (isNaN(nouveauSolde) || nouveauSolde < 0) { setError("Entrez un solde valide (≥ 0)"); return; }
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPatch<{ message: string }>(`/cartes/${carte.id}/solde`, {
        solde_utilise: nouveauSolde,
      });
      setSuccess(res.message);
      setSoldeInputs((cur) => ({ ...cur, [carte.id]: "" }));
      await loadCartes();
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setProcessingId(null);
    }
  };

  const rembourserCarte = async (carte: Carte) => {
    const compteId = selectedComptes[carte.id];
    const montant  = Number(remboursementMontants[carte.id]);
    if (!compteId) { setError("Sélectionnez un compte de remboursement"); return; }
    if (!montant || montant <= 0) { setError("Entrez un montant valide"); return; }
    setError(null); setSuccess(null);
    setProcessingId(carte.id);
    try {
      const res = await apiPost<{ message: string }>(`/cartes/${carte.id}/rembourser`, {
        compte_id: Number(compteId),
        montant,
      });
      setSuccess(res.message);
      setSelectedComptes((cur)         => ({ ...cur, [carte.id]: "" }));
      setRemboursementMontants((cur)   => ({ ...cur, [carte.id]: "" }));
      await Promise.all([loadCartes(), loadSupportingData()]);
    } catch (e: any) {
      setError(e?.message ?? "Erreur de remboursement");
    } finally {
      setProcessingId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /*  Render                                                     */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="lb-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 6 }}>
            {isElevated ? "Supervision" : "Mon espace"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Cartes de crédit
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            {isElevated
              ? "Gestion et supervision des cartes de crédit de tous les clients."
              : "Gérez vos cartes, suivez votre crédit et sécurisez vos paiements."}
          </p>
        </div>

        {/* Stats chips */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 72 }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{cartes.length}</p>
            <p className="type-label" style={{ marginTop: 4 }}>Total</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 72, borderColor: "rgba(52,211,153,0.2)", background: "var(--green-dim)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#6EE7B7", lineHeight: 1.1 }}>{activeCount}</p>
            <p className="type-label" style={{ marginTop: 4 }}>Actives</p>
          </div>
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 72, borderColor: "rgba(147,197,253,0.2)", background: "rgba(37,99,235,0.08)" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#93C5FD", lineHeight: 1.1 }}>{bloqueeCount}</p>
            <p className="type-label" style={{ marginTop: 4 }}>Gelées</p>
          </div>
          {isElevated && (
            <div className="lb-stat" style={{ textAlign: "center", minWidth: 72 }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--t3)", lineHeight: 1.1 }}>{expireeCount}</p>
              <p className="type-label" style={{ marginTop: 4 }}>Expirées</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts ───────────────────────────────────────────── */}
      {error && (
        <div className="lb-alert-error" role="alert">
          <IconAlertTriangle />
          {error}
        </div>
      )}
      {success && (
        <div className="lb-alert-success" role="status">
          <IconCheck />
          {success}
        </div>
      )}

      {/* ── Elevated: Search bar ─────────────────────────────── */}
      {isElevated && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", pointerEvents: "none" }}>
              <IconSearch />
            </div>
            <input
              className="lb-input"
              style={{ paddingLeft: 38 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadCartes(search)}
              placeholder="Rechercher par ID, client, numéro, type, statut…"
              aria-label="Rechercher des cartes"
            />
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => loadCartes(search)}>
            Rechercher
          </Button>
          {isAdmin && (
            <Button type="button" onClick={() => setShowCreateForm((s) => !s)}>
              <IconPlus />
              {showCreateForm ? "Fermer" : "Nouvelle carte"}
            </Button>
          )}
        </div>
      )}

      {/* ── Admin: Create card form ───────────────────────────── */}
      {isAdmin && showCreateForm && (
        <Card>
          <div style={{ marginBottom: 20 }}>
            <p className="type-label" style={{ marginBottom: 4 }}>Émission d'une nouvelle carte</p>
            <p style={{ fontSize: 13, color: "var(--t2)" }}>Créez et associez une carte de crédit à un client existant.</p>
          </div>
          <form
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}
            onSubmit={createCarte}
          >
            <Select
              label="Client"
              value={createForm.client_id}
              onChange={update("client_id")}
              options={createClientOptions}
            />
            <Select
              label="Réseau"
              value={createForm.type_carte}
              onChange={update("type_carte")}
              options={[
                { value: "VISA", label: "Visa" },
                { value: "MASTERCARD", label: "Mastercard" },
              ]}
            />
            <Input
              label="Limite de crédit (CAD)"
              value={createForm.limite_credit}
              onChange={update("limite_credit")}
              type="number"
              placeholder="5000"
            />
            <Input
              label="Date d'expiration"
              value={createForm.date_expiration}
              onChange={update("date_expiration")}
              placeholder="2028-12-31"
            />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Émission en cours…" : "Émettre la carte"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* USER view — visual card grid                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isUser && (
        <>
          {loading && (
            <div className="lb-grid-cards" style={{ gap: 20 }}>
              {[1, 2].map((i) => (
                <div key={i} className="lb-card lb-skeleton" style={{ height: 420 }} aria-hidden="true" />
              ))}
            </div>
          )}

          {!loading && cartes.length === 0 && (
            <div className="lb-card" style={{ padding: "56px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 15, color: "var(--t2)", marginBottom: 8 }}>Aucune carte de crédit associée à votre compte.</p>
              <p style={{ fontSize: 13, color: "var(--t3)" }}>Contactez votre conseiller pour en obtenir une.</p>
            </div>
          )}

          {!loading && cartes.length > 0 && (
            <div className="lb-grid-cards" style={{ gap: 20 }}>
              {cartes.map((carte) => {
                const compteOptions = compteOptionsByCarte[carte.id] ?? [];
                const soldeNum      = Number(carte.solde_utilise);
                const canRembourser = carte.statut === "ACTIVE" && soldeNum > 0 && compteOptions.length > 0;

                return (
                  <CreditCardVisual
                    key={carte.id}
                    carte={carte}
                    isAdmin={isAdmin}
                    processing={processingId === carte.id}
                    confirmingFreeze={confirmingFreezeId === carte.id}
                    onFreezeRequest={() => { setError(null); setSuccess(null); setConfirmingFreezeId(carte.id); }}
                    onFreezeConfirm={() => gelerCarte(carte)}
                    onFreezeCancel={() => setConfirmingFreezeId(null)}
                    onUnfreeze={() => degelerCarte(carte)}
                    compteOptions={compteOptions}
                    selectedCompte={selectedComptes[carte.id] ?? ""}
                    onSelectCompte={(v) => setSelectedComptes((cur) => ({ ...cur, [carte.id]: v }))}
                    montantRembours={remboursementMontants[carte.id] ?? ""}
                    onMontantChange={(v) => setRemboursementMontants((cur) => ({ ...cur, [carte.id]: v }))}
                    onRembourser={() => rembourserCarte(carte)}
                    canRembourser={canRembourser}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ELEVATED view — data table                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isElevated && (
        <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1)" }}>Registre des cartes</p>
            {loading ? (
              <span className="lb-loading" style={{ fontSize: 12, color: "var(--t3)" }}>Chargement…</span>
            ) : (
              <span className="lb-badge lb-badge-muted">{cartes.length} carte{cartes.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div className="lb-scroll lb-table-scroll">
            <table className="lb-table" role="table" aria-label="Liste des cartes de crédit">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>ID</th>
                  <th>Client</th>
                  <th>Numéro</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th style={{ textAlign: "right" }}>Limite</th>
                  <th style={{ textAlign: "right" }}>Utilisé</th>
                  <th style={{ textAlign: "right" }}>Expiration</th>
                  <th style={{ paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && cartes.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px 24px", color: "var(--t3)" }}>
                      Aucune carte trouvée.
                    </td>
                  </tr>
                )}
                {cartes.map((carte) => {
                  const compteOptions = compteOptionsByCarte[carte.id] ?? [];
                  const soldeNum      = Number(carte.solde_utilise);
                  const limite        = Number(carte.limite_credit);
                  const usagePct      = limite > 0 ? Math.min((soldeNum / limite) * 100, 100) : 0;
                  const canRembourser = isAdmin && carte.statut === "ACTIVE" && soldeNum > 0 && compteOptions.length > 0;

                  return (
                    <tr key={carte.id}>
                      <td style={{ paddingLeft: 24 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t3)", fontVariantNumeric: "tabular-nums" }}>
                          #{carte.id}
                        </span>
                      </td>
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{carte.client_nom}</p>
                        <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{carte.client_email}</p>
                      </td>
                      <td className="type-mono" style={{ fontSize: 13, color: "var(--t2)" }}>
                        {carte.numero_compte}
                      </td>
                      <td><TypeBadge type={carte.type_carte} /></td>
                      <td><StatutBadge statut={carte.statut} /></td>
                      <td style={{ textAlign: "right" }}>
                        <span className="type-mono" style={{ fontSize: 13, color: "#93C5FD", fontWeight: 700 }}>
                          {formatMoney(carte.limite_credit)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <span className="type-mono" style={{ fontSize: 13, color: soldeNum > 0 ? "#FCA5A5" : "#6EE7B7", fontWeight: 600 }}>
                            {formatMoney(carte.solde_utilise)}
                          </span>
                          {limite > 0 && (
                            <div style={{ width: 56, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 99,
                                width: `${usagePct}%`,
                                background: usagePct > 80 ? "#DC2626" : usagePct > 50 ? "#D97706" : "#059669",
                              }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="type-mono" style={{ textAlign: "right", fontSize: 12, color: "var(--t3)" }}>
                        {new Date(carte.date_expiration).toLocaleDateString("fr-CA")}
                      </td>
                      <td style={{ paddingRight: 24 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 210 }}>

                          {/* Admin card actions */}
                          {isAdmin && carte.statut !== "EXPIREE" && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {/* ACTIVE: show both Geler (self-service) and Bloquer (admin) */}
                              {carte.statut === "ACTIVE" && (
                                <>
                                  <button
                                    onClick={() => gelerCarte(carte)}
                                    disabled={processingId === carte.id}
                                    aria-label={`Geler la carte ${carte.numero_compte}`}
                                    title="Gel temporaire (peut être annulé par l'utilisateur)"
                                    style={{
                                      display: "flex", alignItems: "center", gap: 5,
                                      padding: "6px 10px", borderRadius: 8,
                                      border: "1px solid rgba(129,140,248,0.30)",
                                      background: "rgba(129,140,248,0.08)",
                                      color: "#818CF8", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                      cursor: processingId === carte.id ? "not-allowed" : "pointer",
                                      opacity: processingId === carte.id ? 0.5 : 1,
                                    }}
                                  >
                                    <IconSnowflake />
                                    Geler
                                  </button>
                                  <button
                                    onClick={() => bloquerCarte(carte)}
                                    disabled={processingId === carte.id}
                                    aria-label={`Bloquer la carte ${carte.numero_compte}`}
                                    title="Blocage administratif (seul l'admin peut réactiver)"
                                    style={{
                                      display: "flex", alignItems: "center", gap: 5,
                                      padding: "6px 10px", borderRadius: 8,
                                      border: "1px solid rgba(220,38,38,0.28)",
                                      background: "rgba(220,38,38,0.07)",
                                      color: "#FCA5A5", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                      cursor: processingId === carte.id ? "not-allowed" : "pointer",
                                      opacity: processingId === carte.id ? 0.5 : 1,
                                    }}
                                  >
                                    <IconLock />
                                    Bloquer
                                  </button>
                                </>
                              )}
                              {/* GELEE: Dégeler or Bloquer */}
                              {carte.statut === "GELEE" && (
                                <>
                                  <button
                                    onClick={() => degelerCarte(carte)}
                                    disabled={processingId === carte.id}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 5,
                                      padding: "6px 10px", borderRadius: 8,
                                      border: "1px solid rgba(59,130,246,0.30)",
                                      background: "rgba(37,99,235,0.08)",
                                      color: "#93C5FD", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                      cursor: processingId === carte.id ? "not-allowed" : "pointer",
                                      opacity: processingId === carte.id ? 0.5 : 1,
                                    }}
                                  >
                                    <IconUnlock />
                                    Dégeler
                                  </button>
                                  <button
                                    onClick={() => bloquerCarte(carte)}
                                    disabled={processingId === carte.id}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 5,
                                      padding: "6px 10px", borderRadius: 8,
                                      border: "1px solid rgba(220,38,38,0.28)",
                                      background: "rgba(220,38,38,0.07)",
                                      color: "#FCA5A5", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                      cursor: processingId === carte.id ? "not-allowed" : "pointer",
                                      opacity: processingId === carte.id ? 0.5 : 1,
                                    }}
                                  >
                                    <IconLock />
                                    Bloquer
                                  </button>
                                </>
                              )}
                              {/* BLOQUEE: only admin Activer */}
                              {carte.statut === "BLOQUEE" && (
                                <button
                                  onClick={() => activerCarte(carte)}
                                  disabled={processingId === carte.id}
                                  aria-label={`Activer la carte ${carte.numero_compte}`}
                                  title="Réactivation administrative"
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "6px 10px", borderRadius: 8,
                                    border: "1px solid rgba(110,231,183,0.28)",
                                    background: "rgba(5,150,105,0.08)",
                                    color: "#6EE7B7", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                    cursor: processingId === carte.id ? "not-allowed" : "pointer",
                                    opacity: processingId === carte.id ? 0.5 : 1,
                                  }}
                                >
                                  <IconCheck />
                                  {processingId === carte.id ? "…" : "Activer"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Modify limit */}
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                              <div style={{ flex: 1 }}>
                                <Input
                                  label="Nouvelle limite"
                                  value={limiteInputs[carte.id] ?? ""}
                                  onChange={(v) => setLimiteInputs((cur) => ({ ...cur, [carte.id]: v }))}
                                  type="number"
                                  placeholder="ex: 6000"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={processingId === carte.id}
                                onClick={() => modifierLimite(carte)}
                              >
                                OK
                              </Button>
                            </div>
                          )}

                          {/* Modify solde_utilise */}
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                              <div style={{ flex: 1 }}>
                                <Input
                                  label="Solde utilisé"
                                  value={soldeInputs[carte.id] ?? ""}
                                  onChange={(v) => setSoldeInputs((cur) => ({ ...cur, [carte.id]: v }))}
                                  type="number"
                                  placeholder={`actuel: ${formatMoney(carte.solde_utilise)}`}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={processingId === carte.id}
                                onClick={() => modifierSolde(carte)}
                              >
                                OK
                              </Button>
                            </div>
                          )}

                          {/* Repayment */}
                          {canRembourser && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <Select
                                label="Compte source"
                                value={selectedComptes[carte.id] ?? ""}
                                onChange={(v) => setSelectedComptes((cur) => ({ ...cur, [carte.id]: v }))}
                                options={compteOptions}
                              />
                              <Input
                                label="Montant (CAD)"
                                value={remboursementMontants[carte.id] ?? ""}
                                onChange={(v) => setRemboursementMontants((cur) => ({ ...cur, [carte.id]: v }))}
                                type="number"
                                placeholder={`max ${formatMoney(carte.solde_utilise)}`}
                              />
                              <Button
                                type="button"
                                disabled={processingId === carte.id}
                                onClick={() => rembourserCarte(carte)}
                                className="w-full"
                              >
                                {processingId === carte.id ? "Remboursement…" : "Rembourser"}
                              </Button>
                            </div>
                          )}

                          {/* Moderator: read-only */}
                          {!isAdmin && (
                            <span style={{ fontSize: 12, color: "var(--t3)" }}>Lecture seule</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
