/**
 * @fileoverview Routes pour les virements Interac e-Transfer — /api/interac
 *
 * IMPORTANT — Ordre des routes :
 *   Les routes statiques (/autodeposit, /a-reclamer) sont déclarées
 *   AVANT les routes paramétriques (/:id) pour éviter qu'Express
 *   interprète "autodeposit" comme un paramètre :id invalide.
 *
 * Routes auto-dépôt :
 *   GET    /autodeposit           — Consulter son profil d'auto-dépôt
 *   POST   /autodeposit           — Activer l'auto-dépôt directement (email + compte)
 *   DELETE /autodeposit           — Désactiver l'auto-dépôt
 *
 * Routes transferts :
 *   GET    /                      — Liste des transferts (filtrée selon le rôle)
 *   GET    /a-reclamer            — Transferts EN_ATTENTE destinés à l'utilisateur
 *   POST   /                      — Envoyer un virement Interac
 *   POST   /:id/reclamer          — Réclamer un transfert (mot de passe + compte)
 *   DELETE /:id                   — Annuler un transfert EN_ATTENTE
 *
 * @module routes/interac
 */

import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import interac from "../controllers/interac.controller.js";
import {
  validateSendInterac,
  validateReclamerInterac,
  validateDemanderAutoDeposit,
  validateId,
} from "../middlewares/validation.middleware.js";

const router = express.Router();

/* ── Routes statiques — doivent précéder les routes paramétriques ── */

// Profil d'auto-dépôt
router.get("/autodeposit",            authMiddleware,                               interac.getAutoDeposit);

// Activation directe de l'auto-dépôt (email + compte de réception)
router.post("/autodeposit",           authMiddleware, validateDemanderAutoDeposit,  interac.demanderAutoDeposit);

// Désactivation de l'auto-dépôt (pas de validateId — route statique)
router.delete("/autodeposit",         authMiddleware,                               interac.desactiverAutoDeposit);

// Transferts en attente de réclamation pour l'utilisateur connecté
router.get("/a-reclamer",             authMiddleware,                               interac.getTransfertsAReclamer);

// Limites effectives de l'utilisateur connecté (personnalisées ou globales)
router.get("/limites",                authMiddleware,                               interac.getLimitesInterac);

/* ── Routes paramétriques — après les routes statiques ── */

// Liste de tous les transferts (filtrée selon le rôle)
router.get("/",                       authMiddleware,                               interac.getTransferts);

// Envoyer un virement Interac
router.post("/",                      authMiddleware, validateSendInterac,          interac.sendTransfert);

// Réclamer un transfert (destinataire entre mot de passe)
router.post("/:id/reclamer",          authMiddleware, validateId("id"), validateReclamerInterac, interac.reclamerTransfert);

// Annuler un transfert EN_ATTENTE (expéditeur ou admin)
router.delete("/:id",                 authMiddleware, validateId("id"),             interac.cancelTransfert);

export default router;
