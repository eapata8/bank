"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const CreditCard3D = dynamic(() => import("@/components/CreditCard3D"), { ssr: false });

type LoginResponse = {
  message: string;
  user: { id: number; email: string; role: string; prenom: string; nom: string };
};

export default function LoginPage() {
  const router = useRouter();
  const { refreshMe } = useAuth();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost<LoginResponse>("/auth/login", { email, motDePasse });
      await refreshMe();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Identifiants incorrects");
      toast.error(err?.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lb-login-page" style={{ minHeight: "100vh", display: "flex", fontFeatureSettings: '"ss01"' }}>

      {/* ── Left panel — dark brand + 3D card — */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: 500,
          flexShrink: 0,
          background: "#0d0f2e",
          padding: "48px 52px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient gradients */}
        <div style={{
          position: "absolute", top: -100, right: -100,
          width: 380, height: 380, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(83,58,253,0.30) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -80, left: -80,
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(234,34,97,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 6,
            background: "linear-gradient(135deg, #533afd 0%, #ea2261 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "rgba(83,58,253,0.40) 0px 4px 16px -2px",
          }}>
            <svg width={19} height={19} viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 6v4c0 4.418 3.134 8.556 7 9.5C13.866 18.556 17 14.418 17 10V6L10 2z"
                fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth={1.2} />
              <path d="M7 10.5l2 2 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 400, color: "#ffffff", letterSpacing: "-0.01em" }}>
            Leon Bank
          </p>
        </div>

        {/* 3D Card showcase */}
        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 style={{
            fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)",
            fontWeight: 300,
            color: "#ffffff",
            lineHeight: 1.12,
            letterSpacing: "-0.56px",
            fontFeatureSettings: '"ss01"',
            marginBottom: 12,
          }}>
            La banque privée<br />
            conçue pour vous.
          </h1>
          <p style={{
            fontSize: 14, lineHeight: 1.6,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 300, fontFeatureSettings: '"ss01"',
            marginBottom: 32,
          }}>
            Gérez vos comptes et effectuez des virements depuis une interface sécurisée.
          </p>

          {/* The 3D card */}
          <div style={{
            height: 260,
            borderRadius: 12,
            overflow: "hidden",
            position: "relative",
          }}>
            <CreditCard3D />
          </div>

          {/* Mini feature row */}
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            {[
              {
                label: "Sécurisé",
                icon: (
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
              },
              {
                label: "Temps réel",
                icon: (
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0-4-4m4 4-4 4M16 17H4m0 0 4 4m-4-4 4-4" />
                  </svg>
                ),
              },
              {
                label: "Supervision",
                icon: (
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                  </svg>
                ),
              },
            ].map((f) => (
              <div key={f.label} style={{
                flex: 1, padding: "10px 0",
                borderRadius: 6,
                background: "rgba(83,58,253,0.10)",
                border: "1px solid rgba(83,58,253,0.22)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                color: "#9d94ff",
              }}>
                {f.icon}
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 300, fontFeatureSettings: '"ss01"', letterSpacing: "0.03em" }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", fontWeight: 300, position: "relative", zIndex: 1, fontFeatureSettings: '"ss01"' }}>
          © 2026 Leon Bank — Environnement de démonstration
        </p>
      </div>

      {/* ── Right panel — form — */}
      <div className="lb-login-right" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: "linear-gradient(135deg, #533afd 0%, #1c1e54 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "rgba(83,58,253,0.30) 0px 4px 12px -2px",
            }}>
              <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 6v4c0 4.418 3.134 8.556 7 9.5C13.866 18.556 17 14.418 17 10V6L10 2z"
                  fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth={1.2} />
                <path d="M7 10.5l2 2 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 400, color: "var(--t1)", fontFeatureSettings: '"ss01"' }}>Leon Bank</span>
          </div>

          <h2 style={{
            fontSize: 32, fontWeight: 300, color: "var(--t1)",
            letterSpacing: "-0.64px", lineHeight: 1.1,
            fontFeatureSettings: '"ss01"',
          }}>
            Connexion
          </h2>
          <p style={{ marginTop: 10, fontSize: 16, fontWeight: 300, color: "var(--t3)", fontFeatureSettings: '"ss01"' }}>
            Accédez à votre espace bancaire
          </p>

          {/* Form */}
          <form onSubmit={onLogin} style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "block" }}>
              <span style={{
                display: "block", marginBottom: 6,
                fontSize: 13, fontWeight: 400, color: "var(--t2)",
                fontFeatureSettings: '"ss01"',
              }}>
                Adresse e-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="utilisateur@exemple.com"
                autoComplete="username"
                className="lb-input"
              />
            </label>

            <label style={{ display: "block" }}>
              <span style={{
                display: "block", marginBottom: 6,
                fontSize: 13, fontWeight: 400, color: "var(--t2)",
                fontFeatureSettings: '"ss01"',
              }}>
                Mot de passe
              </span>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="lb-input"
              />
            </label>

            {error && <div className="lb-alert-error">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", marginTop: 6,
                padding: "10px 18px",
                borderRadius: 4,
                background: loading ? "rgba(83,58,253,0.55)" : "#533afd",
                color: "#ffffff",
                fontSize: 15, fontWeight: 400,
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                transition: "background 120ms, box-shadow 120ms",
                fontFamily: "inherit",
                fontFeatureSettings: '"ss01"',
                boxShadow: loading ? "none" : "rgba(83,58,253,0.25) 0px 8px 24px -4px, rgba(0,0,0,0.08) 0px 4px 12px -2px",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#4434d4"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#533afd"; }}
            >
              {loading ? "Connexion en cours…" : "Se connecter →"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
