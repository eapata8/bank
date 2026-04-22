/**
 * @fileoverview Routes pour la gestion des bénéficiaires Interac — /api/beneficiaires
 *
 * GET    /     — Liste des bénéficiaires de l'utilisateur connecté
 * POST   /     — Ajouter un nouveau bénéficiaire
 * DELETE /:id  — Supprimer un bénéficiaire
 *
 * Toutes les routes nécessitent une session active et sont interdites
 * aux MODERATEURS (requireNotModerator).
 *
 * @module routes/beneficiaires
 */

import express from "express";
import { requireAuth, requireNotModerator } from "../middlewares/auth.middleware.js";
import beneficiaires from "../controllers/beneficiaires.controller.js";

const router = express.Router();

// Lister ses bénéficiaires
router.get("/", requireAuth, requireNotModerator, beneficiaires.getBeneficiaires);

// Ajouter un bénéficiaire
router.post("/", requireAuth, requireNotModerator, beneficiaires.createBeneficiaire);

// Supprimer un bénéficiaire
router.delete("/:id", requireAuth, requireNotModerator, beneficiaires.deleteBeneficiaire);

export default router;
