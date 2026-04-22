/**
 * @fileoverview Routes pour la gestion des factures — /api/factures
 *
 * GET  /           — Liste des factures (filtrée selon le rôle)
 *                    Triées par priorité : IMPAYEE > A_VENIR > PAYEE
 *
 * GET  /:id        — Détails d'une facture (avec contrôle d'accès)
 *
 * POST /           — Création d'une facture
 *                    - Admin : pour n'importe quel client, statut libre (A_VENIR ou IMPAYEE)
 *                    - Utilisateur : pour son propre client, statut forcé à IMPAYEE
 *                    - Interdit aux MODERATEUR (requireNotModerator)
 *
 * POST /:id/payer  — Paiement d'une facture via un compte bancaire
 *                    Le compte doit appartenir au même client que la facture
 *                    Interdit aux MODERATEUR (requireNotModerator)
 *
 * @module routes/factures
 */

import express from "express";
import authMiddleware, { requireNotModerator } from "../middlewares/auth.middleware.js";
import factures from "../controllers/factures.controller.js";
import { validateId, validateCreateFacture, validatePayFacture } from "../middlewares/validation.middleware.js";

const router = express.Router();

// Liste des factures (filtrée par rôle, avec recherche optionnelle)
router.get("/",            authMiddleware,                                                    factures.getFactures);

// Détails d'une facture (403 si la facture appartient à un autre client)
router.get("/:id",         authMiddleware,      validateId(),                                factures.getFactureById);

// Création d'une facture — interdit aux modérateurs
router.post("/",           requireNotModerator, validateCreateFacture,                       factures.createFactureItem);

// Paiement d'une facture — interdit aux modérateurs, le compte doit appartenir au bon client
router.post("/:id/payer",  requireNotModerator, validateId(), validatePayFacture,            factures.payFactureById);

export default router;
