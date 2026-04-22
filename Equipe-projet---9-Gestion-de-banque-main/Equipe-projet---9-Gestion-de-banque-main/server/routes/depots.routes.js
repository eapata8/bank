/**
 * @fileoverview Routes pour la gestion des dépôts par chèque — /api/depots
 *
 * GET   /                  — Liste des dépôts (filtrée selon le rôle)
 *
 * GET   /:id               — Détails d'un dépôt spécifique
 *
 * POST  /                  — Soumission d'un nouveau dépôt (avec photo du chèque)
 *                            Interdit aux MODERATEUR (requireNotModerator)
 *                            Fichier uploadé via le middleware Multer (uploadCheque)
 *
 * PATCH /:id/approuver     — Approbation d'un dépôt EN_ATTENTE → solde crédité
 *                            Réservé aux ADMIN et MODERATEUR (requireElevated)
 *
 * PATCH /:id/rejeter       — Rejet d'un dépôt EN_ATTENTE → aucun crédit
 *                            Réservé aux ADMIN et MODERATEUR (requireElevated)
 *
 * @module routes/depots
 */

import express from "express";
import authMiddleware, { requireElevated, requireNotModerator } from "../middlewares/auth.middleware.js";
import { uploadCheque } from "../middlewares/upload.middleware.js";
import * as depots from "../controllers/depots.controller.js";
import { validateId, validateCreateDepot } from "../middlewares/validation.middleware.js";

const router = express.Router();

// Liste des dépôts (tous pour admin/modérateur, ses dépôts seulement pour utilisateur)
router.get("/",                authMiddleware,                                             depots.getDepots);

// Détails d'un dépôt par id
router.get("/:id",             authMiddleware,       validateId(),                        depots.getDepotById);

// Soumission d'un dépôt : upload de l'image du chèque puis validation des champs
// Note : requireNotModerator car les modérateurs approuvent/rejettent mais ne soumettent pas
router.post("/",               requireNotModerator,  uploadCheque, validateCreateDepot,   depots.createDepot);

// Approbation d'un dépôt en attente (admin ou modérateur)
router.patch("/:id/approuver", requireElevated,      validateId(),                        depots.approuverDepot);

// Rejet d'un dépôt en attente avec motif optionnel (admin ou modérateur)
router.patch("/:id/rejeter",   requireElevated,      validateId(),                        depots.rejeterDepot);

export default router;
