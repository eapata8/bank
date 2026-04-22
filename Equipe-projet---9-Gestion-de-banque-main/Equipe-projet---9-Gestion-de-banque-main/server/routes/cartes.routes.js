/**
 * @fileoverview Routes pour la gestion des cartes de crédit — /api/cartes
 *
 * GET   /                  — Liste des cartes (filtrée selon le rôle)
 * GET   /:id               — Détails d'une carte (avec contrôle d'accès)
 *
 * Actions ADMIN uniquement (requireAdmin) :
 *   POST  /                — Création d'une carte pour un client
 *   PATCH /:id/bloquer     — Blocage administratif d'une carte
 *   PATCH /:id/activer     — Activation / déblocage d'une carte
 *   PATCH /:id/limite      — Modification de la limite de crédit
 *   PATCH /:id/solde       — Correction manuelle du solde utilisé
 *
 * Actions ouvertes à tous les utilisateurs authentifiés (authMiddleware) :
 *   PATCH /:id/geler       — Gel de sécurité (utilisateur pour ses propres cartes, admin pour toutes)
 *   PATCH /:id/degeler     — Dégel (utilisateur pour ses propres cartes, admin pour toutes)
 *
 * Action interdite aux MODERATEUR (requireNotModerator) :
 *   POST  /:id/rembourser  — Remboursement d'une carte via un compte bancaire
 *
 * @module routes/cartes
 */

import express from "express";
import authMiddleware, { requireAdmin, requireNotModerator } from "../middlewares/auth.middleware.js";
import cartes from "../controllers/cartes.controller.js";
import {
  validateId,
  validateCreateCarte,
  validateModifierLimiteCarte,
  validateModifierSoldeCarte,
  validateRembourserCarte,
} from "../middlewares/validation.middleware.js";

const router = express.Router();

// ── Lecture (tous les utilisateurs connectés) ────────────────────────────────

// Liste des cartes (filtrée selon le rôle)
router.get("/",                   authMiddleware,                                                          cartes.getCartes);

// Détails d'une carte (403 si la carte appartient à un autre client)
router.get("/:id",                authMiddleware, validateId(),                                            cartes.getCarteById);

// ── Création et gestion admin (ADMIN uniquement) ─────────────────────────────

// Création d'une carte de crédit pour un client
router.post("/",                  requireAdmin,   validateCreateCarte,                                    cartes.createCarteItem);

// Blocage administratif (fraude, contentieux — ne peut être levé que par /activer)
router.patch("/:id/bloquer",      requireAdmin,   validateId(),                                            cartes.bloquerCarte);

// Activation / déblocage d'une carte (GELEE ou BLOQUEE → ACTIVE)
router.patch("/:id/activer",      requireAdmin,   validateId(),                                            cartes.activerCarte);

// Modification de la limite de crédit accordée
router.patch("/:id/limite",       requireAdmin,   validateId(), validateModifierLimiteCarte,               cartes.modifierLimiteCarte);

// Correction manuelle du solde utilisé (usage admin uniquement)
router.patch("/:id/solde",        requireAdmin,   validateId(), validateModifierSoldeCarte,                cartes.modifierSoldeCarte);

// ── Gel / dégel (utilisateur pour ses propres cartes, admin pour toutes) ─────

// Gel de sécurité (mesure temporaire — peut être levée par le titulaire)
router.patch("/:id/geler",        authMiddleware, validateId(),                                            cartes.gelerCarte);

// Dégel : l'utilisateur peut lever son propre gel, mais pas un blocage admin
router.patch("/:id/degeler",      authMiddleware, validateId(),                                            cartes.degelerCarte);

// ── Remboursement (interdit aux modérateurs) ─────────────────────────────────

// Remboursement de la carte en débitant un compte CHEQUES ou EPARGNE
router.post("/:id/rembourser",    requireNotModerator, validateId(), validateRembourserCarte,              cartes.rembourserCarte);

export default router;
