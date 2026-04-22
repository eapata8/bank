/**
 * @fileoverview Contrôleur pour la gestion des dépôts par chèque.
 *
 * Ce module gère le cycle de vie complet des dépôts :
 *  - Soumission d'un dépôt par un utilisateur (avec photo du chèque)
 *  - Approbation par un admin/modérateur → solde crédité
 *  - Rejet par un admin/modérateur → aucun crédit
 *  - Auto-validation : si activée, approbation immédiate à la soumission
 *
 * Les modérateurs ne peuvent PAS soumettre de dépôts (requireNotModerator sur POST).
 * Seuls admin/modérateurs peuvent approuver ou rejeter (requireElevated sur PATCH).
 *
 * @module controllers/depots
 */

import * as repo from "../data/depots.data.js";
// executeApprouvementDepotAtomique est inclus dans repo via import *
import { createAuditLog } from "../data/audit.data.js";

/**
 * Retourne la liste des dépôts selon les droits de l'utilisateur.
 *
 * Admin/modérateur : tous les dépôts de la banque, filtrables.
 * Utilisateur : uniquement les dépôts de ses clients.
 *
 * @async
 * @route GET /api/depots
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getDepots = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const canReadAll = role === "ADMIN" || role === "MODERATEUR";
  const search = req.query.search?.trim() || "";

  try {
    const depots = await repo.findDepots({ userId, canReadAll, search });

    // Log d'audit pour les consultations globales (admin/modérateur)
    if (canReadAll) {
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: role,
        action: "VIEW_GLOBAL_DEPOTS",
        details: search ? `Recherche: ${search}` : null,
      });
    }

    res.json({ data: depots });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de la récupération des dépôts" });
  }
};

/**
 * Retourne les détails d'un dépôt spécifique par son identifiant.
 *
 * @async
 * @route GET /api/depots/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: depot } | 404 | 500
 */
export const getDepotById = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  try {
    const depot = await repo.findDepotById(id);
    if (!depot) return res.status(404).json({ message: "Dépôt introuvable" });
    res.json({ data: depot });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Soumet une nouvelle demande de dépôt par chèque.
 *
 * Le fichier image du chèque doit avoir été uploadé par le middleware
 * uploadCheque avant que ce handler soit appelé (req.file est disponible).
 *
 * Si l'auto-validation est activée pour cet utilisateur, le dépôt est
 * approuvé immédiatement et le solde est crédité sans attente de modération.
 *
 * @async
 * @route POST /api/depots
 * @param {import("express").Request}  req - Corps (multipart/form-data) : { compte_id, montant, numero_cheque, banque_emettrice } + req.file (photo_cheque)
 * @param {import("express").Response} res - 201 { message, id, auto_valide? } | 403 | 500
 */
export const createDepot = async (req, res) => {
  const { id: userId, role } = req.session.user;

  if (role === "MODERATEUR") return res.status(403).json({ message: "Accès refusé" });

  const { compte_id, montant, numero_cheque, banque_emettrice } = req.body;
  const montantNum = Number(montant);

  if (!compte_id || !montant || !numero_cheque || !banque_emettrice) {
    return res.status(400).json({ message: "Champs manquants" });
  }
  if (montantNum <= 0 || isNaN(montantNum)) {
    return res.status(400).json({ message: "Montant invalide" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "La photo du chèque est requise" });
  }

  try {
    // Validation du compte selon le rôle :
    // Admin peut déposer sur n'importe quel compte CHEQUES/EPARGNE actif
    // Utilisateur ne peut déposer que sur ses propres comptes éligibles
    let compte;
    if (role === "ADMIN") {
      compte = await repo.findCompteForDepotAdmin(Number(compte_id));
    } else {
      compte = await repo.findCompteForDepot(Number(compte_id), userId);
    }

    if (!compte) {
      return res.status(403).json({ message: "Compte introuvable ou non autorisé (doit être CHEQUES ou EPARGNE actif)" });
    }

    // Création de la demande de dépôt avec statut EN_ATTENTE
    const id = await repo.createDepot({
      compte_id: compte.id,
      client_id: compte.client_id,
      montant: montantNum,
      numero_cheque: numero_cheque.trim(),
      banque_emettrice: banque_emettrice.trim(),
      fichier_chemin: req.file.filename, // Nom du fichier uploadé par le middleware Multer
    });

    // Auto-validation : si activée pour cet utilisateur, approuver immédiatement
    // sans passer par la file de modération
    const autoVal = await repo.findUserAutoValidation(userId);
    if (autoVal) {
      await repo.executeApprouvementDepotAtomique(id, userId, compte.id, montantNum, numero_cheque.trim());
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: role,
        action: "APPROUVER_DEPOT",
        details: `Dépôt #${id} auto-approuvé (auto_validation) — chèque ${numero_cheque.trim()} de ${montantNum} CAD`,
      });
      return res.status(201).json({ message: "Dépôt approuvé automatiquement", id, auto_valide: true });
    }

    // Sans auto-validation : le dépôt attend la modération
    res.status(201).json({ message: "Dépôt soumis avec succès", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de la soumission du dépôt" });
  }
};

/**
 * Approuve un dépôt en attente et crédite le solde du compte.
 *
 * Séquence :
 *  1. Vérification que le dépôt est EN_ATTENTE (pas déjà approuvé/rejeté)
 *  2. Approbation du dépôt (statut → APPROUVE)
 *  3. Crédit du solde du compte
 *  4. Création de la transaction dans l'historique
 *  5. Log d'audit
 *
 * @async
 * @route PATCH /api/depots/:id/approuver
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const approuverDepot = async (req, res) => {
  const { id: userId, role } = req.session.user;
  if (role === "UTILISATEUR") return res.status(403).json({ message: "Accès refusé" });
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  try {
    const depot = await repo.findDepotById(id);
    if (!depot) return res.status(404).json({ message: "Dépôt introuvable" });

    // Vérification du statut : on ne peut approuver qu'un dépôt EN_ATTENTE
    if (depot.statut !== "EN_ATTENTE") {
      return res.status(400).json({ message: `Impossible d'approuver un dépôt ayant le statut ${depot.statut}` });
    }

    // Approbation atomique : statut, crédit et transaction en une seule opération DB
    await repo.executeApprouvementDepotAtomique(id, userId, depot.compte_id, depot.montant, depot.numero_cheque);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "APPROUVER_DEPOT",
      details: `Dépôt #${id} approuvé — chèque ${depot.numero_cheque} de ${depot.montant} CAD`,
    });

    res.json({ message: "Dépôt approuvé avec succès", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de l'approbation" });
  }
};

/**
 * Rejette un dépôt en attente avec un motif optionnel.
 *
 * Le rejet ne crédite PAS le compte (aucun mouvement de fonds).
 * Un motif de rejet peut être fourni pour informer le client.
 *
 * @async
 * @route PATCH /api/depots/:id/rejeter
 * @param {import("express").Request}  req - Params : { id } | Corps : { notes? }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const rejeterDepot = async (req, res) => {
  const { id: userId, role } = req.session.user;
  if (role === "UTILISATEUR") return res.status(403).json({ message: "Accès refusé" });
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });
  const { notes } = req.body;

  try {
    const depot = await repo.findDepotById(id);
    if (!depot) return res.status(404).json({ message: "Dépôt introuvable" });

    // Vérification du statut : on ne peut rejeter qu'un dépôt EN_ATTENTE
    if (depot.statut !== "EN_ATTENTE") {
      return res.status(400).json({ message: `Impossible de rejeter un dépôt ayant le statut ${depot.statut}` });
    }

    await repo.rejeterDepot(id, userId, notes);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "REJETER_DEPOT",
      details: `Dépôt #${id} rejeté — chèque ${depot.numero_cheque}${notes ? ` — ${notes}` : ""}`,
    });

    res.json({ message: "Dépôt rejeté", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors du rejet" });
  }
};
