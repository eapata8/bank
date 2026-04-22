/**
 * @fileoverview Routes d'authentification — /api/auth
 *
 * Ce fichier définit toutes les routes liées à l'authentification
 * et à la gestion des comptes utilisateurs.
 *
 * Routes publiques (sans authentification) :
 *  POST /register  — Inscription d'un nouvel utilisateur (rôle UTILISATEUR)
 *  POST /login     — Connexion et création de session
 *
 * Routes protégées (session requise) :
 *  POST   /logout           — Déconnexion et destruction de session
 *  GET    /me               — Informations de l'utilisateur connecté
 *
 * Routes réservées aux ADMIN :
 *  GET    /logs             — Journal d'audit complet
 *  GET    /moderateurs      — Liste des modérateurs
 *  POST   /moderateurs      — Création d'un modérateur
 *  DELETE /moderateurs/:id  — Suppression d'un modérateur
 *
 * @module routes/auth
 */

import express from "express";
import auth from "../controllers/auth.controller.js";
import authMiddleware, { requireAdmin } from "../middlewares/auth.middleware.js";
import { validateId, validateLogin, validateRegister, validateCreateUser } from "../middlewares/validation.middleware.js";

const router = express.Router();

// ── Routes publiques ──────────────────────────────────────────────────────────

// Inscription d'un nouveau compte utilisateur standard (rôle UTILISATEUR forcé)
router.post("/register",          validateRegister,                              auth.register);

// Connexion avec email/mot de passe → crée une session MySQL
router.post("/login",             validateLogin,                                 auth.login);

// ── Routes authentifiées ──────────────────────────────────────────────────────

// Déconnexion : détruit la session et efface le cookie
router.post("/logout",            authMiddleware,                                auth.logout);

// Retourne les informations de l'utilisateur connecté (rôle, nom, email)
router.get("/me",                 authMiddleware,                                auth.me);

// ── Routes réservées aux ADMIN ────────────────────────────────────────────────

// Consultation du journal d'audit (toutes les actions sensibles tracées)
router.get("/logs",               authMiddleware, requireAdmin,                  auth.getAuditLogs);

// Liste des modérateurs actifs
router.get("/moderateurs",        authMiddleware, requireAdmin,                  auth.getModerateurs);

// Création d'un nouveau compte modérateur
router.post("/moderateurs",       authMiddleware, requireAdmin, validateCreateUser, auth.createModerateur);

// Suppression d'un modérateur par son identifiant
router.delete("/moderateurs/:id", authMiddleware, requireAdmin, validateId(),    auth.deleteModerateur);

export default router;
