/**
 * @fileoverview Routes pour la gestion des comptes bancaires — /api/comptes
 *
 * GET  /types           — Liste des types de comptes disponibles (CHEQUES, EPARGNE, CREDIT)
 *
 * GET  /                — Comptes accessibles à l'utilisateur connecté
 *                         (tous pour admin/modérateur, les siens pour utilisateur)
 *
 * POST /                — Création d'un compte pour un client (admin/modérateur uniquement)
 *
 * GET  /:id             — Détails d'un compte spécifique
 *                         (accès vérifié : 403 si le compte appartient à un autre client)
 *
 * GET  /:id/transactions — Historique des transactions d'un compte
 *                          (accès vérifié comme ci-dessus)
 *
 * @module routes/comptes
 */

import express from "express";
import authMiddleware, { requireElevated } from "../middlewares/auth.middleware.js";
import comptes from "../controllers/comptes.controller.js";
import { validateId, validateCreateCompte } from "../middlewares/validation.middleware.js";

const router = express.Router();

// Liste des comptes selon le rôle de l'utilisateur (avec filtre de recherche optionnel)
router.get("/",                   authMiddleware,                              comptes.getMyAccounts);

// Types de comptes statiques — pas besoin d'aller en base de données
router.get("/types",              authMiddleware,                              comptes.getAccountTypes);

// Création d'un compte — réservé aux admin/modérateurs
router.post("/",                  authMiddleware, requireElevated, validateCreateCompte, comptes.createCompte);

// Détails d'un compte par id (avec contrôle d'accès)
router.get("/:id",                authMiddleware, validateId(),               comptes.getAccountById);

// Historique des transactions d'un compte (avec contrôle d'accès)
router.get("/:id/transactions",   authMiddleware, validateId(),               comptes.getAccountTransactions);

export default router;
