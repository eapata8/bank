/**
 * @fileoverview Contrôleur pour la gestion des factures et paiements.
 *
 * Ce module gère le cycle de vie des factures bancaires :
 *  - Consultation des factures (filtrée selon le rôle)
 *  - Consultation d'une facture spécifique
 *  - Création d'une facture (admin : pour n'importe quel client ; utilisateur : pour soi-même)
 *  - Paiement d'une facture via un compte bancaire
 *
 * Règles métier importantes :
 *  - Les MODERATEUR ne peuvent PAS créer ni payer de factures (requireNotModerator)
 *  - Les utilisateurs standards ne peuvent payer qu'avec un compte appartenant
 *    au même client que la facture
 *  - Le statut est forcé à IMPAYEE pour les créations par utilisateurs standards
 *
 * @module controllers/factures
 */

import {
  createFacture,
  executePayementFactureAtomique,
  findAccountForFacturePayment,
  findAuthorizedFactureById,
  findClientIdForUser,
  findFactureById,
  findFactures,
} from "../data/factures.data.js";
import { createAuditLog } from "../data/audit.data.js";
import { isElevated } from "../middlewares/auth.middleware.js";

/**
 * Retourne la liste des factures selon les droits de l'utilisateur.
 *
 * Admin/modérateur : toutes les factures, filtrables.
 * Utilisateur : uniquement les factures de ses propres clients.
 * Triées par priorité : IMPAYEE > A_VENIR > PAYEE, puis par date d'échéance.
 *
 * @async
 * @route GET /api/factures
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getFactures = async (req, res) => {
  try {
    const user = req.session.user;
    const rows = await findFactures({
      userId: user.id,
      canReadAll: isElevated(user),
      search: String(req.query?.search || "").trim(),
    });

    // Log d'audit pour les consultations globales (admin/modérateur)
    if (isElevated(user)) {
      await createAuditLog({
        utilisateurId: user.id,
        roleUtilisateur: user.role,
        action: "VIEW_GLOBAL_FACTURES",
        details: req.query?.search ? `Recherche: ${String(req.query.search).trim()}` : "Consultation globale des factures",
      });
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne les détails d'une facture par son identifiant.
 *
 * Logique de contrôle d'accès identique à getAccountById :
 *  - Admin/modérateur : accès direct
 *  - Utilisateur : vérification de l'appartenance au client
 *  - Si la facture existe mais pas accessible : 403
 *  - Si la facture n'existe pas : 404
 *
 * @async
 * @route GET /api/factures/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: facture } | 403 | 404 | 500
 */
export const getFactureById = async (req, res) => {
  try {
    const user = req.session.user;
    const factureId = Number(req.params.id);

    if (!factureId || factureId <= 0) {
      return res.status(400).json({ message: "id invalide" });
    }

    // Récupération avec ou sans contrôle d'accès selon le rôle
    const facture = isElevated(user)
      ? await findFactureById(factureId)
      : await findAuthorizedFactureById(user.id, factureId);

    if (!facture) {
      // Distinguer "facture inexistante (404)" de "accès non autorisé (403)"
      const existingFacture = await findFactureById(factureId);
      if (!existingFacture) {
        return res.status(404).json({ message: "Facture introuvable" });
      }
      return res.status(403).json({ message: "Acces refuse" });
    }

    return res.json({ data: facture });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée une nouvelle facture.
 *
 * Admin : peut créer une facture pour n'importe quel client avec n'importe quel statut initial.
 * Utilisateur : la facture est créée pour son propre client, statut forcé à IMPAYEE.
 * Modérateur : accès refusé par le middleware requireNotModerator.
 *
 * @async
 * @route POST /api/factures
 * @param {import("express").Request}  req - Corps : { client_id?, fournisseur, reference_facture, description?, montant, date_emission, date_echeance, statut? }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 403 | 500
 */
export const createFactureItem = async (req, res) => {
  try {
    const user = req.session.user;
    const {
      client_id,
      fournisseur,
      reference_facture,
      description,
      montant,
      date_emission,
      date_echeance,
      statut,
    } = req.body;

    const montantValue = Number(montant);

    if (user.role === "MODERATEUR") {
      return res.status(403).json({ message: "Acces refuse" });
    }

    // Détermination du client_id selon le rôle :
    // Admin fournit explicitement le client_id
    // Utilisateur standard : client_id déduit de son propre compte
    let clientId;
    if (user.role === "ADMIN") {
      if (!client_id) return res.status(400).json({ message: "Champs manquants" });
      clientId = Number(client_id);
    } else {
      // Récupération automatique du client associé à cet utilisateur
      clientId = await findClientIdForUser(user.id);
      if (!clientId) return res.status(403).json({ message: "Aucun client associe a cet utilisateur" });
    }

    if (!fournisseur || !reference_facture || !date_emission || !date_echeance) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (isNaN(montantValue) || montantValue <= 0) {
      return res.status(400).json({ message: "Le montant doit etre positif" });
    }

    // Sécurité : les utilisateurs standards ne peuvent créer que des factures IMPAYEE
    // (pas de statut A_VENIR — réservé aux admins pour planifier des factures futures)
    const safeStatut = user.role === "ADMIN" ? (statut || "A_VENIR") : "IMPAYEE";

    if (!["A_VENIR", "IMPAYEE"].includes(safeStatut)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const result = await createFacture({
      clientId,
      fournisseur,
      referenceFacture: reference_facture,
      description,
      montant: montantValue,
      dateEmission: date_emission,
      dateEcheance: date_echeance,
      statut: safeStatut,
    });

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "CREATE_FACTURE",
      details: `Facture #${result.insertId} creee pour client ${clientId} (${fournisseur})`,
    });

    return res.status(201).json({ message: "Facture creee", id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Paie une facture en débitant un compte bancaire.
 *
 * Séquence :
 *  1. Récupération et autorisation de la facture
 *  2. Vérification que la facture n'est pas déjà payée
 *  3. Validation du compte de paiement (appartient au bon client, solde suffisant)
 *  4. Débit du compte
 *  5. Marquage de la facture comme payée
 *  6. Création de la transaction de paiement
 *  7. Log d'audit
 *
 * @async
 * @route POST /api/factures/:id/payer
 * @param {import("express").Request}  req - Params : { id } | Corps : { compte_id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 403 | 404 | 500
 */
export const payFactureById = async (req, res) => {
  try {
    const user = req.session.user;

    if (user.role === "MODERATEUR") {
      return res.status(403).json({ message: "Acces refuse" });
    }

    const factureId = Number(req.params.id);
    const compteId = Number(req.body.compte_id);

    if (!factureId || factureId <= 0 || !compteId || compteId <= 0) {
      return res.status(400).json({ message: "Facture ou compte invalide" });
    }

    const canReadAllUser = isElevated(user);

    // Récupération de la facture avec contrôle d'accès
    const facture = canReadAllUser
      ? await findFactureById(factureId)
      : await findAuthorizedFactureById(user.id, factureId);

    if (!facture) {
      const existingFacture = await findFactureById(factureId);
      if (!existingFacture) {
        return res.status(404).json({ message: "Facture introuvable" });
      }
      return res.status(403).json({ message: "Acces refuse" });
    }

    // Vérification que la facture n'a pas encore été payée
    if (facture.statut === "PAYEE") {
      return res.status(400).json({ message: "La facture est deja payee" });
    }

    // Validation du compte de paiement :
    // Le compte doit appartenir au client de la facture (pas un compte d'un autre client)
    const account = await findAccountForFacturePayment({
      userId: user.id,
      factureClientId: facture.client_id,
      compteId,
      canReadAll: user.role === "ADMIN",
    });

    if (!account) {
      return res.status(403).json({ message: "Compte non autorise pour cette facture" });
    }

    // Vérification du solde suffisant avant le débit
    if (Number(account.solde) < Number(facture.montant)) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // Paiement atomique : débit, marquage payée et transaction en une opération
    await executePayementFactureAtomique({
      factureId,
      compteId,
      montant:    Number(facture.montant),
      fournisseur: facture.fournisseur,
    });

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "PAY_FACTURE",
      details: `Facture #${factureId} payee via compte ${compteId}`,
    });

    return res.json({ message: "Facture payee avec succes", id: factureId });
  } catch (err) {
    if (err.code === "SOLDE_INSUFFISANT") {
      return res.status(400).json({ message: "Solde insuffisant" });
    }
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default { getFactures, getFactureById, createFactureItem, payFactureById };
