"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPostForm, apiPatch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Account, Depot } from "@/lib/types";
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

export default function DepotsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isElevated = role === "ADMIN" || role === "MODERATEUR";
  const canSubmit  = role === "UTILISATEUR";

  /* ── State ─────────────────────────────────────── */
  const [depots,   setDepots]   = useState<Depot[]>([]);
  const [comptes,  setComptes]  = useState<Account[]>([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [err,      setErr]      = useState<string | null>(null);

  /* form */
  const [compteId,       setCompteId]       = useState("");
  const [montant,        setMontant]        = useState("");
  const [numeroCheque,   setNumeroCheque]   = useState("");
  const [banqueEmettrice,setBanqueEmettrice]= useState("");
  const [photoCheque,    setPhotoCheque]    = useState<File | null>(null);

  /* image preview modal */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* reject modal */
  const [rejectId,    setRejectId]    = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  /* ── Loaders ───────────────────────────────────── */
  const loadDepots = async (q = search) => {
    setLoading(true);
    setErr(null);
    try {
      const query = isElevated && q.trim() ? `/depots?search=${encodeURIComponent(q.trim())}` : "/depots";
      const res = await apiGet<{ data: Depot[] }>(query);
      setDepots(res.data);
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
    loadDepots("");
    if (canSubmit) loadComptes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Stats ─────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:     depots.length,
    attente:   depots.filter(d => d.statut === "EN_ATTENTE").length,
    approuve:  depots.filter(d => d.statut === "APPROUVE").length,
    rejete:    depots.filter(d => d.statut === "REJETE").length,
  }), [depots]);

  /* ── Submit deposit ────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    const montantNum = parseFloat(montant);
    if (!compteId || !montant || !numeroCheque.trim() || !banqueEmettrice.trim()) {
      return setErr("Tous les champs sont requis");
    }
    if (isNaN(montantNum) || montantNum <= 0) return setErr("Montant invalide");
    if (!photoCheque) return setErr("La photo du chèque est obligatoire");
    try {
      const fd = new FormData();
      fd.append("compte_id",        String(Number(compteId)));
      fd.append("montant",          String(montantNum));
      fd.append("numero_cheque",    numeroCheque.trim());
      fd.append("banque_emettrice", banqueEmettrice.trim());
      fd.append("photo_cheque",     photoCheque);
      const res = await apiPostForm<{ id: number; auto_valide?: boolean }>("/depots", fd);
      setMsg(res.auto_valide ? "✓ Dépôt approuvé et crédité automatiquement" : "✓ Dépôt soumis — en attente de vérification");
      setCompteId(""); setMontant(""); setNumeroCheque(""); setBanqueEmettrice(""); setPhotoCheque(null);
      await loadDepots("");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de la soumission");
    }
  };

  /* ── Approve ───────────────────────────────────── */
  const handleApprouver = async (id: number) => {
    setMsg(null); setErr(null);
    try {
      await apiPatch(`/depots/${id}/approuver`);
      setMsg(`✓ Dépôt #${id} approuvé — compte crédité`);
      await loadDepots("");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de l'approbation");
    }
  };

  /* ── Reject ────────────────────────────────────── */
  const handleRejeter = async () => {
    if (!rejectId) return;
    setMsg(null); setErr(null);
    try {
      await apiPatch(`/depots/${rejectId}/rejeter`, { notes: rejectNotes || undefined });
      setMsg(`Dépôt #${rejectId} rejeté`);
      setRejectId(null); setRejectNotes("");
      await loadDepots("");
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
            {isElevated ? "Vérification" : "Mes dépôts"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>
            Dépôts de chèques
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            {isElevated
              ? "Vérifiez et validez les dépôts de chèques soumis par les clients."
              : "Soumettez un chèque pour dépôt sur votre compte."}
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
            <Input value={search} onChange={setSearch} placeholder="Rechercher par numéro, banque, client ou statut…" />
          </div>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => loadDepots(search)}>
            Rechercher
          </Button>
        </div>
      )}

      {/* ── Messages ───────────────────────────────── */}
      {msg && <div className="lb-alert-success">{msg}</div>}
      {err && <div className="lb-alert-error">{err}</div>}

      {/* ── Submit form (UTILISATEUR + ADMIN) ──────── */}
      {canSubmit && (
        <Card className="p-6 md:p-7">
          <p className="type-label" style={{ marginBottom: 16 }}>Soumettre un chèque</p>
          <form onSubmit={handleSubmit} className="lb-form-grid" style={{ gap: 14 }}>
            <Select
              label="Compte de dépôt"
              value={compteId}
              onChange={setCompteId}
              options={comptes.map(c => ({
                value: String(c.id),
                label: `${c.numero_compte} — ${c.type_compte}`,
              }))}
            />
            <Input
              label="Montant (CAD)"
              type="number"
              value={montant}
              onChange={setMontant}
              placeholder="ex: 500.00"
            />
            <Input
              label="Numéro de chèque"
              value={numeroCheque}
              onChange={setNumeroCheque}
              placeholder="ex: CHQ-0042"
            />
            <Input
              label="Banque émettrice"
              value={banqueEmettrice}
              onChange={setBanqueEmettrice}
              placeholder="ex: TD Canada Trust"
            />
            <div style={{ gridColumn: "1/-1" }}>
              <label htmlFor="photo-cheque" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>
                Photo du chèque <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                id="photo-cheque"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => setPhotoCheque(e.target.files?.[0] ?? null)}
                style={{
                  display: "block", width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface-1)",
                  color: "var(--t1)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              />
              {photoCheque && (
                <p style={{ marginTop: 6, fontSize: 12, color: "var(--t3)" }}>
                  {photoCheque.name} ({(photoCheque.size / 1024).toFixed(0)} Ko)
                </p>
              )}
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary">Soumettre le dépôt</Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Image preview modal ────────────────────── */}
      {previewUrl && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setPreviewUrl(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Photo du chèque" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
            <button
              onClick={() => setPreviewUrl(null)}
              style={{ position: "absolute", top: -12, right: -12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "var(--t1)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
            >✕</button>
          </div>
        </div>
      )}

      {/* ── Reject modal ───────────────────────────── */}
      {rejectId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 420,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 12 }}>
              Rejeter le dépôt #{rejectId}
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16 }}>
              Vous pouvez ajouter une note de refus (optionnel).
            </p>
            <Input label="Motif de refus (optionnel)" value={rejectNotes} onChange={setRejectNotes} placeholder="ex: Chèque illisible" />
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => { setRejectId(null); setRejectNotes(""); }}>
                Annuler
              </Button>
              <Button type="button" variant="primary" onClick={handleRejeter}>
                Confirmer le rejet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Registre des dépôts</p>
          <span className="lb-badge lb-badge-muted">{depots.length} ligne{depots.length !== 1 ? "s" : ""}</span>
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
                  <th>N° Chèque</th>
                  <th>Banque</th>
                  <th style={{ textAlign: "right" }}>Montant</th>
                  <th>Statut</th>
                  <th>Soumis le</th>
                  {isElevated && <th>Chèque</th>}
                  {isElevated && <th style={{ paddingRight: 24 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {depots.map(d => (
                  <tr key={d.id}>
                    <td style={{ paddingLeft: 24, fontWeight: 600, color: "var(--t2)" }}>#{d.id}</td>
                    {isElevated && (
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{d.client_nom}</p>
                      </td>
                    )}
                    <td className="type-mono" style={{ fontSize: 12, color: "var(--t2)" }}>
                      {d.compte_numero}
                      <span style={{ display: "block", fontSize: 11, color: "var(--t3)" }}>{d.compte_type}</span>
                    </td>
                    <td className="type-mono" style={{ fontSize: 13 }}>{d.numero_cheque}</td>
                    <td style={{ fontSize: 13, color: "var(--t2)" }}>{d.banque_emettrice}</td>
                    <td className="type-mono" style={{ textAlign: "right", color: "#6EE7B7", fontWeight: 700 }}>
                      {formatMoney(d.montant)}
                    </td>
                    <td>{statutBadge(d.statut)}</td>
                    <td style={{ fontSize: 12, color: "var(--t3)" }}>
                      {new Date(d.depose_le).toLocaleDateString("fr-CA")}
                    </td>
                    {isElevated && (
                      <td>
                        {d.fichier_chemin ? (
                          <button
                            type="button"
                            onClick={() => setPreviewUrl(`/uploads/depots/${d.fichier_chemin}`)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            title="Voir le chèque"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/uploads/depots/${d.fichier_chemin}`}
                              alt="chèque"
                              style={{ width: 48, height: 32, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }}
                            />
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--t3)" }}>—</span>
                        )}
                      </td>
                    )}
                    {isElevated && (
                      <td style={{ paddingRight: 24 }}>
                        {d.statut === "EN_ATTENTE" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => handleApprouver(d.id)}
                            >
                              Approuver
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => { setRejectId(d.id); setRejectNotes(""); }}
                            >
                              Rejeter
                            </Button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>
                            {d.traite_par_nom ?? "—"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {depots.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "28px", fontSize: 13, color: "var(--t3)" }}>
                      Aucun dépôt trouvé.
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
