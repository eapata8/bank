/**
 * @fileoverview Couche d'accès aux données pour les opérations administratives.
 *
 * Ce module gère toutes les opérations SQL réservées aux administrateurs et modérateurs :
 *  - Utilisateurs : liste, recherche, création (admin/modérateur), suppression, rôle, mot de passe, auto-validation
 *  - Comptes : lecture avec infos client, modification de solde/statut/type
 *  - Transactions : lecture, insertion manuelle, suppression, ajustement de solde, recherche de transaction jumelée
 *  - Virements : lecture, insertion manuelle, suppression, suppression des transactions associées
 *
 * @module data/admin
 */

import bcrypt from "bcryptjs";
import db from "../db.js";

/* ── Utilisateurs ───────────────────────────────── */

/**
 * Retourne la liste complète de tous les utilisateurs, triée par date de création.
 *
 * @async
 * @returns {Promise<Array>} Tableau d'utilisateurs (id, email, role, prenom, nom, auto_validation, cree_le).
 */
export async function findAllUsers() {
  const [rows] = await db.query(
    `SELECT id, email, role, prenom, nom, auto_validation, cree_le
     FROM utilisateurs
     ORDER BY cree_le ASC, id ASC`
  );
  return rows;
}

/**
 * Active ou désactive l'auto-validation pour un utilisateur.
 *
 * Lorsqu'activée, les dépôts et retraits de cet utilisateur sont approuvés automatiquement.
 *
 * @async
 * @param {number}  id    - Identifiant de l'utilisateur.
 * @param {boolean} value - true pour activer, false pour désactiver.
 * @returns {Promise<void>}
 */
export async function updateAutoValidation(id, value) {
  await db.query(`UPDATE utilisateurs SET auto_validation = ? WHERE id = ?`, [value ? 1 : 0, id]);
}

/**
 * Lit le flag auto_validation d'un utilisateur.
 *
 * @async
 * @param {number} id - Identifiant de l'utilisateur.
 * @returns {Promise<number>} 1 si auto-validation activée, 0 sinon (défaut si introuvable).
 */
export async function findUserAutoValidation(id) {
  const [rows] = await db.query(`SELECT auto_validation FROM utilisateurs WHERE id = ? LIMIT 1`, [id]);
  return rows[0]?.auto_validation ?? 0;
}

/**
 * Retourne un utilisateur par son identifiant (sans le hash du mot de passe).
 *
 * @async
 * @param {number} id - Identifiant de l'utilisateur.
 * @returns {Promise<object|null>} L'utilisateur (id, email, role, prenom, nom, cree_le), ou null.
 */
export async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT id, email, role, prenom, nom, cree_le FROM utilisateurs WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Retourne l'identifiant du premier administrateur créé dans le système.
 *
 * Utilisé pour empêcher la suppression de l'admin initial (protection système).
 *
 * @async
 * @returns {Promise<number|null>} L'id du premier admin, ou null si aucun.
 */
export async function getFirstAdminId() {
  const [rows] = await db.query(
    `SELECT id FROM utilisateurs WHERE role = 'ADMIN' ORDER BY id ASC LIMIT 1`
  );
  return rows[0]?.id ?? null;
}

/**
 * Crée un utilisateur avec le rôle MODERATEUR.
 *
 * Le mot de passe est haché avec bcrypt (10 rounds) avant insertion.
 *
 * @async
 * @param {Object} params           - Données du nouveau modérateur.
 * @param {string} params.email     - Adresse email (unique).
 * @param {string} params.motDePasse - Mot de passe en clair (sera haché).
 * @param {string} params.prenom    - Prénom.
 * @param {string} params.nom       - Nom.
 * @returns {Promise<number>} L'identifiant auto-incrémenté du modérateur créé.
 */
export async function createModeratorUser({ email, motDePasse, prenom, nom }) {
  const hash = await bcrypt.hash(motDePasse, 10);
  const [result] = await db.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, prenom, nom) VALUES (?, ?, 'MODERATEUR', ?, ?)`,
    [email, hash, prenom, nom]
  );
  return result.insertId;
}

/**
 * Supprime un utilisateur par son identifiant.
 *
 * @async
 * @param {number} id - Identifiant de l'utilisateur à supprimer.
 * @returns {Promise<number>} Nombre de lignes affectées (0 si introuvable).
 */
export async function deleteUserById(id) {
  const [result] = await db.query(`DELETE FROM utilisateurs WHERE id = ?`, [id]);
  return result.affectedRows;
}

/**
 * Met à jour le rôle d'un utilisateur.
 *
 * @async
 * @param {number} id   - Identifiant de l'utilisateur.
 * @param {string} role - Nouveau rôle (UTILISATEUR, MODERATEUR, ADMIN).
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function updateUserRole(id, role) {
  const [result] = await db.query(
    `UPDATE utilisateurs SET role = ? WHERE id = ?`,
    [role, id]
  );
  return result.affectedRows;
}

/**
 * Réinitialise le mot de passe d'un utilisateur.
 *
 * Le nouveau mot de passe en clair est haché avec bcrypt avant mise à jour.
 *
 * @async
 * @param {number} id            - Identifiant de l'utilisateur.
 * @param {string} plainPassword - Nouveau mot de passe en clair.
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function resetUserPassword(id, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  const [result] = await db.query(
    `UPDATE utilisateurs SET mot_de_passe_hash = ? WHERE id = ?`,
    [hash, id]
  );
  return result.affectedRows;
}

/**
 * Crée un utilisateur avec le rôle ADMIN.
 *
 * Le mot de passe est haché avec bcrypt (10 rounds) avant insertion.
 *
 * @async
 * @param {Object} params           - Données du nouvel administrateur.
 * @param {string} params.email     - Adresse email (unique).
 * @param {string} params.motDePasse - Mot de passe en clair (sera haché).
 * @param {string} params.prenom    - Prénom.
 * @param {string} params.nom       - Nom.
 * @returns {Promise<number>} L'identifiant auto-incrémenté de l'admin créé.
 */
export async function createAdminUser({ email, motDePasse, prenom, nom }) {
  const hash = await bcrypt.hash(motDePasse, 10);
  const [result] = await db.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, prenom, nom) VALUES (?, ?, 'ADMIN', ?, ?)`,
    [email, hash, prenom, nom]
  );
  return result.insertId;
}

/**
 * Recherche un utilisateur par son adresse email.
 *
 * Utilisé pour vérifier l'unicité de l'email avant création.
 *
 * @async
 * @param {string} email - Adresse email à rechercher.
 * @returns {Promise<{id: number}|null>} L'objet { id } si trouvé, null sinon.
 */
export async function findUserIdByEmail(email) {
  const [rows] = await db.query(`SELECT id FROM utilisateurs WHERE email = ? LIMIT 1`, [email]);
  return rows[0] || null;
}

/* ── Comptes ─────────────────────────────────────── */

/**
 * Retourne un compte avec les informations du client associé.
 *
 * @async
 * @param {number} compteId - Identifiant du compte.
 * @returns {Promise<object|null>} Le compte enrichi (type, solde, statut, prenom/nom du client), ou null.
 */
export async function findAccountWithClientInfo(compteId) {
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.numero_compte, co.solde, co.devise, co.est_actif,
            c.prenom AS client_prenom, c.nom AS client_nom
     FROM comptes co
     JOIN clients c ON c.id = co.client_id
     WHERE co.id = ?`,
    [compteId]
  );
  return rows[0] || null;
}

/**
 * Définit le solde d'un compte à une valeur absolue.
 *
 * Contrairement à adjustBalanceBy, cette fonction écrase le solde existant.
 *
 * @async
 * @param {number} compteId  - Identifiant du compte.
 * @param {number} newSolde  - Nouveau solde (valeur absolue).
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function setAccountBalance(compteId, newSolde) {
  const [result] = await db.query(
    `UPDATE comptes SET solde = ? WHERE id = ?`,
    [newSolde, compteId]
  );
  return result.affectedRows;
}

/**
 * Active ou bloque un compte (est_actif).
 *
 * @async
 * @param {number}  compteId  - Identifiant du compte.
 * @param {number}  estActif  - 1 pour actif, 0 pour bloqué.
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function setAccountStatus(compteId, estActif) {
  const [result] = await db.query(
    `UPDATE comptes SET est_actif = ? WHERE id = ?`,
    [estActif ? 1 : 0, compteId]
  );
  return result.affectedRows;
}

/**
 * Modifie le type d'un compte (CHEQUES, EPARGNE, CREDIT).
 *
 * @async
 * @param {number} compteId   - Identifiant du compte.
 * @param {string} typeCompte - Nouveau type de compte.
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function setAccountType(compteId, typeCompte) {
  const [result] = await db.query(
    `UPDATE comptes SET type_compte = ? WHERE id = ?`,
    [typeCompte, compteId]
  );
  return result.affectedRows;
}

/* ── Transactions ────────────────────────────────── */

/**
 * Retourne une transaction par son identifiant.
 *
 * @async
 * @param {number} txId - Identifiant de la transaction.
 * @returns {Promise<object|null>} La transaction (id, compte_id, type, description, montant, date, statut), ou null.
 */
export async function findTransactionById(txId) {
  const [rows] = await db.query(
    `SELECT id, compte_id, type_transaction, description, montant, date_transaction, statut
     FROM transactions WHERE id = ? LIMIT 1`,
    [txId]
  );
  return rows[0] || null;
}

/**
 * Insère manuellement une transaction dans l'historique d'un compte.
 *
 * @async
 * @param {Object}  params                    - Données de la transaction.
 * @param {number}  params.compteId           - Identifiant du compte.
 * @param {string}  params.typeTransaction    - Type (DEPOT, RETRAIT, VIREMENT, etc.).
 * @param {string}  [params.description]      - Description libre (optionnelle).
 * @param {number}  params.montant            - Montant (positif ou négatif).
 * @param {string}  [params.statut]           - Statut (défaut : TERMINEE).
 * @param {Date}    [params.dateTransaction]  - Date de la transaction (défaut : maintenant).
 * @returns {Promise<number>} L'identifiant auto-incrémenté de la transaction créée.
 */
export async function insertTransaction({ compteId, typeTransaction, description, montant, statut, dateTransaction }) {
  const [result] = await db.query(
    `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      compteId,
      typeTransaction,
      description || null,
      montant,
      statut || "TERMINEE",
      dateTransaction || new Date(),
    ]
  );
  return result.insertId;
}

/**
 * Supprime une transaction par son identifiant.
 *
 * @async
 * @param {number} txId - Identifiant de la transaction.
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function deleteTransactionById(txId) {
  const [result] = await db.query(`DELETE FROM transactions WHERE id = ?`, [txId]);
  return result.affectedRows;
}

/**
 * Recherche la transaction VIREMENT jumelée à une autre sur un compte différent.
 *
 * Utilisé lors de la suppression d'un virement pour retrouver et supprimer
 * la transaction de l'autre compte (débit ↔ crédit créés en même temps).
 * La tolérance temporelle est de ±2 secondes.
 *
 * @async
 * @param {number} compteId        - Compte de la transaction d'origine (à exclure).
 * @param {number} montant         - Montant de la transaction d'origine.
 * @param {Date}   dateTransaction - Date de la transaction d'origine.
 * @returns {Promise<{id: number, compte_id: number, montant: number}|null>} La transaction jumelée, ou null.
 */
export async function findPairedVirementTransaction(compteId, montant, dateTransaction) {
  // Transaction jumelée : même type VIREMENT, compte différent, montant opposé, même instant (±2s)
  const [rows] = await db.query(
    `SELECT id, compte_id, montant
     FROM transactions
     WHERE type_transaction = 'VIREMENT'
       AND compte_id != ?
       AND montant = ?
       AND ABS(TIMESTAMPDIFF(SECOND, date_transaction, ?)) <= 2
     ORDER BY ABS(TIMESTAMPDIFF(SECOND, date_transaction, ?)) ASC
     LIMIT 1`,
    [compteId, -montant, dateTransaction, dateTransaction]
  );
  return rows[0] || null;
}

/**
 * Ajuste le solde d'un compte par un delta (positif ou négatif).
 *
 * Contrairement à setAccountBalance, cette fonction est relative (solde + delta).
 *
 * @async
 * @param {number} compteId - Identifiant du compte.
 * @param {number} delta    - Variation à appliquer (négatif pour débit, positif pour crédit).
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function adjustBalanceBy(compteId, delta) {
  const [result] = await db.query(
    `UPDATE comptes SET solde = solde + ? WHERE id = ?`,
    [delta, compteId]
  );
  return result.affectedRows;
}

/* ── Virements ───────────────────────────────────── */

/**
 * Retourne un virement par son identifiant.
 *
 * @async
 * @param {number} virementId - Identifiant du virement.
 * @returns {Promise<object|null>} Le virement (id, comptes source/destination, montant, statut, date), ou null.
 */
export async function findVirementById(virementId) {
  const [rows] = await db.query(
    `SELECT v.id, v.compte_source_id, v.compte_destination_id, v.montant, v.description,
            v.date_virement, v.statut
     FROM virements v WHERE v.id = ? LIMIT 1`,
    [virementId]
  );
  return rows[0] || null;
}

/**
 * Insère manuellement un virement en base de données.
 *
 * N'ajuste pas les soldes — c'est la responsabilité du contrôleur.
 *
 * @async
 * @param {Object}  params                      - Données du virement.
 * @param {number}  params.compteSourceId       - Identifiant du compte source.
 * @param {number}  params.compteDestinationId  - Identifiant du compte destination.
 * @param {number}  params.montant              - Montant transféré.
 * @param {string}  [params.description]        - Description libre.
 * @param {string}  [params.statut]             - Statut (défaut : ACCEPTE).
 * @param {Date}    [params.dateVirement]       - Date du virement (défaut : maintenant).
 * @returns {Promise<number>} L'identifiant auto-incrémenté du virement créé.
 */
export async function insertVirement({ compteSourceId, compteDestinationId, montant, description, statut, dateVirement }) {
  const [result] = await db.query(
    `INSERT INTO virements (compte_source_id, compte_destination_id, montant, description, date_virement, statut)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      compteSourceId,
      compteDestinationId,
      montant,
      description || null,
      dateVirement || new Date(),
      statut || "ACCEPTE",
    ]
  );
  return result.insertId;
}

/**
 * Supprime un virement par son identifiant.
 *
 * @async
 * @param {number} virementId - Identifiant du virement.
 * @returns {Promise<number>} Nombre de lignes affectées.
 */
export async function deleteVirementById(virementId) {
  const [result] = await db.query(`DELETE FROM virements WHERE id = ?`, [virementId]);
  return result.affectedRows;
}

/**
 * Supprime les deux transactions liées à un virement (débit source + crédit destination).
 *
 * La recherche est basée sur les comptes source/destination, le montant et la date
 * avec une tolérance d'une seconde pour gérer les légères différences d'horodatage.
 *
 * @async
 * @param {Object} params                      - Paramètres d'identification du virement.
 * @param {number} params.compteSourceId       - Identifiant du compte source.
 * @param {number} params.compteDestinationId  - Identifiant du compte destination.
 * @param {number} params.montant              - Montant du virement.
 * @param {Date}   params.dateVirement         - Date du virement.
 * @returns {Promise<void>}
 */
export async function deleteTransactionsByVirementAccounts({ compteSourceId, compteDestinationId, montant, dateVirement }) {
  // Supprime les 2 transactions liées au virement (débit source + crédit destination)
  await db.query(
    `DELETE FROM transactions
     WHERE (compte_id = ? AND montant = ? AND date_transaction >= DATE_SUB(?, INTERVAL 1 SECOND) AND date_transaction <= DATE_ADD(?, INTERVAL 1 SECOND))
        OR (compte_id = ? AND montant = ? AND date_transaction >= DATE_SUB(?, INTERVAL 1 SECOND) AND date_transaction <= DATE_ADD(?, INTERVAL 1 SECOND))`,
    [
      compteSourceId, -montant, dateVirement, dateVirement,
      compteDestinationId, montant, dateVirement, dateVirement,
    ]
  );
}
