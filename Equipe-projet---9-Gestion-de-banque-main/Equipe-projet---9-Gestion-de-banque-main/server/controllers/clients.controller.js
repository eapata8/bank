/**
 * @fileoverview Contrôleur pour la gestion des clients bancaires.
 *
 * Ce module expose les handlers Express pour les opérations CRUD sur les clients :
 *  - Lister les clients accessibles (tous pour admin/modérateur, les siens pour utilisateur)
 *  - Consulter les comptes d'un client
 *  - Créer un nouveau client et l'associer optionnellement à un utilisateur
 *  - Obtenir toutes les opérations d'un client (comptes, virements, dépôts, etc.)
 *
 * @module controllers/clients
 */

import {
  findAccountsByClientId,
  findAccountsByUserIdAndClientId,
  findAllClients,
  findClientsByUserId,
  findClientByEmailFictif,
  findUserById,
  createClient as createClientRecord,
  linkClientToUser,
} from "../data/clients.data.js";
import { updateAutoValidation } from "../data/admin.data.js";
import {
  findClientById,
  findClientCartes,
  findClientComptes,
  findClientDepots,
  findClientFactures,
  findClientRetraits,
  findClientVirements,
} from "../data/admin.clients.data.js";
import { createAuditLog } from "../data/audit.data.js";
import { captureSnapshot } from "../data/simulation.data.js";
import { isElevated } from "../middlewares/auth.middleware.js";

/**
 * Retourne la liste des clients accessibles à l'utilisateur connecté.
 *
 * - ADMIN/MODERATEUR : tous les clients de la banque (avec filtre de recherche optionnel)
 * - UTILISATEUR : uniquement ses propres clients (assignés via utilisateurs_clients)
 *
 * Un log d'audit est enregistré uniquement pour les accès globaux (admin/modérateur).
 *
 * @async
 * @route GET /api/clients
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getMyClients = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user.id;
    const search = String(req.query?.search || "").trim();

    // Choix de la requête selon le niveau d'accès
    const rows = isElevated(user)
      ? await findAllClients(search)          // Admin/modérateur : tous les clients
      : await findClientsByUserId(userId);    // Utilisateur : ses clients uniquement

    // Audit de la consultation globale (admin/modérateur seulement)
    if (isElevated(user)) {
      await createAuditLog({
        utilisateurId: user.id,
        roleUtilisateur: user.role,
        action: "VIEW_GLOBAL_CLIENTS",
        details: search ? `Recherche: ${search}` : "Consultation globale des clients",
      });
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne les comptes bancaires d'un client spécifique.
 *
 * Pour un utilisateur standard, vérifie que le client lui appartient
 * avant de retourner ses comptes. Un admin/modérateur peut accéder
 * aux comptes de n'importe quel client directement.
 *
 * @async
 * @route GET /api/clients/:clientId/comptes
 * @param {import("express").Request}  req - Params : { clientId }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getClientAccounts = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user.id;
    const clientId = Number(req.params.clientId);
    if (!clientId || isNaN(clientId) || clientId <= 0) {
      return res.status(400).json({ message: "clientId invalide" });
    }

    // Admin/modérateur : accès direct au client par id
    // Utilisateur : vérification que le client lui appartient via utilisateurs_clients
    const rows = isElevated(user)
      ? await findAccountsByClientId(clientId)
      : await findAccountsByUserIdAndClientId(userId, clientId);

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée un nouveau client bancaire et l'associe optionnellement à un utilisateur.
 *
 * Réservé aux admin/modérateurs (requireElevated sur la route).
 * Si un utilisateur_id et un flag auto_validation sont fournis :
 *  - Le client est lié à cet utilisateur via utilisateurs_clients
 *  - Le flag auto_validation de l'utilisateur est mis à jour en conséquence
 *
 * @async
 * @route POST /api/clients
 * @param {import("express").Request}  req - Corps : { prenom, nom, email_fictif, ville?, utilisateur_id?, auto_validation? }
 * @param {import("express").Response} res - 201 { message, id } | 404 | 409 | 500
 */
export const createClient = async (req, res) => {
  try {
    const user = req.session.user;
    const { prenom, nom, email_fictif, ville, utilisateur_id, auto_validation } = req.body;
    if (!prenom || !nom || !email_fictif) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    // Vérification de l'unicité de l'email fictif (identifiant interne unique du client)
    const existing = await findClientByEmailFictif(email_fictif);
    if (existing) {
      return res.status(409).json({ message: "Un client avec cet email fictif existe deja" });
    }

    // Si un utilisateur doit être associé, vérifier qu'il existe bien
    if (utilisateur_id) {
      const userExists = await findUserById(Number(utilisateur_id));
      if (!userExists) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }
    }

    // Création du client en base de données (sans lien utilisateur encore)
    const clientId = await createClientRecord({
      prenom: prenom.trim(),
      nom: nom.trim(),
      emailFictif: email_fictif.trim(),
      ville: ville ? String(ville).trim() : null,
    });

    // Association optionnelle du client à un utilisateur
    if (utilisateur_id) {
      await linkClientToUser(clientId, Number(utilisateur_id));

      // Mise à jour du flag auto_validation si fourni dans la requête
      if (auto_validation !== undefined) {
        await updateAutoValidation(Number(utilisateur_id), !!auto_validation);
      }
    }

    // Traçabilité de la création du client
    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "CREATE_CLIENT",
      details: `Client cree: ${prenom} ${nom}`,
    });

    // Snapshot initial automatique — protège l'état vierge du nouveau client
    try {
      await captureSnapshot({
        nom:         "État initial (seed)",
        description: "Données initiales du client — état non supprimable",
        creePar:     user.id,
        clientId:    clientId,
        estInitial:  true,
      });
    } catch (snapErr) {
      // Non bloquant — le client est créé même si le snapshot échoue,
      // mais on doit logger ET tracer pour le diagnostic ultérieur.
      console.error(
        `[clients.controller] Échec création snapshot initial pour client #${clientId}:`,
        snapErr
      );
      try {
        await createAuditLog({
          utilisateurId: user.id,
          roleUtilisateur: user.role,
          action: "SNAPSHOT_INITIAL_ECHEC",
          details: `Échec snapshot initial client #${clientId} — ${snapErr.message}`,
        });
      } catch {
        // Si l'audit lui-même échoue, on a déjà loggé en console — ne pas casser la création.
      }
    }

    return res.status(201).json({ message: "Client cree avec succes", id: clientId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne un résumé complet de toutes les opérations d'un client.
 *
 * Récupère en parallèle (Promise.all) : comptes, virements, dépôts,
 * retraits, factures et cartes du client. Réservé aux admin/modérateurs.
 * Utilisé pour la vue détaillée d'un client dans l'interface d'administration.
 *
 * @async
 * @route GET /api/clients/:clientId/operations
 * @param {import("express").Request}  req - Params : { clientId }
 * @param {import("express").Response} res - 200 { client, comptes, virements, depots, retraits, factures, cartes } | 404 | 500
 */
export const getClientOperations = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === "UTILISATEUR") return res.status(403).json({ message: "Accès refusé" });
    const clientId = Number(req.params.clientId);
    if (!clientId || isNaN(clientId) || clientId <= 0) {
      return res.status(400).json({ message: "clientId invalide" });
    }

    // Vérification de l'existence du client avant de charger ses données
    const client = await findClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client introuvable" });
    }

    // Chargement parallèle de toutes les opérations pour optimiser les performances
    const [comptes, virements, depots, retraits, factures, cartes] = await Promise.all([
      findClientComptes(clientId),
      findClientVirements(clientId),
      findClientDepots(clientId),
      findClientRetraits(clientId),
      findClientFactures(clientId),
      findClientCartes(clientId),
    ]);

    return res.json({ client, comptes, virements, depots, retraits, factures, cartes });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default { getMyClients, getClientAccounts, createClient, getClientOperations };
