/**
 * @fileoverview Routes pour la gestion des transactions récurrentes — /api/recurrentes
 *
 * GET  /           — Liste des récurrentes de l'utilisateur (ou toutes si ADMIN)
 * POST /           — Créer une nouvelle récurrente (UTILISATEUR et ADMIN, pas MODERATEUR)
 * PATCH /:id/suspendre — Suspendre une récurrente ACTIVE
 * PATCH /:id/reprendre — Reprendre une récurrente SUSPENDUE
 * DELETE /:id      — Annuler définitivement une récurrente
 * GET  /admin/all  — Vue admin de toutes les récurrentes (ADMIN uniquement)
 *
 * @module routes/recurrentes
 */

import express from "express";
import { requireAuth, requireAdmin, requireNotModerator } from "../middlewares/auth.middleware.js";
import { validateId, validateCreateRecurrente } from "../middlewares/validation.middleware.js";
import recurrentes from "../controllers/recurrentes.controller.js";

const router = express.Router();

// Vue admin globale — doit être avant /:id pour éviter les conflits de route
router.get("/admin/all", requireAdmin, recurrentes.adminGetRecurrentes);



// Vérifier un numéro de compte (retourne uniquement id + type + nom client, jamais le solde)
router.get("/verifier-compte", requireAuth, requireNotModerator, recurrentes.verifierCompte);

// Consulter ses propres récurrentes (ou toutes si ADMIN)
router.get("/", requireAuth, recurrentes.getRecurrentes);

// Créer une récurrente (UTILISATEUR ou ADMIN — pas MODERATEUR)
router.post("/", requireAuth, requireNotModerator, validateCreateRecurrente, recurrentes.createRecurrente);

// Suspendre une récurrente ACTIVE
router.patch("/:id/suspendre", requireAuth, requireNotModerator, validateId("id"), recurrentes.suspendreRecurrente);

// Reprendre une récurrente SUSPENDUE
router.patch("/:id/reprendre", requireAuth, requireNotModerator, validateId("id"), recurrentes.reprendreRecurrente);

// Annuler définitivement une récurrente
router.delete("/:id", requireAuth, requireNotModerator, validateId("id"), recurrentes.annulerRecurrente);

export default router;
