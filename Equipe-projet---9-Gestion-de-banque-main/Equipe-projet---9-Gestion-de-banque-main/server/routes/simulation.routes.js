/**
 * @fileoverview Routes pour le mode simulation — /api/simulation
 *
 * GET    /snapshots              — Liste tous les snapshots
 * POST   /snapshots              — Crée un snapshot de l'état courant
 * POST   /snapshots/:id/restaurer — Restaure la base vers un snapshot
 * DELETE /snapshots/:id          — Supprime un snapshot (sauf initial)
 *
 * Toutes les routes requièrent le rôle ADMIN.
 *
 * @module routes/simulation
 */

import express from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  validateId,
  validateClientIdQuery,
  validateCreateSnapshot,
} from "../middlewares/validation.middleware.js";
import simulation from "../controllers/simulation.controller.js";

const router = express.Router();

router.get("/snapshots",
  requireAuth, requireAdmin, validateClientIdQuery, simulation.getSnapshots);

router.post("/snapshots",
  requireAuth, requireAdmin, validateCreateSnapshot, simulation.createSnapshot);

router.post("/snapshots/:id/restaurer",
  requireAuth, requireAdmin, validateId("id"), simulation.restaurerSnapshot);

router.delete("/snapshots/:id",
  requireAuth, requireAdmin, validateId("id"), simulation.deleteSnapshot);

export default router;
