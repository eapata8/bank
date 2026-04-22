"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiDownloadCSV } from "@/lib/api";
import type { AuditLog } from "@/lib/types";

/* ── ActionBadge — palette complète ──────────────────────────── */
function ActionBadge({ action }: { action: string }) {
  const a = action.toUpperCase();

  // Login / connexion
  if (a.includes("LOGIN") || a.includes("CONNEXION") || a.includes("LOGOUT"))
    return <span className="lb-badge lb-badge-blue">{action}</span>;
  // Create / register
  if (a.includes("CREATE") || a.includes("CREAT") || a.includes("REGISTER") || a.includes("INSERT") || a.includes("AJOUT"))
    return <span className="lb-badge lb-badge-green">{action}</span>;
  // Delete / suppress
  if (a.includes("DELETE") || a.includes("DELET") || a.includes("SUPPR") || a.includes("REMOVE"))
    return <span className="lb-badge lb-badge-red">{action}</span>;
  // Geler / degeler
  if (a.includes("GELER") || a.includes("DEGELER"))
    return <span className="lb-badge lb-badge-indigo">{action}</span>;
  // Bloquer / activer (administratif)
  if (a.includes("BLOQUER") || a.includes("ACTIVER") || a.includes("BLOCK"))
    return <span className="lb-badge lb-badge-amber">{action}</span>;
  // Rembourser
  if (a.includes("REMBOURS"))
    return <span className="lb-badge lb-badge-purple">{action}</span>;
  // View / global
  if (a.includes("VIEW") || a.includes("GLOBAL") || a.includes("LIST"))
    return <span className="lb-badge lb-badge-muted">{action}</span>;

  return <span className="lb-badge lb-badge-muted">{action}</span>;
}

/* ── Role badge inline ────────────────────────────────────────── */
function RoleInline({ role }: { role: string }) {
  const styles: Record<string, React.CSSProperties> = {
    ADMIN:      { color: "#FCD34D", background: "rgba(251,191,36,0.10)",   border: "1px solid rgba(251,191,36,0.22)" },
    MODERATEUR: { color: "#6EE7B7", background: "rgba(110,231,183,0.10)",  border: "1px solid rgba(110,231,183,0.22)" },
    UTILISATEUR:{ color: "#93C5FD", background: "rgba(147,197,253,0.10)",  border: "1px solid rgba(147,197,253,0.20)" },
  };
  const s = styles[role] ?? styles.UTILISATEUR;
  const short = role === "MODERATEUR" ? "Mod" : role === "ADMIN" ? "Admin" : "User";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 4, ...s }}>
      {short}
    </span>
  );
}

/* ── Timestamp formatter ──────────────────────────────────────── */
function FormatDate({ iso }: { iso: string }) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <p className="type-mono" style={{ fontSize: 12, color: "var(--t1)", fontWeight: 600 }}>{time}</p>
      <p style={{ fontSize: 11, color: "var(--t3)" }}>{date}</p>
    </div>
  );
}

/* ── Avatar initials ──────────────────────────────────────────── */
function AuditAvatar({ prenom, role }: { prenom?: string; role?: string }) {
  const colorMap: Record<string, string> = {
    ADMIN:       "linear-gradient(135deg,#D97706,#F59E0B)",
    MODERATEUR:  "linear-gradient(135deg,#059669,#10B981)",
    UTILISATEUR: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  };
  const bg = colorMap[role ?? ""] ?? colorMap.UTILISATEUR;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.9)",
    }}>
      {prenom?.charAt(0)?.toUpperCase() ?? "?"}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try { await apiDownloadCSV("/export/audit", "audit.csv"); }
    catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  const loadLogs = async (l = limit) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ data: AuditLog[] }>(`/auth/logs?limit=${l}`);
      setLogs(res.data);
    } catch (e: any) { setError(e?.message ?? "Erreur"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (user?.role !== "ADMIN") { setLoading(false); return; }
    loadLogs();
  }, [user?.role]);

  if (user?.role !== "ADMIN") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--red-dim)", border: "1px solid rgba(220,38,38,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
          }}>
            <svg width={22} height={22} fill="none" stroke="#FCA5A5" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)" }}>Accès restreint</p>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 6 }}>Section réservée à l'administrateur.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 5 }}>Contrôle système</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Journal d'audit</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            Traçabilité complète de toutes les actions sensibles.
          </p>
        </div>

        {/* Actions row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Event count badge */}
          <div className="lb-stat" style={{ textAlign: "center", minWidth: 80 }}>
            <p className="lb-num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{logs.length}</p>
            <p className="type-label" style={{ marginTop: 3 }}>Événements</p>
          </div>

          {/* Limit selector */}
          <select
            value={limit}
            onChange={(e) => { const l = Number(e.target.value); setLimit(l); loadLogs(l); }}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 12px", color: "var(--t1)", fontSize: 13,
              cursor: "pointer", outline: "none",
            }}
          >
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} entrées</option>)}
          </select>

          {/* Refresh */}
          <button
            onClick={() => loadLogs()}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "var(--surface-2)", border: "1px solid var(--border)",
              color: "var(--t2)", fontSize: 13, cursor: "pointer",
            }}
          >
            ↺ Rafraîchir
          </button>

          {/* Export CSV — prominent */}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13,
              background: "linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12))",
              border: "1px solid rgba(110,231,183,0.30)",
              color: "#6EE7B7", cursor: "pointer", opacity: exporting ? 0.55 : 1,
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: exporting ? "none" : "0 0 14px rgba(16,185,129,0.10)",
              transition: "opacity 150ms ease",
            }}
          >
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Export…" : "Exporter CSV"}
          </button>
        </div>
      </div>

      {error && <div className="lb-alert-error">{error}</div>}

      {/* ── Audit table ───────────────────────────────── */}
      <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Historique des actions</p>
          {loading
            ? <span style={{ fontSize: 12, color: "var(--t3)" }} className="lb-loading">Chargement…</span>
            : <span className="lb-badge lb-badge-muted">{logs.length} événements</span>
          }
        </div>

        {/* Scrollable table */}
        <div className="lb-table-scroll" style={{ overflowX: "auto" }}>
          <table className="lb-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Action</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px 0", color: "var(--t3)", fontSize: 13 }}>
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px 0", color: "var(--t3)", fontSize: 13 }}>
                    Aucun événement enregistré.
                  </td>
                </tr>
              )}
              {!loading && logs.map((log) => (
                <tr key={log.id}>
                  <td><FormatDate iso={log.cree_le} /></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <AuditAvatar prenom={log.prenom} role={log.role_utilisateur} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
                          {log.prenom} {log.nom}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--t3)" }}>{log.email}</p>
                      </div>
                    </div>
                  </td>
                  <td><RoleInline role={log.role_utilisateur} /></td>
                  <td><ActionBadge action={log.action} /></td>
                  <td>
                    {log.details
                      ? <p style={{ fontSize: 12, color: "var(--t2)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                           title={log.details}
                        >{log.details}</p>
                      : <span style={{ color: "var(--t3)", fontSize: 12 }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
