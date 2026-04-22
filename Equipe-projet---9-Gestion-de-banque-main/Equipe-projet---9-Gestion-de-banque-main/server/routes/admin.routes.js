/**
 * @fileoverview Routes d'administration et de modération.
 *
 * Toutes les routes de ce fichier nécessitent une authentification (authMiddleware).
 * Les routes sont ensuite protégées par niveau d'accès :
 *  - requireAdmin    : ADMIN seulement
 *  - requireElevated : ADMIN ou MODERATEUR
 *
 * Groupes de routes :
 *  - /comptes       : Ajustement de solde, blocage/déblocage, changement de type
 *  - /transactions  : Insertion et suppression de transactions manuelles
 *  - /virements     : Insertion, suppression et transfert forcé
 *  - /utilisateurs  : Liste, création, modification de rôle/mot de passe, suppression, auto-validation
 *
 * @module routes/admin
 */

import express from "express";
import authMiddleware, { requireAdmin, requireElevated } from "../middlewares/auth.middleware.js";
import admin from "../controllers/admin.controller.js";
import interac from "../controllers/interac.controller.js";
import {
  validateId,
  validateCreateUser,
  validateAdjustBalance,
  validateChangeAccountType,
  validateAddTransaction,
  validateAddVirement,
  validateForceTransfer,
  validateChangeUserRole,
  validateResetPassword,
  validateAutoValidation,
} from "../middlewares/validation.middleware.js";

const router = express.Router();

// Toutes les routes nécessitent d'être authentifié
router.use(authMiddleware);

/* ── Comptes (ADMIN uniquement) ───────────────────── */

/** Ajuste le solde d'un compte (positif ou négatif). */
router.patch("/comptes/:id/balance",  requireAdmin, validateId(), validateAdjustBalance,    admin.adjustBalance);
/** Bascule l'état actif/bloqué d'un compte. */
router.patch("/comptes/:id/status",   requireAdmin, validateId(),                           admin.toggleAccountStatus);
/** Modifie le type d'un compte (CHEQUES, EPARGNE, CREDIT). */
router.patch("/comptes/:id/type",     requireAdmin, validateId(), validateChangeAccountType, admin.changeAccountType);

/* ── Transactions (ADMIN uniquement) ─────────────── */

/** Insère manuellement une transaction sur un compte. */
router.post("/comptes/:id/transactions",  requireAdmin, validateId(), validateAddTransaction, admin.addTransaction);
/** Supprime une transaction (avec reversement de solde optionnel). */
router.delete("/transactions/:txId",      requireAdmin, validateId("txId"),                   admin.removeTransaction);

/* ── Virements (ADMIN uniquement) ────────────────── */

/** Effectue un transfert forcé entre deux comptes sans vérification de solde. */
router.post("/virements/force",           requireAdmin, validateForceTransfer,  admin.forceTransfer);
/** Insère manuellement un virement entre deux comptes. */
router.post("/virements",                 requireAdmin, validateAddVirement,    admin.addVirement);
/** Supprime un virement (avec reversement des soldes optionnel). */
router.delete("/virements/:virementId",   requireAdmin, validateId("virementId"), admin.removeVirement);

/* ── Utilisateurs ─────────────────────────────────── */

/** Retourne la liste de tous les utilisateurs. */
router.get("/utilisateurs",                        requireElevated,                              admin.getUsers);
/** Crée un nouvel utilisateur avec le rôle MODERATEUR. */
router.post("/utilisateurs/moderateur",            requireElevated, validateCreateUser,          admin.createModerator);
/** Modifie le rôle d'un utilisateur. */
router.patch("/utilisateurs/:id/role",             requireElevated, validateId(), validateChangeUserRole, admin.changeUserRole);
/** Crée un nouvel utilisateur avec le rôle ADMIN. */
router.post("/utilisateurs/admin",                 requireAdmin,    validateCreateUser,          admin.createAdmin);
/** Supprime un utilisateur du système. */
router.delete("/utilisateurs/:id",                 requireAdmin,    validateId(),                admin.deleteUser);
/** Réinitialise le mot de passe d'un utilisateur. */
router.patch("/utilisateurs/:id/password",         requireAdmin,    validateId(), validateResetPassword, admin.resetPassword);
/** Active ou désactive l'auto-validation pour un utilisateur. */
router.patch("/utilisateurs/:id/auto_validation",  requireElevated, validateId(), validateAutoValidation, admin.setAutoValidation);

/* ── Interac — administration par client ──────────── */

/** Historique Interac (envoyés + reçus) d'un client. */
router.get("/interac/client/:clientId",              requireElevated, validateId("clientId"), interac.adminGetTransfertsClient);
/** Statistiques d'utilisation des limites Interac d'un client. */
router.get("/interac/client/:clientId/stats",        requireElevated, validateId("clientId"), interac.adminGetStatsClient);
/** Profil d'auto-dépôt d'un client. */
router.get("/interac/client/:clientId/autodeposit",  requireElevated, validateId("clientId"), interac.adminGetAutoDepositClient);
/** Force l'activation de l'auto-dépôt (sans token de confirmation). */
router.post("/interac/client/:clientId/autodeposit", requireAdmin,    validateId("clientId"), interac.adminForceActiverAutoDeposit);
/** Désactive l'auto-dépôt d'un client. */
router.delete("/interac/client/:clientId/autodeposit", requireAdmin,  validateId("clientId"), interac.adminDesactiverAutoDeposit);
/** Récupère les limites Interac personnalisées d'un client. */
router.get("/interac/client/:clientId/limites",        requireElevated, validateId("clientId"), interac.adminGetLimitesClient);
/** Met à jour les limites Interac personnalisées d'un client. */
router.patch("/interac/client/:clientId/limites",      requireAdmin,    validateId("clientId"), interac.adminSetLimitesClient);

export default router;
