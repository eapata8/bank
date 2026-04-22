/**
 * @fileoverview Couche d'accès aux données pour les retraits en espèces.
 *
 * Ce module gère toutes les opérations SQL liées aux retraits :
 *  - Consultation des retraits (filtrée selon le rôle)
 *  - Validation du compte source avant retrait
 *  - Création d'une demande de retrait
 *  - Approbation / rejet par un modérateur ou admin
 *  - Débit du solde et création de la transaction associée
 *
 * Flux de traitement d'un retrait :
 *  1. Utilisateur soumet une demande → statut EN_ATTENTE, solde NON débité
 *  2a. Auto-validation activée → approuvé immédiatement, solde débité
 *  2b. Modérateur/Admin approuve → statut APPROUVE, solde débité, argent remis au client
 *  2c. Modérateur/Admin rejette → statut REJETE, aucun débit
 *
 * @module data/retraits
 */

import db from "../db.js";

/**
 * Récupère la liste des retraits selon les droits de l'utilisateur.
 *
 * Pour un utilisateur standard : retourne uniquement les retraits de ses clients.
 * Pour un admin/modérateur : retourne tous les retraits.
 *
 * @async
 * @param {Object}  params             - Les paramètres de filtrage.
 * @param {number}  params.userId      - L'identifiant de l'utilisateur connecté.
 * @param {boolean} params.canReadAll  - true si ADMIN ou MODERATEUR (accès global).
 * @param {string}  params.search      - Terme de recherche optionnel.
 * @returns {Promise<Array>} Les retraits avec infos enrichies, triés du plus récent.
 */
export async function findRetraits({ userId, canReadAll, search }) {
  const whereClauses = [];
  const params = [];

  // Restriction aux retraits des clients de cet utilisateur si pas admin/modérateur
  if (!canReadAll) {
    whereClauses.push("uc.utilisateur_id = ?");
    params.push(userId);
  }

  if (search) {
    const like = `%${search}%`;
    const num = Number(search);
    const safeNum = Number.isNaN(num) ? null : num;

    // Recherche dans : description, nom du client, statut et id numérique
    whereClauses.push(
      `(r.description LIKE ? OR CONCAT(c.prenom,' ',c.nom) LIKE ? OR r.statut LIKE ? OR (? IS NOT NULL AND r.id = ?))`
    );
    params.push(like, like, like, safeNum, safeNum || 0);
  }

  const where = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : "";

  // Jointure sur utilisateurs_clients uniquement nécessaire pour les utilisateurs non-admin
  const join = canReadAll
    ? ""
    : "JOIN utilisateurs_clients uc ON uc.client_id = r.client_id";

  const [rows] = await db.query(
    `SELECT r.*,
            CONCAT(c.prenom,' ',c.nom) AS client_nom,
            co.numero_compte           AS compte_numero,
            co.type_compte             AS compte_type,
            CONCAT(u.prenom,' ',u.nom) AS approuve_par_nom  -- Nom de l'agent qui a traité
     FROM retraits r
     JOIN clients c  ON c.id  = r.client_id
     JOIN comptes co ON co.id = r.compte_id
     LEFT JOIN utilisateurs u ON u.id = r.approuve_par  -- LEFT JOIN : null si EN_ATTENTE
     ${join}
     ${where}
     ORDER BY r.date_demande DESC`,
    params
  );
  return rows;
}

/**
 * Récupère un retrait spécifique par son identifiant avec toutes les infos enrichies.
 *
 * @async
 * @param {number} id - L'identifiant du retrait.
 * @returns {Promise<object|null>} Le retrait avec infos enrichies, ou null s'il n'existe pas.
 */
export async function findRetraitById(id) {
  const [rows] = await db.query(
    `SELECT r.*,
            CONCAT(c.prenom,' ',c.nom) AS client_nom,
            co.numero_compte           AS compte_numero,
            co.type_compte             AS compte_type,
            CONCAT(u.prenom,' ',u.nom) AS approuve_par_nom
     FROM retraits r
     JOIN clients c  ON c.id  = r.client_id
     JOIN comptes co ON co.id = r.compte_id
     LEFT JOIN utilisateurs u ON u.id = r.approuve_par
     WHERE r.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Vérifie qu'un compte est valide pour un retrait initié par un utilisateur standard.
 *
 * Conditions requises :
 *  1. Le compte doit appartenir à un client de cet utilisateur
 *  2. Le type doit être CHEQUES ou EPARGNE (pas CREDIT)
 *  3. Le compte doit être actif
 *
 * Le solde est retourné pour permettre la vérification de solde suffisant
 * dans le contrôleur.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte source.
 * @param {number} userId   - L'identifiant de l'utilisateur connecté.
 * @returns {Promise<object|null>} Les infos du compte si valide, null sinon.
 */
export async function findCompteForRetrait(compteId, userId) {
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.est_actif, co.solde
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE co.id = ? AND uc.utilisateur_id = ?
       AND co.type_compte IN ('CHEQUES','EPARGNE')  -- On ne retire pas d'un compte CREDIT
       AND co.est_actif = 1`,
    [compteId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Vérifie qu'un compte est valide pour un retrait (version admin sans contrôle d'accès).
 *
 * @async
 * @param {number} compteId - L'identifiant du compte source.
 * @returns {Promise<object|null>} Les infos du compte si valide, null sinon.
 */
export async function findCompteForRetraitAdmin(compteId) {
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.est_actif, co.solde
     FROM comptes co
     WHERE co.id = ?
       AND co.type_compte IN ('CHEQUES','EPARGNE')
       AND co.est_actif = 1`,
    [compteId]
  );
  return rows[0] ?? null;
}

/**
 * Crée une nouvelle demande de retrait avec statut EN_ATTENTE.
 *
 * Le solde n'est PAS débité à ce stade — il le sera uniquement lors
 * de l'approbation (debitAccountBalance).
 *
 * @async
 * @param {Object}      params             - Les données du retrait.
 * @param {number}      params.compte_id   - Identifiant du compte à débiter.
 * @param {number}      params.client_id   - Identifiant du client propriétaire du compte.
 * @param {number}      params.montant     - Montant à retirer.
 * @param {string|null} params.description - Motif du retrait (optionnel).
 * @returns {Promise<number>} L'identifiant auto-incrémenté du retrait créé.
 */
export async function createRetrait({ compte_id, client_id, montant, description }) {
  const [result] = await db.query(
    `INSERT INTO retraits (compte_id, client_id, montant, description)
     VALUES (?, ?, ?, ?)`,
    [compte_id, client_id, montant, description]
  );
  return result.insertId;
}

/**
 * Approuve un retrait en attente et enregistre l'agent traitant.
 *
 * @async
 * @param {number} id          - L'identifiant du retrait à approuver.
 * @param {number} approuvePar - L'identifiant de l'agent qui approuve.
 * @returns {Promise<void>}
 */
export async function approuverRetrait(id, approuvePar) {
  await db.query(
    "UPDATE retraits SET statut = 'APPROUVE', approuve_par = ?, date_approbation = NOW() WHERE id = ?",
    [approuvePar, id]
  );
}

/**
 * Rejette un retrait en attente.
 *
 * @async
 * @param {number} id          - L'identifiant du retrait à rejeter.
 * @param {number} approuvePar - L'identifiant de l'agent qui rejette.
 * @param {string|null} notes  - Motif du rejet (optionnel).
 * @returns {Promise<void>}
 */
export async function rejeterRetrait(id, approuvePar, notes) {
  await db.query(
    "UPDATE retraits SET statut = 'REJETE', approuve_par = ?, date_approbation = NOW() WHERE id = ?",
    [approuvePar, id]
  );
  // Optionnel : ajouter notes dans une table séparée si nécessaire
}

/**
 * Débite le solde d'un compte suite à l'approbation d'un retrait.
 *
 * Appelé uniquement lors de l'approbation, jamais à la création de la demande.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte à débiter.
 * @param {number} montant  - Le montant à soustraire du solde.
 * @returns {Promise<void>}
 */
export async function debitAccountBalance(compteId, montant) {
  await db.query("UPDATE comptes SET solde = solde - ? WHERE id = ?", [montant, compteId]);
}

/**
 * Crée une transaction de type RETRAIT dans l'historique du compte.
 *
 * Appelé en même temps que debitAccountBalance lors de l'approbation
 * pour maintenir un historique cohérent des mouvements.
 *
 * @async
 * @param {number}      compteId    - L'identifiant du compte concerné.
 * @param {number}      montant     - Le montant du retrait.
 * @param {string|null} description - Description optionnelle de la transaction.
 * @returns {Promise<void>}
 */
export async function createRetraitTransaction(compteId, montant, description) {
  // Note : le montant est stocké tel quel (positif) — le type RETRAIT indique la direction
  await db.query(
    "INSERT INTO transactions (compte_id, type_transaction, montant, description, date_transaction) VALUES (?, 'RETRAIT', ?, ?, NOW())",
    [compteId, montant, description || 'Retrait en espèces']
  );
}

/**
 * Lit le flag d'auto-validation d'un utilisateur.
 *
 * Lorsque auto_validation = 1, les retraits soumis par cet utilisateur
 * sont approuvés automatiquement sans intervention d'un modérateur.
 *
 * @async
 * @param {number} userId - L'identifiant de l'utilisateur.
 * @returns {Promise<number>} 1 si auto-validation activée, 0 sinon.
 */
export async function findUserAutoValidation(userId) {
  const [rows] = await db.query(`SELECT auto_validation FROM utilisateurs WHERE id = ? LIMIT 1`, [userId]);
  return rows[0]?.auto_validation ?? 0;
}

/**
 * Approuve un retrait de façon atomique : débit atomique du solde (avec vérification),
 * mise à jour du statut et création de la transaction dans une seule transaction DB.
 *
 * Le débit atomique (WHERE solde >= ?) protège contre les race conditions :
 * si le solde est devenu insuffisant entre la demande et l'approbation,
 * l'opération est annulée et une erreur SOLDE_INSUFFISANT est levée.
 *
 * @async
 * @param {number}      id          - Identifiant du retrait.
 * @param {number}      userId      - Identifiant de l'agent qui approuve.
 * @param {number}      compteId    - Identifiant du compte à débiter.
 * @param {number}      montant     - Montant du retrait.
 * @param {string|null} description - Description du retrait.
 * @returns {Promise<void>}
 * @throws {Error} avec .code === "SOLDE_INSUFFISANT" si le solde est insuffisant au moment du débit
 */
export async function executeApprouvementRetraitAtomique(id, userId, compteId, montant, description) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Débit atomique : échoue si solde < montant (race condition protégée)
    const [debitResult] = await conn.query(
      "UPDATE comptes SET solde = solde - ? WHERE id = ? AND solde >= ?",
      [montant, compteId, montant]
    );
    if (debitResult.affectedRows === 0) {
      await conn.rollback();
      const err = new Error("Solde insuffisant au moment de l'approbation");
      err.code = "SOLDE_INSUFFISANT";
      throw err;
    }

    await conn.query(
      "UPDATE retraits SET statut = 'APPROUVE', approuve_par = ?, date_approbation = NOW() WHERE id = ?",
      [userId, id]
    );

    await conn.query(
      "INSERT INTO transactions (compte_id, type_transaction, montant, description, date_transaction) VALUES (?, 'RETRAIT', ?, ?, NOW())",
      [compteId, montant, description || "Retrait en espèces"]
    );

    await conn.commit();
  } catch (err) {
    if (err.code !== "SOLDE_INSUFFISANT") {
      await conn.rollback();
    }
    throw err;
  } finally {
    conn.release();
  }
}
