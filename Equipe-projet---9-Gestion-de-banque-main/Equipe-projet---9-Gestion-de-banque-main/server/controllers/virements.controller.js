/**
 * @fileoverview Contrôleur pour la gestion des virements bancaires.
 *
 * Ce module gère deux types de virements :
 *
 * 1. Virement interne (createVirement) :
 *    - Entre comptes identifiés par leur id dans le système
 *    - L'utilisateur doit posséder le compte source
 *    - Le compte destination doit aussi appartenir à l'utilisateur (sauf admin)
 *
 * 2. Virement externe (createVirementExterne) :
 *    - Vers un compte identifié par ses coordonnées bancaires complètes
 *      (numéro, institution, transit, SWIFT optionnel)
 *    - Utilisé pour envoyer vers d'autres banques ou vers un autre client de Leon Bank
 *      dont on connaît les coordonnées
 *
 * Les virements sont exécutés dans une transaction DB atomique (BEGIN/COMMIT/ROLLBACK)
 * pour garantir qu'un crash entre le débit et le crédit ne corrompt pas les soldes.
 *
 * @module controllers/virements
 */

import {
  executeVirementAtomique,
  findAccountByCoords,
  findAccountById,
  findAuthorizedDestinationAccount,
  findAuthorizedSourceAccount,
  findVirements,
} from "../data/virements.data.js";
import { createAuditLog } from "../data/audit.data.js";

/**
 * Retourne la liste des virements accessibles à l'utilisateur connecté.
 *
 * Admin/modérateur : tous les virements, avec filtre de recherche optionnel.
 * Utilisateur : uniquement les virements impliquant ses comptes.
 *
 * @async
 * @route GET /api/virements
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getVirements = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const search = String(req.query.search || "").trim();
    const isAdmin = userRole === "ADMIN" || userRole === "MODERATEUR";

    const rows = await findVirements({ userId, isAdmin, search });

    if (isAdmin) {
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: userRole,
        action: "VIEW_GLOBAL_VIREMENTS",
        details: search ? `Recherche: ${search}` : "Consultation globale des virements",
      });
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée un virement interne entre deux comptes identifiés par leur id.
 *
 * Toutes les opérations (débit, crédit, enregistrements) s'exécutent dans une
 * transaction DB atomique via executeVirementAtomique. Si le solde est insuffisant
 * au moment précis du débit (race condition), l'UPDATE atomique échoue et le
 * virement est annulé proprement.
 *
 * @async
 * @route POST /api/virements
 * @param {import("express").Request}  req - Corps : { compte_source_id, compte_destination_id, montant, description? }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 403 | 404 | 500
 */
export const createVirement = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { compte_source_id, compte_destination_id, montant, description } = req.body;
    const montantValue = Number(montant);
    const isAdmin = userRole === "ADMIN";

    if (!compte_source_id || !compte_destination_id || !montant) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (montantValue <= 0) {
      return res.status(400).json({ message: "Le montant doit etre positif" });
    }
    if (Number(compte_source_id) === Number(compte_destination_id)) {
      return res.status(400).json({ message: "Les comptes doivent etre differents" });
    }

    // Validation du compte source selon le rôle
    const sourceAccount = isAdmin
      ? await findAccountById(compte_source_id)
      : await findAuthorizedSourceAccount(userId, compte_source_id);

    if (!sourceAccount) {
      return isAdmin
        ? res.status(404).json({ message: "Compte source introuvable" })
        : res.status(403).json({ message: "Compte source non autorise" });
    }

    // Vérification préliminaire du solde (évite un aller-retour DB inutile)
    if (Number(sourceAccount.solde) < montantValue) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // Vérification de l'existence et de l'autorisation du compte destination
    const destAccount = await findAccountById(compte_destination_id);
    if (!destAccount) {
      return res.status(404).json({ message: "Compte destination inexistant" });
    }

    const authorizedDestAccount = isAdmin
      ? destAccount
      : await findAuthorizedDestinationAccount(userId, compte_destination_id);
    if (!authorizedDestAccount) {
      return res.status(403).json({ message: "Compte destination non autorise" });
    }

    // Exécution atomique : débit + crédit + virement + transactions dans une seule transaction DB
    const virementId = await executeVirementAtomique({
      compteSourceId: Number(compte_source_id),
      compteDestinationId: Number(compte_destination_id),
      montant: montantValue,
      description,
      typeLabel: "interne",
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "CREATE_VIREMENT",
      details: `Virement #${virementId} de ${compte_source_id} vers ${compte_destination_id} (${montantValue})`,
    });

    return res.status(201).json({ message: "Virement cree avec succes", id: virementId });
  } catch (err) {
    if (err.code === "SOLDE_INSUFFISANT") {
      return res.status(400).json({ message: "Solde insuffisant" });
    }
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée un virement externe vers un compte identifié par ses coordonnées bancaires.
 *
 * @async
 * @route POST /api/virements/externe
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 201 { message, id } | 400 | 403 | 404 | 500
 */
export const createVirementExterne = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const isAdmin = userRole === "ADMIN";
    const {
      compte_source_id,
      numero_compte_dest,
      numero_institution_dest,
      numero_transit_dest,
      swift_bic_dest,
      montant,
      description,
    } = req.body;
    const montantValue = Number(montant);

    if (!compte_source_id || !numero_compte_dest || !numero_institution_dest || !numero_transit_dest || !montant) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (montantValue <= 0) {
      return res.status(400).json({ message: "Le montant doit etre positif" });
    }

    const sourceAccount = isAdmin
      ? await findAccountById(compte_source_id)
      : await findAuthorizedSourceAccount(userId, compte_source_id);

    if (!sourceAccount) {
      return isAdmin
        ? res.status(404).json({ message: "Compte source introuvable" })
        : res.status(403).json({ message: "Compte source non autorise" });
    }

    if (Number(sourceAccount.solde) < montantValue) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    const destAccount = await findAccountByCoords({
      numeroCompte: numero_compte_dest,
      numeroInstitution: numero_institution_dest,
      numeroTransit: numero_transit_dest,
      swiftBic: swift_bic_dest || null,
    });

    if (!destAccount) {
      return res.status(404).json({ message: "Compte destinataire introuvable. Verifiez les coordonnees bancaires." });
    }

    if (destAccount.id === Number(compte_source_id)) {
      return res.status(400).json({ message: "Les comptes doivent etre differents" });
    }

    // Exécution atomique
    const virementId = await executeVirementAtomique({
      compteSourceId: Number(compte_source_id),
      compteDestinationId: destAccount.id,
      montant: montantValue,
      description,
      typeLabel: "externe",
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "CREATE_VIREMENT_EXTERNE",
      details: `Virement externe #${virementId} de ${compte_source_id} vers ${numero_compte_dest} (${montantValue})`,
    });

    return res.status(201).json({ message: "Virement externe effectue avec succes", id: virementId });
  } catch (err) {
    if (err.code === "SOLDE_INSUFFISANT") {
      return res.status(400).json({ message: "Solde insuffisant" });
    }
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default { getVirements, createVirement, createVirementExterne };
