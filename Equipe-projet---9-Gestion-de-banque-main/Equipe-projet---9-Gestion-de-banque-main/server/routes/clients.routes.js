/**
 * @fileoverview Routes pour la gestion des clients bancaires — /api/clients
 *
 * GET  /                         — Liste des clients accessibles à l'utilisateur connecté
 *                                  (tous pour admin/modérateur, les siens pour utilisateur)
 *
 * POST /                         — Création d'un nouveau client (admin/modérateur uniquement)
 *
 * GET  /:clientId/comptes        — Comptes bancaires d'un client
 *                                  (accès vérifié pour les utilisateurs standards)
 *
 * GET  /:clientId/operations     — Vue complète de toutes les opérations d'un client
 *                                  (comptes, virements, dépôts, retraits, factures, cartes)
 *                                  Réservé aux admin/modérateurs.
 *
 * @module routes/clients
 */

import express from "express";
import authMiddleware, { requireElevated } from "../middlewares/auth.middleware.js";
import clients from "../controllers/clients.controller.js";
import { validateId, validateCreateClient } from "../middlewares/validation.middleware.js";

const router = express.Router();

// Liste des clients (filtrée selon le rôle de l'utilisateur)
router.get("/",                       authMiddleware,                                    clients.getMyClients);

// Création d'un client — réservé aux admin/modérateurs
router.post("/",                      authMiddleware, requireElevated, validateCreateClient, clients.createClient);

// Comptes d'un client spécifique (avec vérification d'accès pour les utilisateurs standards)
router.get("/:clientId/comptes",      authMiddleware, validateId("clientId"),            clients.getClientAccounts);

// Vue complète des opérations d'un client — réservé aux admin/modérateurs
router.get("/:clientId/operations",   authMiddleware, requireElevated, validateId("clientId"), clients.getClientOperations);

export default router;
