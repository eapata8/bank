/**
 * @fileoverview Contrôleur pour la gestion des comptes bancaires.
 *
 * Ce module expose les handlers Express pour les opérations sur les comptes :
 *  - Lister les types de comptes disponibles
 *  - Lister les comptes accessibles à l'utilisateur connecté
 *  - Consulter un compte par son identifiant (avec contrôle d'accès)
 *  - Consulter les transactions d'un compte (avec contrôle d'accès)
 *  - Créer un nouveau compte pour un client
 *
 * Logique de contrôle d'accès :
 *  - ADMIN/MODERATEUR : accès à tous les comptes
 *  - UTILISATEUR : accès uniquement à ses propres comptes
 *    → Si le compte existe mais n'appartient pas à l'utilisateur : 403
 *    → Si le compte n'existe pas du tout : 404
 *
 * @module controllers/comptes
 */

import {
  findAccountById,
  findAllAccounts,
  findAnyAccountById,
  findAccountsByUserId,
  findOwnedAccountAccess,
  findOwnedAccountById,
  findTransactionsByAccountId,
  createCompte as createCompteRecord,
} from "../data/comptes.data.js";
import { findClientById } from "../data/clients.data.js";
import { createAuditLog } from "../data/audit.data.js";
import { isElevated } from "../middlewares/auth.middleware.js";

/**
 * Retourne la liste des types de comptes disponibles dans la banque.
 *
 * @route GET /api/comptes/types
 * @param {import("express").Request}  req - Aucun paramètre requis.
 * @param {import("express").Response} res - 200 { data: ["CHEQUES", "EPARGNE", "CREDIT"] }
 */
export const getAccountTypes = async (req, res) => {
  // Les types sont fixes et définis par la banque — pas besoin d'aller en base
  return res.json({ data: ["CHEQUES", "EPARGNE", "CREDIT"] });
};

/**
 * Retourne la liste des comptes accessibles à l'utilisateur connecté.
 *
 * - ADMIN/MODERATEUR : tous les comptes avec infos client, filtrables par recherche
 * - UTILISATEUR : uniquement ses comptes (via la jointure utilisateurs_clients)
 *
 * @async
 * @route GET /api/comptes
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getMyAccounts = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user.id;
    const search = String(req.query?.search || "").trim();

    // Requête différente selon le niveau d'accès
    const rows = isElevated(user)
      ? await findAllAccounts(search)         // Admin/modérateur : tous les comptes
      : await findAccountsByUserId(userId);   // Utilisateur : ses comptes uniquement

    // Log d'audit pour les consultations globales (admin/modérateur uniquement)
    if (isElevated(user)) {
      await createAuditLog({
        utilisateurId: user.id,
        roleUtilisateur: user.role,
        action: "VIEW_GLOBAL_ACCOUNTS",
        details: search ? `Recherche: ${search}` : "Consultation globale des comptes",
      });
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne les détails d'un compte par son identifiant.
 *
 * Logique de contrôle d'accès :
 *  1. Admin/modérateur → accès direct (findAnyAccountById)
 *  2. Utilisateur propriétaire → retourne le compte (findOwnedAccountById)
 *  3. Compte existant mais pas propriétaire → 403
 *  4. Compte inexistant → 404
 *
 * @async
 * @route GET /api/comptes/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: compte } | 403 | 404 | 500
 */
export const getAccountById = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user.id;
    const compteId = Number(req.params.id);

    if (!compteId || isNaN(compteId)) {
      return res.status(400).json({ message: "id invalide" });
    }

    // Admin/modérateur : accès direct sans vérification d'appartenance
    if (isElevated(user)) {
      const anyAccount = await findAnyAccountById(compteId);
      if (!anyAccount) {
        return res.status(404).json({ message: "Compte introuvable" });
      }
      return res.json({ data: anyAccount });
    }

    // Utilisateur standard : vérification que le compte lui appartient
    const ownedAccount = await findOwnedAccountById(userId, compteId);

    if (ownedAccount) {
      return res.json({ data: ownedAccount });
    }

    // Le compte ne lui appartient pas : distinguer 404 (inexistant) de 403 (non autorisé)
    const existingAccount = await findAccountById(compteId);
    if (!existingAccount) {
      return res.status(404).json({ message: "Compte introuvable" });
    }

    // Le compte existe mais l'utilisateur n'y a pas accès
    return res.status(403).json({ message: "Acces refuse" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne l'historique des transactions d'un compte.
 *
 * Même logique de contrôle d'accès que getAccountById :
 * admin/modérateur accède à tout, utilisateur standard uniquement à ses propres comptes.
 *
 * @async
 * @route GET /api/comptes/:id/transactions
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: [...] } | 403 | 404 | 500
 */
export const getAccountTransactions = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user.id;
    const compteId = Number(req.params.id);

    if (!compteId || isNaN(compteId)) {
      return res.status(400).json({ message: "id invalide" });
    }

    // Admin/modérateur : accès direct à toutes les transactions
    if (isElevated(user)) {
      const anyAccount = await findAccountById(compteId);
      if (!anyAccount) {
        return res.status(404).json({ message: "Compte introuvable" });
      }

      const rows = await findTransactionsByAccountId(compteId);
      return res.json({ data: rows });
    }

    // Utilisateur standard : vérification de l'accès au compte (version légère)
    const ownedAccountAccess = await findOwnedAccountAccess(userId, compteId);

    if (!ownedAccountAccess) {
      // Distinguer inexistant (404) de non autorisé (403)
      const existingAccount = await findAccountById(compteId);
      if (!existingAccount) {
        return res.status(404).json({ message: "Compte introuvable" });
      }
      return res.status(403).json({ message: "Acces refuse" });
    }

    // Accès autorisé : retourner les transactions
    const rows = await findTransactionsByAccountId(compteId);

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée un nouveau compte bancaire pour un client existant.
 *
 * Réservé aux admin/modérateurs (requireElevated sur la route).
 * Génère automatiquement :
 *  - Un numéro de compte unique au format canadien (XXXX XXXX XXXX)
 *  - Un numéro de transit aléatoire à 5 chiffres
 *  - L'institution bancaire fixée à "621" (Leon Bank)
 *  - Le code SWIFT : "NXBKCA2TXXX"
 *
 * @async
 * @route POST /api/comptes
 * @param {import("express").Request}  req - Corps : { client_id, type_compte, last_four? }
 * @param {import("express").Response} res - 201 { message, id } | 404 | 500
 */
export const createCompte = async (req, res) => {
  try {
    const user = req.session.user;
    const { client_id, type_compte, last_four } = req.body;
    const clientId = Number(client_id);

    if (!type_compte) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    const validTypes = ["CHEQUES", "EPARGNE", "CREDIT"];
    if (!validTypes.includes(type_compte)) {
      return res.status(400).json({ message: "Type de compte invalide" });
    }
    if (!clientId || clientId <= 0) {
      return res.status(400).json({ message: "client_id invalide" });
    }
    if (last_four !== undefined && !/^\d{4}$/.test(String(last_four))) {
      return res.status(400).json({ message: "last_four doit etre 4 chiffres" });
    }

    // Vérification que le client existe avant de créer son compte
    const client = await findClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client introuvable" });
    }

    // Les 4 derniers chiffres : fournis manuellement ou générés aléatoirement
    const digits = last_four ? String(last_four) : String(Math.floor(1000 + Math.random() * 9000));

    // Génération d'un numéro de compte réaliste à 12 chiffres (format canadien : XXXX XXXX XXXX)
    const g1 = String(Math.floor(1000 + Math.random() * 9000));
    const g2 = String(Math.floor(1000 + Math.random() * 9000));
    const numeroCompte = `${g1} ${g2} ${digits}`;

    // Numéro de transit aléatoire à 5 chiffres (identifiant de succursale bancaire canadien)
    const numeroTransit = String(Math.floor(10000 + Math.random() * 90000));

    const compteId = await createCompteRecord({
      clientId,
      typeCompte: type_compte,
      numeroCompte,
      numeroInstitution: "621",         // Code d'institution de Leon Bank
      numeroTransit,
      swiftBic: "NXBKCA2TXXX",         // Code SWIFT international de Leon Bank
      solde: 0,                         // Tous les nouveaux comptes démarrent à 0 CAD
      devise: "CAD",
    });

    // Traçabilité de la création du compte
    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "CREATE_COMPTE",
      details: `Compte ${type_compte} cree pour client ${clientId}`,
    });

    return res.status(201).json({ message: "Compte cree avec succes", id: compteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default { getAccountTypes, getMyAccounts, getAccountById, getAccountTransactions, createCompte };
