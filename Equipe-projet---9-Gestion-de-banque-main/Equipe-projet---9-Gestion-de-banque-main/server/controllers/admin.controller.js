/**
 * @fileoverview Contrôleur pour les opérations administratives et de modération.
 *
 * Ce module expose les actions réservées aux admin/modérateurs :
 *  - Gestion des comptes : ajustement de solde, blocage/déblocage, changement de type
 *  - Transactions manuelles : insertion et suppression (avec reversement de solde optionnel)
 *  - Virements manuels : insertion, suppression, transfert forcé entre deux comptes
 *  - Gestion des utilisateurs : liste, création (admin/modérateur), suppression, rôle, mot de passe
 *  - Auto-validation : activation/désactivation par utilisateur
 *
 * Accès :
 *  - requireAdmin  : ADMIN seulement
 *  - requireElevated : ADMIN ou MODERATEUR
 *
 * @module controllers/admin
 */

import {
  findAllUsers,
  findUserById,
  getFirstAdminId,
  deleteUserById,
  updateUserRole,
  resetUserPassword,
  createAdminUser,
  createModeratorUser,
  findUserIdByEmail,
  findAccountWithClientInfo,
  setAccountBalance,
  setAccountStatus,
  setAccountType,
  findTransactionById,
  insertTransaction,
  deleteTransactionById,
  adjustBalanceBy,
  findVirementById,
  insertVirement,
  deleteVirementById,
  deleteTransactionsByVirementAccounts,
  findPairedVirementTransaction,
  updateAutoValidation,
  findUserById as findUserByIdAdmin,
} from "../data/admin.data.js";
import { findAnyAccountById } from "../data/comptes.data.js";
import { findAccountByCoords } from "../data/virements.data.js";
import { createAuditLog } from "../data/audit.data.js";

/** Rôles qu'un modérateur est autorisé à assigner (il ne peut pas créer d'admin). */
const ROLES_MODERATEUR_PEUT_ASSIGNER = ["UTILISATEUR", "MODERATEUR"];

/** Types de transactions acceptés pour les insertions manuelles. */
const VALID_TX_TYPES = ["DEPOT", "RETRAIT", "VIREMENT", "FRAIS", "REMBOURSEMENT", "CORRECTION"];

/** Rôles valides assignables dans le système. */
const VALID_ROLES = ["ADMIN", "MODERATEUR", "UTILISATEUR"];

/** Longueur minimale d'un mot de passe. */
const MIN_PASSWORD_LENGTH = 6;

/* ── Helpers ─────────────────────────────────────── */

/**
 * Récupère un compte avec ses infos client, et renvoie 404 si introuvable.
 *
 * @async
 * @param {number}                     compteId - Identifiant du compte.
 * @param {import("express").Response} res      - Objet réponse Express (pour écrire le 404).
 * @returns {Promise<object|null>} Le compte avec infos client, ou null si 404 envoyé.
 */
async function requireAccount(compteId, res) {
  const compte = await findAccountWithClientInfo(compteId);
  if (!compte) {
    res.status(404).json({ message: "Compte introuvable" });
    return null;
  }
  return compte;
}

/* ── Gestion des comptes ──────────────────────────── */

/**
 * Ajuste manuellement le solde d'un compte (positif ou négatif).
 *
 * Crée une transaction d'historique et un log d'audit.
 * Le type de transaction peut être précisé, sinon il est déduit du signe du montant.
 *
 * @async
 * @route PATCH /api/admin/comptes/:id/balance
 * @param {import("express").Request}  req - Params : { id } | Corps : { montant, motif?, type_transaction? }
 * @param {import("express").Response} res - 200 { message, nouveau_solde } | 404 | 500
 */
export const adjustBalance = async (req, res) => {
  try {
    const admin = req.session.user;
    const compteId = Number(req.params.id);
    if (!compteId || isNaN(compteId)) return res.status(400).json({ message: "Identifiant de compte invalide" });
    const { montant, motif, type_transaction } = req.body;
    if (montant === undefined || montant === null || montant === "") {
      return res.status(400).json({ message: "Le montant est requis" });
    }
    const amount = Number(montant);
    if (amount === 0 || isNaN(amount)) return res.status(400).json({ message: "Le montant doit être non nul" });
    if (type_transaction && !VALID_TX_TYPES.includes(type_transaction)) {
      return res.status(400).json({ message: "Type de transaction invalide" });
    }
    const typeTransaction = type_transaction || (amount > 0 ? "DEPOT" : "RETRAIT");

    const compte = await requireAccount(compteId, res);
    if (!compte) return;

    const newSolde = Number(compte.solde) + amount;
    await setAccountBalance(compteId, newSolde);

    await insertTransaction({
      compteId,
      typeTransaction,
      description: motif || `Ajustement admin: ${amount > 0 ? "+" : ""}${amount} CAD`,
      montant: amount,
      statut: "TERMINEE",
    });

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_ADJUST_BALANCE",
      details: `Compte #${compteId} (${compte.client_prenom} ${compte.client_nom}): solde ${Number(compte.solde).toFixed(2)} → ${newSolde.toFixed(2)} CAD. Motif: ${motif || "aucun"}`,
    });

    return res.json({ message: "Solde ajusté", nouveau_solde: newSolde });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Bascule l'état actif/bloqué d'un compte (toggle).
 *
 * Si le compte est actif, il est bloqué et vice-versa.
 *
 * @async
 * @route PATCH /api/admin/comptes/:id/status
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, est_actif } | 404 | 500
 */
export const toggleAccountStatus = async (req, res) => {
  try {
    const admin = req.session.user;
    const compteId = Number(req.params.id);
    if (!compteId || compteId <= 0) return res.status(400).json({ message: "Identifiant de compte invalide" });

    const compte = await requireAccount(compteId, res);
    if (!compte) return;

    const newStatus = compte.est_actif ? 0 : 1;
    await setAccountStatus(compteId, newStatus);

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: newStatus ? "ADMIN_UNBLOCK_COMPTE" : "ADMIN_BLOCK_COMPTE",
      details: `Compte #${compteId} (${compte.client_prenom} ${compte.client_nom}): ${newStatus ? "débloqué" : "bloqué"}`,
    });

    return res.json({ message: newStatus ? "Compte débloqué" : "Compte bloqué", est_actif: newStatus });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Modifie le type d'un compte (ex. CHEQUES → EPARGNE).
 *
 * @async
 * @route PATCH /api/admin/comptes/:id/type
 * @param {import("express").Request}  req - Params : { id } | Corps : { type_compte }
 * @param {import("express").Response} res - 200 { message, type_compte } | 404 | 500
 */
export const changeAccountType = async (req, res) => {
  try {
    const admin = req.session.user;
    const compteId = Number(req.params.id);
    const { type_compte } = req.body;
    if (!["CHEQUES", "EPARGNE", "CREDIT"].includes(type_compte)) {
      return res.status(400).json({ message: "Type de compte invalide (CHEQUES, EPARGNE ou CREDIT)" });
    }
    if (!compteId || compteId <= 0) return res.status(400).json({ message: "Identifiant de compte invalide" });

    const compte = await requireAccount(compteId, res);
    if (!compte) return;

    await setAccountType(compteId, type_compte);

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_CHANGE_ACCOUNT_TYPE",
      details: `Compte #${compteId} (${compte.client_prenom} ${compte.client_nom}): ${compte.type_compte} → ${type_compte}`,
    });

    return res.json({ message: "Type de compte modifié", type_compte });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ── Transactions manuelles ──────────────────────── */

/**
 * Insère manuellement une transaction sur un compte.
 *
 * Par défaut le solde est ajusté du montant de la transaction.
 * Ce comportement peut être désactivé avec ajuster_solde: false.
 *
 * @async
 * @route POST /api/admin/comptes/:id/transactions
 * @param {import("express").Request}  req - Params : { id } | Corps : { type_transaction?, description?, montant, statut?, date_transaction?, ajuster_solde? }
 * @param {import("express").Response} res - 201 { message, id } | 404 | 500
 */
export const addTransaction = async (req, res) => {
  try {
    const admin = req.session.user;
    const compteId = Number(req.params.id);
    if (!compteId || compteId <= 0) return res.status(400).json({ message: "Identifiant de compte invalide" });
    const { type_transaction, description, montant, statut, date_transaction, ajuster_solde } = req.body;
    const amount = Number(montant);
    if (amount === 0 || isNaN(amount)) return res.status(400).json({ message: "Le montant doit être non nul" });
    const typeTransaction = type_transaction || "DEPOT";
    if (!VALID_TX_TYPES.includes(typeTransaction)) return res.status(400).json({ message: "Type de transaction invalide" });

    const compte = await requireAccount(compteId, res);
    if (!compte) return;

    const txId = await insertTransaction({
      compteId,
      typeTransaction,
      description: description || null,
      montant: amount,
      statut: statut || "TERMINEE",
      dateTransaction: date_transaction ? new Date(date_transaction) : new Date(),
    });

    if (ajuster_solde !== false) {
      await adjustBalanceBy(compteId, amount);
    }

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_INSERT_TRANSACTION",
      details: `Compte #${compteId}: transaction #${txId} (${typeTransaction}, ${amount} CAD) insérée. Solde ajusté: ${ajuster_solde !== false}`,
    });

    return res.status(201).json({ message: "Transaction insérée", id: txId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Supprime une transaction et reverse optionnellement son impact sur le solde.
 *
 * Si la transaction est de type VIREMENT, la transaction jumelée sur l'autre compte
 * est également supprimée et son solde reversé.
 *
 * @async
 * @route DELETE /api/admin/transactions/:txId
 * @param {import("express").Request}  req - Params : { txId } | Corps : { reverser_solde? }
 * @param {import("express").Response} res - 200 { message } | 404 | 500
 */
export const removeTransaction = async (req, res) => {
  try {
    const admin = req.session.user;
    const txId = Number(req.params.txId);
    if (!txId || txId <= 0) return res.status(400).json({ message: "Identifiant de transaction invalide" });
    const { reverser_solde } = req.body;

    const tx = await findTransactionById(txId);
    if (!tx) return res.status(404).json({ message: "Transaction introuvable" });

    await deleteTransactionById(txId);

    let pairedInfo = null;
    if (reverser_solde !== false) {
      await adjustBalanceBy(tx.compte_id, -Number(tx.montant));

      // Si c'est un virement, on reverse aussi la transaction jumelée sur l'autre compte
      if (tx.type_transaction === "VIREMENT") {
        const paired = await findPairedVirementTransaction(tx.compte_id, Number(tx.montant), tx.date_transaction);
        if (paired) {
          await deleteTransactionById(paired.id);
          await adjustBalanceBy(paired.compte_id, -Number(paired.montant));
          pairedInfo = paired;
        }
      }
    }

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_DELETE_TRANSACTION",
      details: `Transaction #${txId} (compte #${tx.compte_id}, ${tx.montant} CAD) supprimée. Solde reversé: ${reverser_solde !== false}${pairedInfo ? `. Transaction jumelée #${pairedInfo.id} (compte #${pairedInfo.compte_id}) également supprimée.` : ""}`,
    });

    return res.json({ message: "Transaction supprimée" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ── Virements manuels ───────────────────────────── */

/**
 * Insère manuellement un virement entre deux comptes identifiés par leurs coordonnées bancaires.
 *
 * Les comptes sont retrouvés via leur numéro de compte, institution et transit.
 * Si le statut est ACCEPTE et ajuster_soldes est vrai (défaut), les soldes sont modifiés
 * et deux transactions d'historique sont créées (débit source + crédit destination).
 *
 * @async
 * @route POST /api/admin/virements
 * @param {import("express").Request}  req - Corps : { numero_compte_source, numero_institution_source, numero_transit_source, numero_compte_dest, numero_institution_dest, numero_transit_dest, montant, description?, statut?, date_virement?, ajuster_soldes? }
 * @param {import("express").Response} res - 201 { message, id } | 404 | 500
 */
export const addVirement = async (req, res) => {
  try {
    const admin = req.session.user;
    const {
      numero_compte_source, numero_institution_source, numero_transit_source,
      numero_compte_dest, numero_institution_dest, numero_transit_dest,
      montant,
      description,
      statut,
      date_virement,
      ajuster_soldes,
    } = req.body;

    if (!numero_compte_source || !numero_institution_source || !numero_transit_source ||
        !numero_compte_dest   || !numero_institution_dest   || !numero_transit_dest) {
      return res.status(400).json({ message: "Les coordonnées bancaires source et destination sont requises" });
    }
    const amount = Number(montant);
    if (amount <= 0 || isNaN(amount)) return res.status(400).json({ message: "Le montant doit être supérieur à 0" });
    const statutVirement = statut || "ACCEPTE";

    const [source, dest] = await Promise.all([
      findAccountByCoords({ numeroCompte: numero_compte_source, numeroInstitution: numero_institution_source, numeroTransit: numero_transit_source }),
      findAccountByCoords({ numeroCompte: numero_compte_dest,   numeroInstitution: numero_institution_dest,   numeroTransit: numero_transit_dest }),
    ]);
    if (!source) return res.status(404).json({ message: "Compte source introuvable avec ces coordonnées" });
    if (!dest)   return res.status(404).json({ message: "Compte destination introuvable avec ces coordonnées" });

    const sourceId = source.id;
    const destId   = dest.id;

    const dateVirement = date_virement ? new Date(date_virement) : new Date();

    const virementId = await insertVirement({
      compteSourceId: sourceId,
      compteDestinationId: destId,
      montant: amount,
      description: description || null,
      statut: statutVirement,
      dateVirement,
    });

    if (ajuster_soldes !== false && statutVirement === "ACCEPTE") {
      await adjustBalanceBy(sourceId, -amount);
      await adjustBalanceBy(destId, amount);

      await insertTransaction({
        compteId: sourceId,
        typeTransaction: "VIREMENT",
        description: description || `Virement admin vers #${destId}`,
        montant: -amount,
        statut: "TERMINEE",
        dateTransaction: dateVirement,
      });
      await insertTransaction({
        compteId: destId,
        typeTransaction: "VIREMENT",
        description: description || `Virement admin depuis #${sourceId}`,
        montant: amount,
        statut: "TERMINEE",
        dateTransaction: dateVirement,
      });
    }

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_INSERT_VIREMENT",
      details: `Virement #${virementId}: compte #${sourceId} → #${destId}, ${amount} CAD (${statutVirement}). Soldes ajustés: ${ajuster_soldes !== false && statutVirement === "ACCEPTE"}`,
    });

    return res.status(201).json({ message: "Virement inséré", id: virementId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Supprime un virement et reverse optionnellement les soldes des deux comptes concernés.
 *
 * Les transactions liées au virement (débit + crédit) sont également supprimées
 * si le reversement est activé.
 *
 * @async
 * @route DELETE /api/admin/virements/:virementId
 * @param {import("express").Request}  req - Params : { virementId } | Corps : { reverser_soldes? }
 * @param {import("express").Response} res - 200 { message } | 404 | 500
 */
export const removeVirement = async (req, res) => {
  try {
    const admin = req.session.user;
    const virementId = Number(req.params.virementId);
    const { reverser_soldes } = req.body;

    const virement = await findVirementById(virementId);
    if (!virement) return res.status(404).json({ message: "Virement introuvable" });

    if (reverser_soldes !== false && virement.statut === "ACCEPTE") {
      await deleteTransactionsByVirementAccounts({
        compteSourceId: virement.compte_source_id,
        compteDestinationId: virement.compte_destination_id,
        montant: Number(virement.montant),
        dateVirement: virement.date_virement,
      });
      await adjustBalanceBy(virement.compte_source_id, Number(virement.montant));
      await adjustBalanceBy(virement.compte_destination_id, -Number(virement.montant));
    }

    await deleteVirementById(virementId);

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_DELETE_VIREMENT",
      details: `Virement #${virementId} (compte #${virement.compte_source_id} → #${virement.compte_destination_id}, ${virement.montant} CAD) supprimé. Soldes reversés: ${reverser_soldes !== false && virement.statut === "ACCEPTE"}`,
    });

    return res.json({ message: "Virement supprimé" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Effectue un transfert forcé entre deux comptes sans contrainte de solde minimum.
 *
 * Contrairement à un virement normal, ce transfert ne vérifie pas le solde disponible.
 * Les deux comptes sont identifiés différemment : la source par son ID, la destination
 * par ses coordonnées bancaires.
 *
 * @async
 * @route POST /api/admin/virements/force
 * @param {import("express").Request}  req - Corps : { compte_source_id, numero_compte_dest, numero_institution_dest, numero_transit_dest, montant, description? }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 404 | 500
 */
export const forceTransfer = async (req, res) => {
  try {
    const admin = req.session.user;
    const {
      compte_source_id,
      numero_compte_dest, numero_institution_dest, numero_transit_dest,
      montant, description,
    } = req.body;

    if (!numero_compte_dest || !numero_institution_dest || !numero_transit_dest) {
      return res.status(400).json({ message: "Les coordonnées bancaires destination sont requises" });
    }
    const sourceId = Number(compte_source_id);
    const amount = Number(montant);
    if (amount <= 0 || isNaN(amount)) return res.status(400).json({ message: "Le montant doit être supérieur à 0" });

    const [source, dest] = await Promise.all([
      findAnyAccountById(sourceId),
      findAccountByCoords({ numeroCompte: numero_compte_dest, numeroInstitution: numero_institution_dest, numeroTransit: numero_transit_dest }),
    ]);
    if (!source) return res.status(404).json({ message: "Compte source introuvable" });
    if (!dest)   return res.status(404).json({ message: "Compte destination introuvable avec ces coordonnées" });

    const destId = dest.id;
    if (sourceId === destId) return res.status(400).json({ message: "Les comptes doivent être différents" });

    const now = new Date();

    const virementId = await insertVirement({
      compteSourceId: sourceId,
      compteDestinationId: destId,
      montant: amount,
      description: description || `Transfert forcé admin`,
      statut: "ACCEPTE",
      dateVirement: now,
    });

    await adjustBalanceBy(sourceId, -amount);
    await adjustBalanceBy(destId, amount);

    await insertTransaction({
      compteId: sourceId,
      typeTransaction: "VIREMENT",
      description: description || `Transfert forcé vers #${destId}`,
      montant: -amount,
      statut: "TERMINEE",
      dateTransaction: now,
    });
    await insertTransaction({
      compteId: destId,
      typeTransaction: "VIREMENT",
      description: description || `Transfert forcé depuis #${sourceId}`,
      montant: amount,
      statut: "TERMINEE",
      dateTransaction: now,
    });

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_FORCE_TRANSFER",
      details: `Transfert forcé #${virementId}: compte #${sourceId} → #${destId}, ${amount} CAD. Desc: ${description || "aucune"}`,
    });

    return res.status(201).json({ message: "Transfert forcé effectué", id: virementId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ── Gestion des utilisateurs ────────────────────── */

/**
 * Retourne la liste de tous les utilisateurs du système.
 *
 * @async
 * @route GET /api/admin/utilisateurs
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getUsers = async (req, res) => {
  try {
    const rows = await findAllUsers();
    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Supprime un utilisateur du système.
 *
 * Le premier administrateur créé (id le plus bas) ne peut jamais être supprimé
 * pour garantir qu'il reste toujours au moins un admin actif.
 *
 * @async
 * @route DELETE /api/admin/utilisateurs/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message } | 403 | 404 | 500
 */
export const deleteUser = async (req, res) => {
  try {
    const admin = req.session.user;
    const userId = Number(req.params.id);
    if (!userId || userId <= 0) return res.status(400).json({ message: "Identifiant invalide" });

    const firstAdminId = await getFirstAdminId();
    if (userId === firstAdminId) {
      return res.status(403).json({ message: "Le premier administrateur du système ne peut pas être supprimé" });
    }

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    await deleteUserById(userId);

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_DELETE_USER",
      details: `Utilisateur #${userId} (${user.email}, rôle: ${user.role}) supprimé`,
    });

    return res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Modifie le rôle d'un utilisateur.
 *
 * Règles :
 *  - Un utilisateur ne peut pas modifier son propre rôle
 *  - Un modérateur ne peut assigner que UTILISATEUR ou MODERATEUR (pas ADMIN)
 *  - Un modérateur ne peut pas modifier le rôle d'un compte ADMIN
 *
 * @async
 * @route PATCH /api/admin/utilisateurs/:id/role
 * @param {import("express").Request}  req - Params : { id } | Corps : { role }
 * @param {import("express").Response} res - 200 { message, role } | 403 | 404 | 500
 */
export const changeUserRole = async (req, res) => {
  try {
    const admin = req.session.user;
    const userId = Number(req.params.id);
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ message: "Rôle invalide" });
    if (!userId || userId <= 0) return res.status(400).json({ message: "Identifiant invalide" });

    // Un utilisateur ne peut pas modifier son propre rôle
    if (admin.id === userId) {
      return res.status(403).json({ message: "Vous ne pouvez pas modifier votre propre rôle" });
    }

    // Un modérateur ne peut assigner que UTILISATEUR ou MODERATEUR
    if (admin.role === "MODERATEUR" && !ROLES_MODERATEUR_PEUT_ASSIGNER.includes(role)) {
      return res.status(403).json({ message: "Un modérateur ne peut pas assigner le rôle ADMIN" });
    }

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    // Un modérateur ne peut pas modifier un compte ADMIN
    if (admin.role === "MODERATEUR" && user.role === "ADMIN") {
      return res.status(403).json({ message: "Un modérateur ne peut pas modifier le rôle d'un administrateur" });
    }

    await updateUserRole(userId, role);

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_CHANGE_USER_ROLE",
      details: `Utilisateur #${userId} (${user.email}): ${user.role} → ${role}`,
    });

    return res.json({ message: "Rôle modifié", role });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Réinitialise le mot de passe d'un utilisateur avec un nouveau mot de passe fourni par l'admin.
 *
 * Le mot de passe est haché avant d'être stocké (voir admin.data.js).
 *
 * @async
 * @route PATCH /api/admin/utilisateurs/:id/password
 * @param {import("express").Request}  req - Params : { id } | Corps : { nouveau_mot_de_passe }
 * @param {import("express").Response} res - 200 { message } | 404 | 500
 */
export const resetPassword = async (req, res) => {
  try {
    const admin = req.session.user;
    const userId = Number(req.params.id);
    const { nouveau_mot_de_passe } = req.body;
    if (!nouveau_mot_de_passe || nouveau_mot_de_passe.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Mot de passe trop court (minimum ${MIN_PASSWORD_LENGTH} caractères)` });
    }

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    await resetUserPassword(userId, nouveau_mot_de_passe);

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_RESET_PASSWORD",
      details: `Mot de passe réinitialisé pour l'utilisateur #${userId} (${user.email})`,
    });

    return res.json({ message: "Mot de passe réinitialisé" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée un nouvel utilisateur avec le rôle ADMIN.
 *
 * Réservé aux admins existants. Vérifie d'abord que l'email n'est pas déjà utilisé.
 *
 * @async
 * @route POST /api/admin/utilisateurs/admin
 * @param {import("express").Request}  req - Corps : { email, motDePasse, prenom, nom }
 * @param {import("express").Response} res - 201 { message, id } | 409 | 500
 */
export const createAdmin = async (req, res) => {
  try {
    const admin = req.session.user;
    const { email, motDePasse, prenom, nom } = req.body;
    if (!email || !motDePasse || !prenom || !nom) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (motDePasse.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Mot de passe trop court (minimum ${MIN_PASSWORD_LENGTH} caractères)` });
    }

    const existing = await findUserIdByEmail(email);
    if (existing) return res.status(409).json({ message: "Email déjà utilisé" });

    const newId = await createAdminUser({ email, motDePasse, prenom, nom });

    await createAuditLog({
      utilisateurId: admin.id,
      roleUtilisateur: admin.role,
      action: "ADMIN_CREATE_ADMIN",
      details: `Nouvel administrateur créé: ${email} (id: ${newId})`,
    });

    return res.status(201).json({ message: "Administrateur créé", id: newId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée un nouvel utilisateur avec le rôle MODERATEUR.
 *
 * Accessible aux admins et modérateurs. Vérifie d'abord que l'email n'est pas déjà utilisé.
 *
 * @async
 * @route POST /api/admin/utilisateurs/moderateur
 * @param {import("express").Request}  req - Corps : { email, motDePasse, prenom, nom }
 * @param {import("express").Response} res - 201 { message, id } | 409 | 500
 */
export const createModerator = async (req, res) => {
  try {
    const caller = req.session.user;
    const { email, motDePasse, prenom, nom } = req.body;
    if (!email || !motDePasse || !prenom || !nom) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (motDePasse.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Mot de passe trop court (minimum ${MIN_PASSWORD_LENGTH} caractères)` });
    }

    const existing = await findUserIdByEmail(email);
    if (existing) return res.status(409).json({ message: "Email déjà utilisé" });

    const newId = await createModeratorUser({ email, motDePasse, prenom, nom });

    await createAuditLog({
      utilisateurId: caller.id,
      roleUtilisateur: caller.role,
      action: "CREATE_MODERATEUR",
      details: `Nouveau modérateur créé: ${email} (id: ${newId})`,
    });

    return res.status(201).json({ message: "Modérateur créé", id: newId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Active ou désactive l'auto-validation pour un utilisateur.
 *
 * Lorsqu'activée, les dépôts et retraits soumis par cet utilisateur
 * sont approuvés immédiatement sans intervention d'un modérateur.
 *
 * @async
 * @route PATCH /api/admin/utilisateurs/:id/auto_validation
 * @param {import("express").Request}  req - Params : { id } | Corps : { auto_validation: boolean }
 * @param {import("express").Response} res - 200 { message } | 404 | 500
 */
export const setAutoValidation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });
    const { auto_validation } = req.body;

    const target = await findUserByIdAdmin(id);
    if (!target) return res.status(404).json({ message: "Utilisateur introuvable" });

    await updateAutoValidation(id, auto_validation);

    await createAuditLog({
      utilisateurId: req.session.user.id,
      roleUtilisateur: req.session.user.role,
      action: "SET_AUTO_VALIDATION",
      details: `Utilisateur #${id} — auto_validation = ${auto_validation ? "activée" : "désactivée"}`,
    });

    return res.json({ message: `Auto-validation ${auto_validation ? "activée" : "désactivée"} pour l'utilisateur #${id}` });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default {
  adjustBalance,
  toggleAccountStatus,
  changeAccountType,
  addTransaction,
  removeTransaction,
  addVirement,
  removeVirement,
  forceTransfer,
  getUsers,
  deleteUser,
  changeUserRole,
  resetPassword,
  createAdmin,
  createModerator,
  setAutoValidation,
};
