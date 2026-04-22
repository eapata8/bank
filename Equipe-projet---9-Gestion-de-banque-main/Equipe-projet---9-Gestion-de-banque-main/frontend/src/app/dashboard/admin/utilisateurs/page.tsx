"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete, apiDownloadCSV } from "@/lib/api";
import type { AdminUser } from "@/lib/types";

const ROLES_ADMIN    = ["UTILISATEUR", "MODERATEUR", "ADMIN"] as const;
const ROLES_MODO     = ["UTILISATEUR", "MODERATEUR"] as const;

type RoleColor = { bg: string; text: string };
const roleColors: Record<string, RoleColor> = {
  ADMIN:       { bg: "rgba(252,211,77,0.12)", text: "#FCD34D" },
  MODERATEUR:  { bg: "rgba(110,231,183,0.12)", text: "#6EE7B7" },
  UTILISATEUR: { bg: "var(--blue-dim)", text: "#93C5FD" },
};

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "9px 12px", color: "var(--t1)", fontSize: 13, outline: "none", width: "100%",
    ...extra,
  };
}

const initialForm = { email: "", motDePasse: "", prenom: "", nom: "" };

export default function AdminUtilisateursPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isModo  = user?.role === "MODERATEUR";
  const isElevated = isAdmin || isModo;

  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [editingRole, setEditingRole] = useState<{ id: number; role: string } | null>(null);
  const [editingPwd, setEditingPwd]   = useState<{ id: number; pwd: string } | null>(null);
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Formulaires création
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showCreateMod,   setShowCreateMod]   = useState(false);
  const [form,       setForm]       = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [search, setSearch] = useState("");

  const handleExport = async () => {
    setExporting(true);
    try { await apiDownloadCSV("/export/utilisateurs", "utilisateurs.csv"); }
    catch { /* silencieux */ }
    finally { setExporting(false); }
  };

  const notify = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ data: AdminUser[] }>("/admin/utilisateurs");
      setUsers(res.data);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isElevated) loadUsers(); }, []);

  /* ── Actions ──────────────────────────────────── */

  const handleChangeRole = async (userId: number) => {
    if (!editingRole || editingRole.id !== userId) return;
    try {
      const res = await apiPatch<{ message: string }>(`/admin/utilisateurs/${userId}/role`, { role: editingRole.role });
      notify("ok", res.message);
      setEditingRole(null);
      await loadUsers();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleResetPassword = async (userId: number) => {
    if (!editingPwd || editingPwd.id !== userId || !editingPwd.pwd) return;
    try {
      const res = await apiPatch<{ message: string }>(`/admin/utilisateurs/${userId}/password`, { nouveau_mot_de_passe: editingPwd.pwd });
      notify("ok", res.message);
      setEditingPwd(null);
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const handleDelete = (u: AdminUser) => {
    setDeleteTarget(u);
  };

  const handleToggleAutoValidation = async (u: AdminUser) => {
    const newVal = !u.auto_validation;
    try {
      const res = await apiPatch<{ message: string }>(`/admin/utilisateurs/${u.id}/auto_validation`, { auto_validation: newVal });
      notify("ok", res.message);
      await loadUsers();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const u = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(u.id);
    try {
      const res = await apiDelete<{ message: string }>(`/admin/utilisateurs/${u.id}`);
      notify("ok", res.message);
      await loadUsers();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
    finally { setDeletingId(null); }
  };

  const handleCreate = async (e: React.FormEvent, targetRole: "ADMIN" | "MODERATEUR") => {
    e.preventDefault();
    if (!form.email || !form.motDePasse || !form.prenom || !form.nom) {
      notify("err", "Tous les champs sont obligatoires");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = targetRole === "ADMIN" ? "/admin/utilisateurs/admin" : "/admin/utilisateurs/moderateur";
      const res = await apiPost<{ message: string; id: number }>(endpoint, form);
      notify("ok", `${res.message} (id: ${res.id})`);
      setForm(initialForm);
      setShowCreateAdmin(false);
      setShowCreateMod(false);
      await loadUsers();
    } catch (e: any) { notify("err", e?.message ?? "Erreur"); }
    finally { setSubmitting(false); }
  };

  /* ── Guard ────────────────────────────────────── */
  if (!isElevated) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <p style={{ color: "var(--t3)" }}>Section réservée aux modérateurs et administrateurs.</p>
      </div>
    );
  }

  const counts = { ADMIN: 0, MODERATEUR: 0, UTILISATEUR: 0 };
  users.forEach((u) => { if (u.role in counts) counts[u.role as keyof typeof counts]++; });

  const q = search.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter((u) =>
        `${u.prenom} ${u.nom}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.id).includes(q)
      )
    : users;

  const roleOptions = isAdmin ? ROLES_ADMIN : ROLES_MODO;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="type-label" style={{ marginBottom: 4 }}>Gestion des accès</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.02em" }}>Utilisateurs</h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "var(--t2)" }}>
            {isAdmin
              ? "Contrôle des rôles, réinitialisation des mots de passe, suppression."
              : "Création de modérateurs et modification des rôles (UTILISATEUR / MODERATEUR)."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {(["ADMIN", "MODERATEUR", "UTILISATEUR"] as const).map((r) => (
            <div key={r} className="lb-stat" style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: roleColors[r].text }}>{counts[r]}</p>
              <p className="type-label">{r}</p>
            </div>
          ))}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)", color: "#6EE7B7", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: exporting ? 0.6 : 1 }}
          >
            {exporting ? "Export…" : "⬇ CSV"}
          </button>
          <button
            onClick={() => { setShowCreateMod((v) => !v); setShowCreateAdmin(false); setForm(initialForm); }}
            style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(110,231,183,0.12)", border: "1px solid rgba(110,231,183,0.25)", color: "#6EE7B7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + Nouveau modérateur
          </button>
          {isAdmin && (
            <button
              onClick={() => { setShowCreateAdmin((v) => !v); setShowCreateMod(false); setForm(initialForm); }}
              style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.3)", color: "#FCD34D", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              + Nouvel admin
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "lb-alert-success" : "lb-alert-error"}>
          {msg.type === "ok" ? "✓ " : "✗ "}{msg.text}
        </div>
      )}

      {/* Formulaire création modérateur */}
      {showCreateMod && (
        <div className="lb-card" style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 16 }}>Créer un nouveau modérateur</p>
          <form onSubmit={(e) => handleCreate(e, "MODERATEUR")} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Prénom</label>
              <input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} style={inputStyle()} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Nom</label>
              <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} style={inputStyle()} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle()} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Mot de passe</label>
              <input type="password" value={form.motDePasse} onChange={(e) => setForm((f) => ({ ...f, motDePasse: e.target.value }))} style={inputStyle()} required minLength={6} />
            </div>
            <div style={{ gridColumn: "span 2", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowCreateMod(false)} style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                Annuler
              </button>
              <button type="submit" disabled={submitting} style={{ padding: "9px 16px", borderRadius: 8, background: "rgba(110,231,183,0.12)", border: "1px solid rgba(110,231,183,0.25)", color: "#6EE7B7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {submitting ? "Création…" : "Créer le modérateur"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Formulaire création admin (ADMIN seulement) */}
      {isAdmin && showCreateAdmin && (
        <div className="lb-card" style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 16 }}>Créer un nouvel administrateur</p>
          <form onSubmit={(e) => handleCreate(e, "ADMIN")} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Prénom</label>
              <input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} style={inputStyle()} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Nom</label>
              <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} style={inputStyle()} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle()} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>Mot de passe</label>
              <input type="password" value={form.motDePasse} onChange={(e) => setForm((f) => ({ ...f, motDePasse: e.target.value }))} style={inputStyle()} required minLength={6} />
            </div>
            <div style={{ gridColumn: "span 2", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowCreateAdmin(false)} style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                Annuler
              </button>
              <button type="submit" disabled={submitting} style={{ padding: "9px 16px", borderRadius: 8, background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.3)", color: "#FCD34D", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {submitting ? "Création…" : "Créer l'administrateur"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table des utilisateurs */}
      <div className="lb-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>Tous les utilisateurs</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, ID…"
              style={{ ...inputStyle({ width: 260, padding: "7px 12px" }) }}
            />
            {loading
              ? <span style={{ fontSize: 12, color: "var(--t3)" }} className="lb-loading">…</span>
              : <span className="lb-badge lb-badge-muted">{filteredUsers.length}{search ? ` / ${users.length}` : ""}</span>
            }
          </div>
        </div>
        <div>
          {filteredUsers.map((u) => (
            <div key={u.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

              {/* Avatar */}
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: roleColors[u.role]?.bg ?? "var(--blue-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: roleColors[u.role]?.text ?? "#93C5FD", flexShrink: 0 }}>
                {u.prenom?.charAt(0)?.toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1)" }}>{u.prenom} {u.nom}</p>
                <p style={{ fontSize: 11, color: "var(--t3)" }}>{u.email} · #{u.id}</p>
              </div>

              {/* Badge rôle */}
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: roleColors[u.role]?.bg, color: roleColors[u.role]?.text }}>
                {u.role}
              </span>

              {/* Changer rôle */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {editingRole?.id === u.id ? (
                  <>
                    <select
                      value={editingRole.role}
                      onChange={(e) => setEditingRole({ id: u.id, role: e.target.value })}
                      style={{ ...inputStyle({ width: 130, padding: "6px 8px" }), cursor: "pointer" }}
                    >
                      {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => handleChangeRole(u.id)} style={{ padding: "5px 10px", borderRadius: 6, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 11, cursor: "pointer" }}>✓</button>
                    <button onClick={() => setEditingRole(null)} style={{ padding: "5px 8px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--t3)", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </>
                ) : (
                  <button onClick={() => setEditingRole({ id: u.id, role: u.role })} style={{ padding: "5px 10px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 11, cursor: "pointer" }}>
                    Rôle
                  </button>
                )}
              </div>

              {/* Reset mdp (ADMIN uniquement) */}
              {isAdmin && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {editingPwd?.id === u.id ? (
                    <>
                      <input
                        type="password"
                        placeholder="Nouveau mdp"
                        value={editingPwd.pwd}
                        onChange={(e) => setEditingPwd({ id: u.id, pwd: e.target.value })}
                        style={{ ...inputStyle({ width: 150, padding: "6px 8px" }) }}
                        minLength={6}
                      />
                      <button onClick={() => handleResetPassword(u.id)} style={{ padding: "5px 10px", borderRadius: 6, background: "var(--blue-dim)", border: "1px solid var(--border-blue)", color: "#93C5FD", fontSize: 11, cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditingPwd(null)} style={{ padding: "5px 8px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--t3)", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </>
                  ) : (
                    <button onClick={() => setEditingPwd({ id: u.id, pwd: "" })} style={{ padding: "5px 10px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 11, cursor: "pointer" }}>
                      Mot de passe
                    </button>
                  )}
                </div>
              )}

              {/* Auto-validation toggle */}
              <button
                onClick={() => handleToggleAutoValidation(u)}
                title={u.auto_validation ? "Auto-validation activée — cliquer pour désactiver" : "Auto-validation désactivée — cliquer pour activer"}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  border: u.auto_validation ? "1px solid rgba(110,231,183,0.3)" : "1px solid var(--border)",
                  background: u.auto_validation ? "rgba(110,231,183,0.1)" : "transparent",
                  color: u.auto_validation ? "#6EE7B7" : "var(--t3)",
                  transition: "all 150ms",
                }}
              >
                <span style={{ fontSize: 14 }}>{u.auto_validation ? "⚡" : "⚡"}</span>
                {u.auto_validation ? "Auto-val. ON" : "Auto-val. OFF"}
              </button>

              {/* Supprimer (ADMIN uniquement) */}
              {isAdmin && (
                <button
                  onClick={() => handleDelete(u)}
                  disabled={deletingId === u.id}
                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(220,38,38,0.3)", background: "var(--red-dim)", color: "#FCA5A5", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: deletingId === u.id ? 0.5 : 1 }}
                >
                  {deletingId === u.id ? "…" : "Supprimer"}
                </button>
              )}
            </div>
          ))}
          {!loading && users.length === 0 && (
            <p style={{ padding: 24, fontSize: 13, color: "var(--t3)", textAlign: "center" }}>Aucun utilisateur.</p>
          )}
        </div>
      </div>
      {/* Modal confirmation suppression utilisateur */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>
              Supprimer l'utilisateur
            </p>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 6 }}>
              {deleteTarget.prenom} {deleteTarget.nom} — <span style={{ color: "var(--t3)" }}>{deleteTarget.email}</span>
            </p>
            <p style={{ fontSize: 13, color: "#FCA5A5", marginBottom: 20 }}>
              Cette action est irréversible.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--t2)", fontSize: 12, cursor: "pointer" }}>
                Annuler
              </button>
              <button type="button" onClick={confirmDelete} style={{ padding: "9px 16px", borderRadius: 8, background: "var(--red-dim)", border: "1px solid rgba(220,38,38,0.3)", color: "#FCA5A5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
