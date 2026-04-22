/**
 * @fileoverview Contrôleur pour la gestion des demandes de produits financiers.
 *
 * Ce module gère le cycle de vie des demandes de produits :
 *  - Consultation selon le rôle (client : ses demandes, admin/modérateur : toutes)
 *  - Soumission d'une demande par un client (ou admin)
 *  - Prévention des doublons EN_ATTENTE pour le même produit
 *  - Approbation par admin/modérateur → produit auto-créé (carte ou compte)
 *  - Refus par admin/modérateur
 *
 * @module controllers/demandes_produits
 */

import * as repo from "../data/demandes_produits.data.js";
import { createAuditLog } from "../data/audit.data.js";

/**
 * Retourne la liste des demandes selon les droits de l'utilisateur.
 *
 * Admin/modérateur : toutes les demandes (avec infos client enrichies).
 * Utilisateur : uniquement les demandes de ses propres clients.
 *
 * @async
 * @route GET /api/demandes-produits
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getDemandes = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const canReadAll = role === "ADMIN" || role === "MODERATEUR";

  try {
    const demandes = await repo.findAllDemandes({ userId, canReadAll });
    res.json({ data: demandes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de la récupération des demandes" });
  }
};

/**
 * Retourne les détails d'une demande spécifique.
 *
 * @async
 * @route GET /api/demandes-produits/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: demande } | 404 | 500
 */
export const getDemandeById = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  try {
    const demande = await repo.findDemandeById(id);
    if (!demande) return res.status(404).json({ message: "Demande introuvable" });
    res.json({ data: demande });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Soumet une nouvelle demande de produit financier.
 *
 * Retourne 409 si une demande EN_ATTENTE existe déjà pour le même client
 * et le même type de produit.
 *
 * @async
 * @route POST /api/demandes-produits
 * @param {import("express").Request}  req - Corps : { type_produit, notes?, limite_credit? }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 409 | 500
 */
export const createDemande = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const { type_produit, notes, limite_credit } = req.body;

  try {
    // Récupérer le client_id associé à cet utilisateur
    // Pour les admins qui n'ont pas de client associé, on refuse la création
    const { default: db } = await import("../db.js");
    const [clientRows] = await db.query(
      `SELECT client_id FROM utilisateurs_clients WHERE utilisateur_id = ? LIMIT 1`,
      [userId]
    );

    if (!clientRows.length) {
      return res.status(403).json({ message: "Aucun profil client associé à ce compte" });
    }

    const client_id = clientRows[0].client_id;

    // Vérification doublon EN_ATTENTE
    const hasPending = await repo.hasPendingDemande(client_id, type_produit);
    if (hasPending) {
      return res.status(409).json({
        message: `Une demande EN_ATTENTE existe déjà pour ${type_produit}`,
      });
    }

    const limite = limite_credit ? Number(limite_credit) : null;
    const id = await repo.createDemande({
      client_id,
      type_produit,
      notes: notes?.trim() ?? null,
      limite_credit: limite,
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "CREATE_DEMANDE_PRODUIT",
      details: `Demande #${id} — ${type_produit}`,
    });

    // Auto-validation : si activée pour cet utilisateur, approuver immédiatement
    // et provisionner le produit (carte ou compte) sans passer par la modération.
    const autoVal = await repo.findUserAutoValidation(userId);
    if (autoVal) {
      const demande = {
        client_id,
        type_produit,
        limite_credit: limite,
      };
      await repo.approuverDemande(id, userId, demande);
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: role,
        action: "APPROUVER_DEMANDE_PRODUIT",
        details: `Demande #${id} (${type_produit}) auto-approuvée (auto_validation) — produit créé pour client #${client_id}`,
      });
      return res.status(201).json({
        message: `Demande approuvée automatiquement — ${type_produit} créé avec succès`,
        id,
        auto_valide: true,
      });
    }

    res.status(201).json({ message: "Demande soumise avec succès", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de la soumission de la demande" });
  }
};

/**
 * Approuve une demande en attente et crée le produit correspondant.
 *
 * Pour une carte : insère dans cartes_credit.
 * Pour un compte : insère dans comptes.
 * L'opération est atomique (transaction DB).
 *
 * @async
 * @route PATCH /api/demandes-produits/:id/approuver
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const approuverDemande = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  try {
    const demande = await repo.findDemandeById(id);
    if (!demande) return res.status(404).json({ message: "Demande introuvable" });

    if (demande.statut !== "EN_ATTENTE") {
      return res.status(400).json({
        message: `Impossible d'approuver une demande avec le statut ${demande.statut}`,
      });
    }

    await repo.approuverDemande(id, userId, demande);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "APPROUVER_DEMANDE_PRODUIT",
      details: `Demande #${id} (${demande.type_produit}) approuvée — produit créé pour client #${demande.client_id}`,
    });

    res.json({ message: `Demande approuvée — ${demande.type_produit} créé avec succès`, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de l'approbation" });
  }
};

/**
 * Annule une demande EN_ATTENTE. Réservé au propriétaire (ou admin/modérateur).
 *
 * @async
 * @route DELETE /api/demandes-produits/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 403 | 404 | 500
 */
export const annulerDemande = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });

  const canManageAll = role === "ADMIN" || role === "MODERATEUR";

  try {
    const demande = await repo.findDemandeById(id);
    if (!demande) return res.status(404).json({ message: "Demande introuvable" });

    if (demande.statut !== "EN_ATTENTE") {
      return res.status(400).json({
        message: `Impossible d'annuler une demande avec le statut ${demande.statut}`,
      });
    }

    if (!canManageAll) {
      const isOwner = await repo.isDemandeOwner(id, userId);
      if (!isOwner) {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé à annuler cette demande" });
      }
    }

    const deleted = await repo.annulerDemande(id);
    if (deleted === 0) {
      return res.status(400).json({ message: "La demande ne peut plus être annulée" });
    }

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "ANNULER_DEMANDE_PRODUIT",
      details: `Demande #${id} (${demande.type_produit}) annulée`,
    });

    res.json({ message: "Demande annulée", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors de l'annulation" });
  }
};

/**
 * Refuse une demande en attente.
 *
 * @async
 * @route PATCH /api/demandes-produits/:id/refuser
 * @param {import("express").Request}  req - Params : { id } | Corps : { notes? }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const refuserDemande = async (req, res) => {
  const { id: userId, role } = req.session.user;
  const id = Number(req.params.id);
  if (!id || id <= 0) return res.status(400).json({ message: "Identifiant invalide" });
  const { notes } = req.body;

  try {
    const demande = await repo.findDemandeById(id);
    if (!demande) return res.status(404).json({ message: "Demande introuvable" });

    if (demande.statut !== "EN_ATTENTE") {
      return res.status(400).json({
        message: `Impossible de refuser une demande avec le statut ${demande.statut}`,
      });
    }

    await repo.refuserDemande(id, userId, notes?.trim() ?? null);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: role,
      action: "REFUSER_DEMANDE_PRODUIT",
      details: `Demande #${id} (${demande.type_produit}) refusée${notes ? ` — ${notes}` : ""}`,
    });

    res.json({ message: "Demande refusée", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur lors du refus" });
  }
};
