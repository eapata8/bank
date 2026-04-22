/**
 * @fileoverview Routes pour les demandes de produits financiers.
 *
 * GET    /api/demandes-produits              — Lister les demandes (rôle-dépendant)
 * GET    /api/demandes-produits/:id          — Détail d'une demande
 * POST   /api/demandes-produits              — Soumettre une demande (client/admin)
 * PATCH  /api/demandes-produits/:id/approuver — Approuver (admin/modérateur)
 * PATCH  /api/demandes-produits/:id/refuser   — Refuser (admin/modérateur)
 *
 * @module routes/demandes_produits
 */

import { Router } from "express";
import {
  requireAuth,
  requireElevated,
  requireNotModerator,
} from "../middlewares/auth.middleware.js";
import { validateCreateDemandeProduit } from "../middlewares/validation.middleware.js";
import * as ctrl from "../controllers/demandes_produits.controller.js";

const router = Router();

router.get("/",    requireAuth,                                         ctrl.getDemandes);
router.get("/:id", requireAuth,                                         ctrl.getDemandeById);
router.post("/",   requireNotModerator, validateCreateDemandeProduit,   ctrl.createDemande);
router.patch("/:id/approuver", requireElevated,                         ctrl.approuverDemande);
router.patch("/:id/refuser",   requireElevated,                         ctrl.refuserDemande);
router.delete("/:id",          requireAuth,                             ctrl.annulerDemande);

export default router;
