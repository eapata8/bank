/**
 * @fileoverview Routes pour la gestion des retraits en espèces — /api/retraits
 *
 * GET   /                  — Liste des retraits (filtrée selon le rôle)
 *
 * GET   /:id               — Détails d'un retrait spécifique
 *
 * POST  /                  — Soumission d'une demande de retrait
 *                            Interdit aux MODERATEUR (requireNotModerator)
 *                            Le solde est vérifié mais PAS bloqué à la soumission
 *
 * PATCH /:id/approuver     — Approbation d'un retrait EN_ATTENTE → solde débité
 *                            Réservé aux ADMIN et MODERATEUR (requireElevated)
 *                            L'agent doit remettre physiquement l'argent au client
 *
 * PATCH /:id/rejeter       — Rejet d'un retrait EN_ATTENTE → aucun débit
 *                            Réservé aux ADMIN et MODERATEUR (requireElevated)
 *
 * @module routes/retraits
 */

import express from "express";
import { getRetraits, getRetraitById, createRetrait, approuverRetrait, rejeterRetrait } from "../controllers/retraits.controller.js";
import { requireAuth, requireElevated, requireNotModerator } from "../middlewares/auth.middleware.js";
import { validateId, validateCreateRetrait } from "../middlewares/validation.middleware.js";

const router = express.Router();

// Liste des retraits (tous pour admin/modérateur, ses retraits pour utilisateur)
router.get("/",               requireAuth,     getRetraits);

// Détails d'un retrait par id
router.get("/:id",            requireAuth,     validateId(),           getRetraitById);

// Soumission d'un retrait — interdit aux modérateurs
router.post("/",              requireNotModerator, validateCreateRetrait,  createRetrait);

// Approbation d'un retrait en attente (admin ou modérateur)
router.patch("/:id/approuver", requireElevated, validateId(),          approuverRetrait);

// Rejet d'un retrait en attente (admin ou modérateur)
router.patch("/:id/rejeter",   requireElevated, validateId(),          rejeterRetrait);

export default router;
