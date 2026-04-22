/**
 * @fileoverview Contrôleur pour la gestion des bénéficiaires Interac.
 *
 * Un bénéficiaire est un destinataire fréquent enregistré par l'utilisateur
 * (alias + courriel). Il peut être sélectionné dans le formulaire d'envoi
 * Interac pour pré-remplir l'adresse courriel automatiquement.
 *
 * @module controllers/beneficiaires
 */

import {
  findBeneficiaires,
  findBeneficiaireById,
  createBeneficiaire as dbCreateBeneficiaire,
  deleteBeneficiaire as dbDeleteBeneficiaire,
  emailExistsDansLeSysteme,
} from "../data/beneficiaires.data.js";
import { createAuditLog } from "../data/audit.data.js";

/** Regex email minimaliste — couvre les cas courants sans sur-valider. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Retourne la liste des bénéficiaires de l'utilisateur connecté.
 *
 * @async
 * @route GET /api/beneficiaires
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getBeneficiaires = async (req, res) => {
  try {
    const rows = await findBeneficiaires(req.session.user.id);
    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Ajoute un nouveau bénéficiaire pour l'utilisateur connecté.
 *
 * Validations :
 *  - `alias` obligatoire, max 100 caractères
 *  - `email_interac` obligatoire, format email valide
 *  - Doublon (même courriel) → 409
 *
 * @async
 * @route POST /api/beneficiaires
 * @param {import("express").Request}  req - Corps : { alias, email_interac }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 409 | 500
 */
export const createBeneficiaire = async (req, res) => {
  try {
    const userId   = req.session.user.id;
    const userRole = req.session.user.role;
    const { alias, email_interac } = req.body;

    if (!alias || !String(alias).trim()) {
      return res.status(400).json({ message: "L'alias est obligatoire" });
    }
    if (String(alias).trim().length > 100) {
      return res.status(400).json({ message: "L'alias ne peut pas dépasser 100 caractères" });
    }
    if (!email_interac || !String(email_interac).trim()) {
      return res.status(400).json({ message: "Le courriel est obligatoire" });
    }
    if (!EMAIL_RE.test(String(email_interac).trim())) {
      return res.status(400).json({ message: "Format de courriel invalide" });
    }

    const emailNormalise = String(email_interac).trim().toLowerCase();

    // Vérifier que le courriel correspond à un utilisateur enregistré dans le système
    const existe = await emailExistsDansLeSysteme(emailNormalise);
    if (!existe) {
      return res.status(404).json({
        message: "Aucun utilisateur enregistré avec ce courriel Interac dans notre système",
      });
    }

    let result;
    try {
      result = await dbCreateBeneficiaire({
        utilisateurId: userId,
        alias:         String(alias).trim(),
        emailInterac:  emailNormalise,
      });
    } catch (dbErr) {
      // Erreur MySQL 1062 : violation de la contrainte UNIQUE (utilisateur_id, email_interac)
      if (dbErr.errno === 1062) {
        return res.status(409).json({ message: "Ce courriel est déjà dans vos bénéficiaires" });
      }
      throw dbErr;
    }

    await createAuditLog({
      utilisateurId:  userId,
      roleUtilisateur: userRole,
      action:         "BENEFICIAIRE_AJOUTE",
      details:        `Bénéficiaire #${result.insertId} — ${alias.trim()} <${emailNormalise}>`,
    });

    return res.status(201).json({ message: "Bénéficiaire ajouté avec succès", id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Supprime un bénéficiaire appartenant à l'utilisateur connecté.
 *
 * @async
 * @route DELETE /api/beneficiaires/:id
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 | 403 | 404 | 500
 */
export const deleteBeneficiaire = async (req, res) => {
  try {
    const userId   = req.session.user.id;
    const userRole = req.session.user.role;
    const { id }   = req.params;

    const beneficiaire = await findBeneficiaireById(Number(id));
    if (!beneficiaire) {
      return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }
    if (beneficiaire.utilisateur_id !== userId) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    await dbDeleteBeneficiaire(Number(id));

    await createAuditLog({
      utilisateurId:  userId,
      roleUtilisateur: userRole,
      action:         "BENEFICIAIRE_SUPPRIME",
      details:        `Bénéficiaire #${id} — ${beneficiaire.alias} <${beneficiaire.email_interac}>`,
    });

    return res.json({ message: "Bénéficiaire supprimé" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default { getBeneficiaires, createBeneficiaire, deleteBeneficiaire };
