import express from "express";
import authMiddleware, { requireAdmin, requireElevated } from "../middlewares/auth.middleware.js";
import * as exp from "../controllers/export.controller.js";

const router = express.Router();

router.use(authMiddleware);

// Audit logs — ADMIN uniquement
router.get("/audit",                        requireAdmin,    exp.exportAuditCSV);

// Utilisateurs & clients — ADMIN + MODERATEUR
router.get("/utilisateurs",                 requireElevated, exp.exportUsersCSV);
router.get("/clients",                      requireElevated, exp.exportClientsCSV);

// Virements — tous les rôles connectés (filtré selon le rôle)
router.get("/virements",                    exp.exportVirementsCSV);

// Transactions d'un compte — tous les rôles (UTILISATEUR limité à ses propres comptes)
router.get("/transactions/:compteId",       exp.exportTransactionsCSV);

export default router;
