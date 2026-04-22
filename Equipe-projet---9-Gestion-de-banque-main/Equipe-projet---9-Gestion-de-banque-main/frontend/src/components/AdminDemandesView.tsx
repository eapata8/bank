"use client";

import React, { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";
import type { DemandeProduit } from "@/lib/types";

/* ── Helpers ─────────────────────────────────────── */
function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtProduit(tp: string) {
  return tp.replace("CARTE_", "Carte ").replace("COMPTE_", "Compte ").replace("_", " ");
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    EN_ATTENTE: { bg: "rgba(234,170,0,0.12)", color: "#a37800", label: "En attente" },
    APPROUVEE:  { bg: "rgba(21,190,83,0.12)", color: "#108c3d", label: "Approuvée" },
    REFUSEE:    { bg: "rgba(220,38,38,0.12)", color: "#b91c1c", label: "Refusée" },
  };
  const s = map[statut] ?? { bg: "rgba(0,0,0,0.06)", color: "var(--t2)", label: statut };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/* ── View ────────────────────────────────────────── */
export default function AdminDemandesView() {
  const [demandes, setDemandes]         = useState<DemandeProduit[]>([]);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [filterStatut, setFilterStatut] = useState("TOUS");
  const [filterType, setFilterType]     = useState("TOUS");
  const [refuseId, setRefuseId]         = useState<number | null>(null);
  const [refuseNotes, setRefuseNotes]   = useState("");
  const [acting, setActing]             = useState<number | null>(null);

  const notify = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
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

  const handleApprouver = async (id: number) => {
    setActing(id);
    try {
      const res = await apiPatch<{ message: string }>(`/demandes-produits/${id}/approuver`, {});
      notify("ok", res.message);
      await load();
    } catch (e: any) {
      notify("err", e?.message ?? "Erreur");
    } finally {
      setActing(null);
    }
  };

  const handleRefuser = async () => {
    if (refuseId === null) return;
    setActing(refuseId);
    try {
      const res = await apiPatch<{ message: string }>(`/demandes-produits/${refuseId}/refuser`, { notes: refuseNotes.trim() || undefined });
      notify("ok", res.message);
      setRefuseId(null);
      setRefuseNotes("");
      await load();
    } catch (e: any) {
      notify("err", e?.message ?? "Erreur");
    } finally {
      setActing(null);
    }
  };

  const filtered = demandes.filter((d) => {
    if (filterStatut !== "TOUS" && d.statut !== filterStatut) return false;
    if (filterType !== "TOUS" && d.type_produit !== filterType) return false;
    return true;
  });

  const stats = {
    total:     demandes.length,
    attente:   demandes.filter((d) => d.statut === "EN_ATTENTE").length,
    approuvee: demandes.filter((d) => d.statut === "APPROUVEE").length,
    refusee:   demandes.filter((d) => d.statut === "REFUSEE").length,
  };

  const TYPES = ["TOUS", "CARTE_VISA", "CARTE_MASTERCARD", "COMPTE_CHEQUES", "COMPTE_EPARGNE"];
  const STATUTS = ["TOUS", "EN_ATTENTE", "APPROUVEE", "REFUSEE"];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 8,
          background: toast.type === "ok" ? "#16a34a" : "#dc2626",
          color: "#fff", fontSize: 13,
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
          maxWidth: 360,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Refuse modal ── */}
      {refuseId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, color: "var(--t1)", marginBottom: 8, fontFeatureSettings: '"ss01"' }}>
              Refuser la demande #{refuseId}
            </h3>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16 }}>
              Ajoutez un motif optionnel qui sera enregistré avec la demande.
            </p>
            <textarea
              value={refuseNotes}
              onChange={(e) => setRefuseNotes(e.target.value)}
              placeholder="Motif du refus (optionnel)…"
              rows={3}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6,
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--t1)", fontSize: 13, fontFamily: "inherit",
                resize: "vertical", marginBottom: 16, boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setRefuseId(null); setRefuseNotes(""); }}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                Annuler
              </button>
              <button
                onClick={handleRefuser}
                disabled={acting === refuseId}
                style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                {acting === refuseId ? "Refus…" : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <h1 style={{ fontSize: 22, fontWeight: 400, color: "var(--t1)", marginBottom: 4, fontFeatureSettings: '"ss01"' }}>
        Demandes de produits
      </h1>
      <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 28 }}>
        Approuvez ou refusez les demandes de produits financiers soumises par les clients.
      </p>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total", value: stats.total, color: "var(--t1)" },
          { label: "En attente", value: stats.attente, color: "#a37800" },
          { label: "Approuvées", value: stats.approuvee, color: "#108c3d" },
          { label: "Refusées", value: stats.refusee, color: "#b91c1c" },
        ].map((s) => (
          <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px", background: "var(--card)" }}>
            <p style={{ fontSize: 22, fontWeight: 400, color: s.color, fontFeatureSettings: '"ss01"' }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>Statut :</span>
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                border: filterStatut === s ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: filterStatut === s ? "var(--accent)" : "transparent",
                color: filterStatut === s ? "#fff" : "var(--t2)",
              }}
            >
              {s === "TOUS" ? "Tous" : s === "EN_ATTENTE" ? "En attente" : s === "APPROUVEE" ? "Approuvées" : "Refusées"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>Type :</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--t1)", fontFamily: "inherit", cursor: "pointer" }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t === "TOUS" ? "Tous les types" : fmtProduit(t)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--t3)" }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "32px 24px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>Aucune demande ne correspond aux filtres sélectionnés.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                {["#", "Client", "Produit", "Statut", "Limite", "Date demande", "Traité par", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--t2)", fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "12px 14px", color: "var(--t3)", fontSize: 12 }}>{d.id}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <p style={{ color: "var(--t1)", fontWeight: 400 }}>{d.client_prenom} {d.client_nom}</p>
                    <p style={{ color: "var(--t3)", fontSize: 11, marginTop: 1 }}>{d.client_email}</p>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--t1)" }}>{fmtProduit(d.type_produit)}</td>
                  <td style={{ padding: "12px 14px" }}><StatutBadge statut={d.statut} /></td>
                  <td style={{ padding: "12px 14px", color: "var(--t2)" }}>
                    {d.limite_credit ? `${Number(d.limite_credit).toLocaleString("fr-CA")} $` : "—"}
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--t2)", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(d.cree_le)}</td>
                  <td style={{ padding: "12px 14px", color: "var(--t2)", fontSize: 12 }}>
                    {d.traite_par_nom ?? "—"}
                    {d.notes && <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2, fontStyle: "italic" }}>{d.notes}</p>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {d.statut === "EN_ATTENTE" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleApprouver(d.id)}
                          disabled={acting === d.id}
                          style={{
                            padding: "5px 12px", borderRadius: 5, border: "none",
                            background: acting === d.id ? "var(--surface)" : "#16a34a",
                            color: acting === d.id ? "var(--t3)" : "#fff",
                            fontSize: 12, cursor: acting === d.id ? "not-allowed" : "pointer",
                            fontFamily: "inherit", transition: "background 120ms",
                          }}
                        >
                          {acting === d.id ? "…" : "Approuver"}
                        </button>
                        <button
                          onClick={() => setRefuseId(d.id)}
                          disabled={acting === d.id}
                          style={{
                            padding: "5px 12px", borderRadius: 5, border: "1px solid rgba(220,38,38,0.3)",
                            background: "transparent", color: "#dc2626",
                            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Refuser
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--t3)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
