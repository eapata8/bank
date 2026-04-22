/**
 * @fileoverview Contrôleur pour l'export de données au format CSV.
 *
 * Ce module génère des fichiers CSV téléchargeables pour les différentes
 * entités du système bancaire. Chaque export est limité selon le rôle
 * de l'utilisateur connecté :
 *  - Audit logs      : ADMIN uniquement (5 000 dernières entrées)
 *  - Utilisateurs    : ADMIN + MODERATEUR
 *  - Clients         : ADMIN + MODERATEUR
 *  - Virements       : tous les rôles (filtrés selon les droits)
 *  - Transactions    : tous les rôles (filtrés selon la propriété du compte)
 *
 * Les fichiers sont nommés avec un timestamp pour éviter les conflits de cache.
 *
 * @module controllers/export
 */

import { toCSV, sendCSV }                from "../utils/csv.js";
import { findRecentAuditLogs }           from "../data/audit.data.js";
import { findAllUsers }                  from "../data/admin.data.js";
import { findVirements }                 from "../data/virements.data.js";
import { findAllClients }                from "../data/clients.data.js";
import { findTransactionsByAccountId, findOwnedAccountAccess } from "../data/comptes.data.js";

/** Formate une date en chaîne lisible selon la locale fr-CA. */
const fmtDate = (d) => (d ? new Date(d).toLocaleString("fr-CA") : "");

/* ── Audit logs (ADMIN) ──────────────────────────── */

/**
 * Exporte les 5 000 dernières entrées du journal d'audit au format CSV.
 *
 * Chaque ligne inclut : id, date, prénom/nom/email/rôle de l'auteur, action et détails.
 *
 * @async
 * @route GET /api/export/audit
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - Téléchargement CSV | 500
 */
export const exportAuditCSV = async (req, res) => {
  try {
    const rows = await findRecentAuditLogs(5000);
    const csv = toCSV(
      rows.map((r) => ({ ...r, date: fmtDate(r.cree_le) })),
      [
        { key: "id",               label: "ID" },
        { key: "date",             label: "Date" },
        { key: "prenom",           label: "Prénom" },
        { key: "nom",              label: "Nom" },
        { key: "email",            label: "Email" },
        { key: "role_utilisateur", label: "Rôle" },
        { key: "action",           label: "Action" },
        { key: "details",          label: "Détails" },
      ]
    );
    sendCSV(res, `audit-${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ message: "Erreur export", error: err.message });
  }
};

/* ── Utilisateurs (ADMIN + MODERATEUR) ──────────── */

/**
 * Exporte la liste de tous les utilisateurs au format CSV.
 *
 * @async
 * @route GET /api/export/utilisateurs
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - Téléchargement CSV | 500
 */
export const exportUsersCSV = async (req, res) => {
  try {
    const rows = await findAllUsers();
    const csv = toCSV(
      rows.map((r) => ({ ...r, date: fmtDate(r.cree_le) })),
      [
        { key: "id",    label: "ID" },
        { key: "prenom",label: "Prénom" },
        { key: "nom",   label: "Nom" },
        { key: "email", label: "Email" },
        { key: "role",  label: "Rôle" },
        { key: "date",  label: "Inscrit le" },
      ]
    );
    sendCSV(res, `utilisateurs-${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ message: "Erreur export", error: err.message });
  }
};

/* ── Clients (ADMIN + MODERATEUR) ───────────────── */

/**
 * Exporte la liste de tous les clients au format CSV.
 *
 * @async
 * @route GET /api/export/clients
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - Téléchargement CSV | 500
 */
export const exportClientsCSV = async (req, res) => {
  try {
    const rows = await findAllClients();
    const csv = toCSV(rows, [
      { key: "id",           label: "ID" },
      { key: "prenom",       label: "Prénom" },
      { key: "nom",          label: "Nom" },
      { key: "email_fictif", label: "Email" },
      { key: "ville",        label: "Ville" },
    ]);
    sendCSV(res, `clients-${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ message: "Erreur export", error: err.message });
  }
};

/* ── Virements (tous rôles, filtré) ─────────────── */

/**
 * Exporte les virements au format CSV selon les droits de l'utilisateur.
 *
 * Admin/modérateur : tous les virements de la banque.
 * Utilisateur standard : uniquement les virements impliquant ses clients.
 *
 * @async
 * @route GET /api/export/virements
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - Téléchargement CSV | 500
 */
export const exportVirementsCSV = async (req, res) => {
  try {
    const { user } = req.session;
    const isAdmin = user.role === "ADMIN" || user.role === "MODERATEUR";
    const rows = await findVirements({ userId: user.id, isAdmin, search: "" });
    const csv = toCSV(
      rows.map((r) => ({ ...r, date: fmtDate(r.date_virement) })),
      [
        { key: "id",                        label: "ID" },
        { key: "date",                      label: "Date" },
        { key: "client_source_nom",         label: "Client source" },
        { key: "compte_source_numero",      label: "Compte source" },
        { key: "client_destination_nom",    label: "Client destination" },
        { key: "compte_destination_numero", label: "Compte destination" },
        { key: "montant",                   label: "Montant" },
        { key: "statut",                    label: "Statut" },
        { key: "description",               label: "Description" },
      ]
    );
    sendCSV(res, `virements-${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ message: "Erreur export", error: err.message });
  }
};

/* ── Transactions d'un compte ────────────────────── */

/**
 * Exporte les transactions d'un compte spécifique au format CSV.
 *
 * Les admin/modérateurs peuvent exporter n'importe quel compte.
 * Un utilisateur standard ne peut exporter que les comptes de ses propres clients.
 *
 * @async
 * @route GET /api/export/comptes/:compteId/transactions
 * @param {import("express").Request}  req - Params : { compteId }
 * @param {import("express").Response} res - Téléchargement CSV | 400 | 403 | 500
 */
export const exportTransactionsCSV = async (req, res) => {
  try {
    const { user } = req.session;
    const compteId = Number(req.params.compteId);
    if (!compteId) return res.status(400).json({ message: "compteId invalide" });

    // Vérification d'accès : un utilisateur non-élevé ne peut exporter que ses propres comptes
    const isElevated = user.role === "ADMIN" || user.role === "MODERATEUR";
    if (!isElevated) {
      const access = await findOwnedAccountAccess(user.id, compteId);
      if (!access) return res.status(403).json({ message: "Accès refusé à ce compte" });
    }

    const rows = await findTransactionsByAccountId(compteId);
    const csv = toCSV(
      rows.map((r) => ({ ...r, date: fmtDate(r.date_transaction) })),
      [
        { key: "id",               label: "ID" },
        { key: "date",             label: "Date" },
        { key: "type_transaction", label: "Type" },
        { key: "description",      label: "Description" },
        { key: "montant",          label: "Montant" },
        { key: "statut",           label: "Statut" },
      ]
    );
    sendCSV(res, `transactions-compte${compteId}-${Date.now()}.csv`, csv);
  } catch (err) {
    res.status(500).json({ message: "Erreur export", error: err.message });
  }
};
