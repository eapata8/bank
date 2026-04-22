/**
 * @fileoverview Couche d'accès aux données pour les bénéficiaires Interac.
 *
 * Un bénéficiaire est un destinataire fréquent sauvegardé par un utilisateur
 * (alias + courriel Interac). Permet de pré-remplir le formulaire d'envoi
 * sans ressaisir l'adresse courriel à chaque fois.
 *
 * @module data/beneficiaires
 */

import db from "../db.js";

/**
 * Retourne tous les bénéficiaires d'un utilisateur, triés par alias.
 *
 * @async
 * @param {number} utilisateurId - Identifiant de l'utilisateur.
 * @returns {Promise<Array>} Liste des bénéficiaires.
 */
export async function findBeneficiaires(utilisateurId) {
  const [rows] = await db.query(
    `SELECT id, utilisateur_id, alias, email_interac, cree_le
     FROM interac_beneficiaires
     WHERE utilisateur_id = ?
     ORDER BY alias ASC`,
    [utilisateurId]
  );
  return rows;
}

/**
 * Retourne un bénéficiaire par son identifiant.
 *
 * @async
 * @param {number} id - Identifiant du bénéficiaire.
 * @returns {Promise<Object|null>} Le bénéficiaire ou null.
 */
export async function findBeneficiaireById(id) {
  const [rows] = await db.query(
    "SELECT id, utilisateur_id, alias, email_interac, cree_le FROM interac_beneficiaires WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

/**
 * Vérifie si un courriel est enregistré dans le système.
 *
 * Un courriel est considéré valide s'il correspond à :
 *  - L'adresse de connexion d'un utilisateur (utilisateurs.email)
 *  - L'adresse d'un auto-dépôt Interac actif (interac_autodeposit.email_interac, statut ACTIVE)
 *
 * @async
 * @param {string} email - Courriel à vérifier (en minuscules).
 * @returns {Promise<boolean>} true si le courriel existe dans le système.
 */
export async function emailExistsDansLeSysteme(email) {
  const [rows] = await db.query(
    `SELECT 1 FROM utilisateurs WHERE email = ?
     UNION
     SELECT 1 FROM interac_autodeposit WHERE email_interac = ? AND statut = 'ACTIVE'
     LIMIT 1`,
    [email, email]
  );
  return rows.length > 0;
}

/**
 * Insère un nouveau bénéficiaire.
 *
 * Lève une erreur MySQL 1062 (ER_DUP_ENTRY) si l'utilisateur
 * possède déjà un bénéficiaire avec le même courriel.
 *
 * @async
 * @param {Object} params
 * @param {number} params.utilisateurId - Propriétaire du bénéficiaire.
 * @param {string} params.alias         - Surnom (ex : "Papa", "Loyer Marc").
 * @param {string} params.emailInterac  - Courriel Interac du destinataire.
 * @returns {Promise<import('mysql2').ResultSetHeader>} Résultat MySQL (insertId).
 */
export async function createBeneficiaire({ utilisateurId, alias, emailInterac }) {
  const [result] = await db.query(
    `INSERT INTO interac_beneficiaires (utilisateur_id, alias, email_interac)
     VALUES (?, ?, ?)`,
    [utilisateurId, alias.trim(), emailInterac.trim().toLowerCase()]
  );
  return result;
}

/**
 * Supprime un bénéficiaire par son identifiant.
 *
 * @async
 * @param {number} id - Identifiant du bénéficiaire à supprimer.
 * @returns {Promise<void>}
 */
export async function deleteBeneficiaire(id) {
  await db.query("DELETE FROM interac_beneficiaires WHERE id = ?", [id]);
}
