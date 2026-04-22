/**
 * @fileoverview Contrôleur pour la gestion des retraits en espèces.
 *
 * Ce module gère le cycle de vie des retraits en espèces :
 *  - Soumission d'une demande par un utilisateur
 *  - Approbation par admin/modérateur → solde débité, argent remis au client
 *  - Rejet par admin/modérateur → aucun débit
 *  - Auto-validation : si activée, approbation et débit immédiats
 *
 * Important : contrairement aux dépôts, le solde n'est pas bloqué à la soumission.
 * Il est débité uniquement lors de l'approbation. En théorie, entre la soumission
 * et l'approbation, le client pourrait faire baisser son solde sous le montant demandé.
 *
 * @module controllers/retraits
 */

import * as repo from "../data/retraits.data.js";
import { createAuditLog } from "../data/audit.data.js";

/**
 * Retourne la liste des retraits selon les droits de l'utilisateur.
 *
 * Admin/modérateur : tous les retraits, filtrables.
 * Utilisateur : uniquement les retraits de ses propres clients.
 *
 * @async
 * @route GET /api/retraits
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getRetraits = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const canReadAll = role === "ADMIN" || role === "MODERATEUR";
  const search = req.query.search?.trim() || "";

  try {
    const retraits = await repo.findRetraits({ userId, canReadAll, search });

    // Log d'audit pour les consultations globales
    if (canReadAll) {
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: role,
        action: "VIEW_GLOBAL_RETRAITS",
        details: search ? `Recherche: ${search}` : null,
      });
    }

    res.json({ data: retraits });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de la récupération des retraits" });
  }
};

/**
 * Retourne les détails d'un retrait spécifique par son identifiant.
 *
 * @async
 * @route GET /api/retraits/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: retrait } | 404 | 500
 */
export const getRetraitById = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  try {
    const retrait = await repo.findRetraitById(id);
    if (!retrait) return res.status(404).json({ message: "Retrait introuvable" });
    res.json({ data: retrait });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Soumet une nouvelle demande de retrait en espèces.
 *
 * Valide le compte (type CHEQUES/EPARGNE, actif, appartenant à l'utilisateur)
 * et vérifie le solde suffisant avant de créer la demande.
 *
 * Si l'auto-validation est activée pour cet utilisateur, le retrait est
 * traité immédiatement : solde débité et transaction créée.
 *
 * @async
 * @route POST /api/retraits
 * @param {import("express").Request}  req - Corps : { compte_id, montant, description? }
 * @param {import("express").Response} res - 201 { message, id, auto_valide? } | 400 | 403 | 500
 */
export const createRetrait = async (req, res) => {
  const { id: userId, role } = req.session.user;

  if (role === "MODERATEUR") return res.status(403).json({ message: "Accès refusé" });

  const { compte_id, montant, description } = req.body;
  if (!compte_id || montant === undefined || montant === null || montant === "") {
    return res.status(400).json({ message: "Les champs compte_id et montant sont requis" });
  }
  const montantNum = Number(montant);
  if (montantNum <= 0 || isNaN(montantNum)) {
    return res.status(400).json({ message: "Montant invalide" });
  }
  if (montantNum > 1000) {
    return res.status(400).json({ message: "Le montant ne peut pas dépasser 1000 CAD" });
  }

  try {
    // Validation du compte selon le rôle
    let compte;
    if (role === "ADMIN") {
      compte = await repo.findCompteForRetraitAdmin(Number(compte_id));
    } else {
      compte = await repo.findCompteForRetrait(Number(compte_id), userId);
    }

    if (!compte) {
      return res.status(403).json({ message: "Compte introuvable ou non autorisé (doit être CHEQUES ou EPARGNE actif)" });
    }

    // Vérification du solde suffisant au moment de la demande
    if (compte.solde < montantNum) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // Création de la demande de retrait (statut EN_ATTENTE, solde non encore débité)
    const id = await repo.createRetrait({
      compte_id: compte.id,
      client_id: compte.client_id,
      montant: montantNum,
      description: description?.trim(),
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "CREATE_RETRAIT",
      details: `Demande de retrait #${id} de ${montantNum} CAD`,
    });

    // Auto-validation : traitement immédiat si activé pour cet utilisateur
    const autoVal = await repo.findUserAutoValidation(userId);
    if (autoVal) {
      await repo.executeApprouvementRetraitAtomique(id, userId, compte.id, montantNum, description?.trim());
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: role,
        action: "APPROUVER_RETRAIT",
        details: `Retrait #${id} auto-approuvé (auto_validation) — ${montantNum} CAD`,
      });
      return res.status(201).json({ message: "Retrait approuvé automatiquement", id, auto_valide: true });
    }

    // Sans auto-validation : le retrait attend la modération
    res.status(201).json({ message: "Demande de retrait soumise avec succès", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de la soumission du retrait" });
  }
};

/**
 * Approuve un retrait en attente et débite le solde du compte.
 *
 * Séquence :
 *  1. Vérification que le retrait est EN_ATTENTE
 *  2. Approbation du retrait (statut → APPROUVE)
 *  3. Débit du solde du compte
 *  4. Création de la transaction dans l'historique
 *  5. Log d'audit
 *
 * Note : l'argent doit être remis physiquement au client par l'agent.
 *
 * @async
 * @route PATCH /api/retraits/:id/approuver
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const approuverRetrait = async (req, res) => {
  const { id: userId, role } = req.session.user;
  if (role === "UTILISATEUR") return res.status(403).json({ message: "Accès refusé" });
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  try {
    const retrait = await repo.findRetraitById(id);
    if (!retrait) return res.status(404).json({ message: "Retrait introuvable" });

    // Vérification du statut : ne peut approuver qu'un retrait EN_ATTENTE
    if (retrait.statut !== "EN_ATTENTE") {
      return res.status(400).json({ message: `Impossible d'approuver un retrait ayant le statut ${retrait.statut}` });
    }

    // Approbation atomique avec débit protégé (race condition sur le solde)
    await repo.executeApprouvementRetraitAtomique(id, userId, retrait.compte_id, retrait.montant, retrait.description);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "APPROUVER_RETRAIT",
      details: `Retrait #${id} approuvé — ${retrait.montant} CAD remis en espèces`,
    });

    // Le message rappelle à l'agent de remettre physiquement l'argent au client
    res.json({ message: "Retrait approuvé avec succès — remettez l'argent au client", id });
  } catch (e) {
    if (e.code === "SOLDE_INSUFFISANT") {
      return res.status(400).json({ message: "Solde insuffisant au moment de l'approbation" });
    }
    console.error(e);
    res.status(500).json({ message: "Erreur lors de l'approbation" });
  }
};

/**
 * Rejette un retrait en attente.
 *
 * Le rejet ne débite PAS le compte (aucun mouvement de fonds).
 *
 * @async
 * @route PATCH /api/retraits/:id/rejeter
 * @param {import("express").Request}  req - Params : { id } | Corps : { notes? }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const rejeterRetrait = async (req, res) => {
  const { id: userId, role } = req.session.user;
  if (role === "UTILISATEUR") return res.status(403).json({ message: "Accès refusé" });
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });
  const { notes } = req.body;

  try {
    const retrait = await repo.findRetraitById(id);
    if (!retrait) return res.status(404).json({ message: "Retrait introuvable" });

    // Vérification du statut : ne peut rejeter qu'un retrait EN_ATTENTE
    if (retrait.statut !== "EN_ATTENTE") {
      return res.status(400).json({ message: `Impossible de rejeter un retrait ayant le statut ${retrait.statut}` });
    }

    await repo.rejeterRetrait(id, userId, notes);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "REJETER_RETRAIT",
      details: `Retrait #${id} rejeté${notes ? ` — ${notes}` : ""}`,
    });

    res.json({ message: "Retrait rejeté", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors du rejet" });
  }
};
