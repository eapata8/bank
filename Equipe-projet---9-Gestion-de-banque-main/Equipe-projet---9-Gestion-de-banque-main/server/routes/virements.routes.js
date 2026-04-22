/**
 * @fileoverview Routes pour la gestion des virements bancaires — /api/virements
 *
 * GET  /         — Liste des virements (filtrée selon le rôle)
 *
 * POST /         — Virement interne entre deux comptes identifiés par leur id
 *                  L'utilisateur doit posséder le compte source ET le compte destination
 *                  (sauf admin qui peut utiliser n'importe quels comptes)
 *
 * POST /externe  — Virement externe vers un compte identifié par ses coordonnées bancaires
 *                  (numéro, institution, transit, SWIFT optionnel)
 *
 * Tous les virements sont traités immédiatement (statut ACCEPTE) sans file de modération.
 *
 * @module routes/virements
 */

import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import virements from "../controllers/virements.controller.js";
import { validateCreateVirement, validateCreateVirementExterne } from "../middlewares/validation.middleware.js";

const router = express.Router();

// Liste des virements (filtrée selon le rôle de l'utilisateur)
router.get("/",         authMiddleware,                               virements.getVirements);

// Virement interne par id de compte (vérification d'autorisation sur source et destination)
router.post("/",        authMiddleware, validateCreateVirement,       virements.createVirement);

// Virement externe par coordonnées bancaires
router.post("/externe", authMiddleware, validateCreateVirementExterne, virements.createVirementExterne);

export default router;
