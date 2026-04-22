/**
 * @fileoverview Couche d'accès aux données pour les cartes de crédit.
 *
 * Ce module gère toutes les opérations SQL liées aux cartes de crédit :
 *  - Consultation des cartes (filtrée selon le rôle)
 *  - Récupération d'une carte par id avec ou sans contrôle d'accès
 *  - Création de nouvelles cartes (VISA ou MASTERCARD)
 *  - Modification du statut (ACTIVE, GELEE, BLOQUEE, EXPIREE)
 *  - Modification de la limite de crédit et du solde utilisé
 *  - Remboursement : débit du compte source et crédit sur la carte
 *
 * Statuts possibles d'une carte :
 *  - ACTIVE   : carte fonctionnelle et utilisable
 *  - GELEE    : gelée par l'utilisateur (mesure de sécurité temporaire)
 *  - BLOQUEE  : bloquée par un admin (nécessite intervention admin pour débloquer)
 *  - EXPIREE  : carte expirée (date d'expiration dépassée)
 *
 * @module data/cartes
 */

import db from "../db.js";

/**
 * Récupère la liste des cartes de crédit selon les droits de l'utilisateur.
 *
 * Pour un utilisateur standard : retourne uniquement ses propres cartes.
 * Pour un admin/modérateur : retourne toutes les cartes.
 * Inclut les informations du client associé.
 *
 * @async
 * @param {Object}  params             - Les paramètres de filtrage.
 * @param {number}  params.userId      - L'identifiant de l'utilisateur connecté.
 * @param {boolean} params.canReadAll  - true si ADMIN ou MODERATEUR (accès global).
 * @param {string}  params.search      - Terme de recherche optionnel.
 * @returns {Promise<Array>} Les cartes avec infos enrichies, triées par id décroissant.
 */
export async function findCartes({ userId, canReadAll, search }) {
  const whereClauses = [];
  const params = [];

  // Restriction aux cartes des clients de cet utilisateur si pas admin/modérateur
  if (!canReadAll) {
    whereClauses.push("uc.utilisateur_id = ?");
    params.push(userId);
  }

  if (search) {
    const likeSearch = `%${search}%`;
    const numericSearch = Number(search);
    const safeNumeric = Number.isNaN(numericSearch) ? null : numericSearch;

    // Recherche dans : numéro de carte, type, statut, nom du client, email fictif, et id numérique
    whereClauses.push(
      `(
        cc.numero_compte LIKE ?
        OR cc.type_carte LIKE ?
        OR cc.statut LIKE ?
        OR CONCAT(c.prenom, ' ', c.nom) LIKE ?
        OR c.email_fictif LIKE ?
        OR (? IS NOT NULL AND (cc.id = ? OR c.id = ?))
      )`
    );
    params.push(
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      safeNumeric,
      safeNumeric || 0,
      safeNumeric || 0
    );
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // DISTINCT évite les doublons si un client est lié à plusieurs utilisateurs
  const [rows] = await db.query(
    `SELECT DISTINCT
       cc.id,
       cc.client_id,
       cc.numero_compte,   -- Numéro complet masquable côté frontend
       cc.cvv,
       cc.type_carte,
       cc.limite_credit,
       cc.solde_utilise,
       cc.statut,
       cc.date_expiration,
       cc.cree_le,
       CONCAT(c.prenom, ' ', c.nom) AS client_nom,
       c.email_fictif AS client_email
     FROM cartes_credit cc
     JOIN clients c ON c.id = cc.client_id
     LEFT JOIN utilisateurs_clients uc ON uc.client_id = cc.client_id
     ${whereSql}
     ORDER BY cc.id DESC  -- Plus récentes en premier
     `,
    params
  );

  return rows;
}

/**
 * Récupère une carte par son identifiant (sans contrôle d'accès).
 *
 * Utilisé par les ADMIN ou pour vérifier l'existence d'une carte
 * avant de décider entre 404 et 403.
 *
 * @async
 * @param {number} carteId - L'identifiant de la carte.
 * @returns {Promise<object|null>} La carte avec infos du client, ou null si non trouvée.
 */
export async function findCarteById(carteId) {
  const [rows] = await db.query(
    `SELECT
       cc.id,
       cc.client_id,
       cc.numero_compte,
       cc.cvv,
       cc.type_carte,
       cc.limite_credit,
       cc.solde_utilise,
       cc.statut,
       cc.date_expiration,
       cc.cree_le,
       CONCAT(c.prenom, ' ', c.nom) AS client_nom,
       c.email_fictif AS client_email
     FROM cartes_credit cc
     JOIN clients c ON c.id = cc.client_id
     WHERE cc.id = ?`,
    [carteId]
  );
  return rows[0] || null;
}

/**
 * Récupère une carte en vérifiant que l'utilisateur est autorisé à y accéder.
 *
 * Un utilisateur standard ne peut accéder qu'aux cartes de ses propres clients.
 *
 * @async
 * @param {number} userId  - L'identifiant de l'utilisateur connecté.
 * @param {number} carteId - L'identifiant de la carte demandée.
 * @returns {Promise<object|null>} La carte si autorisée, null sinon.
 */
export async function findAuthorizedCarteById(userId, carteId) {
  const [rows] = await db.query(
    `SELECT cc.id, cc.client_id, cc.numero_compte, cc.cvv, cc.type_carte,
            cc.limite_credit, cc.solde_utilise, cc.statut, cc.date_expiration, cc.cree_le
     FROM cartes_credit cc
     JOIN utilisateurs_clients uc ON uc.client_id = cc.client_id
     WHERE uc.utilisateur_id = ? AND cc.id = ?`,
    [userId, carteId]
  );
  return rows[0] || null;
}

/**
 * Crée une nouvelle carte de crédit dans la base de données.
 *
 * Le numéro de carte complet et le CVV sont générés dans le contrôleur
 * et stockés ici tels quels (pour la fonctionnalité "révéler le numéro").
 *
 * @async
 * @param {Object} params                - Les données de la nouvelle carte.
 * @param {number} params.clientId       - Identifiant du client propriétaire.
 * @param {string} params.numeroCompte   - Numéro de carte complet formaté (16 chiffres).
 * @param {string} params.cvv            - Code de sécurité à 3 chiffres.
 * @param {string} params.typeCarte      - Type : "VISA" ou "MASTERCARD".
 * @param {number} params.limiteCredit   - Limite de crédit autorisée.
 * @param {string} params.dateExpiration - Date d'expiration (format YYYY-MM-DD ou MM/YY).
 * @returns {Promise<import('mysql2').ResultSetHeader>} Résultat MySQL (contient insertId).
 */
export async function createCarte({ clientId, numeroCompte, cvv, typeCarte, limiteCredit, dateExpiration }) {
  const [result] = await db.query(
    `INSERT INTO cartes_credit (client_id, numero_compte, cvv, type_carte, limite_credit, date_expiration)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [clientId, numeroCompte, cvv, typeCarte, limiteCredit, dateExpiration]
  );
  return result;
}

/**
 * Met à jour le statut d'une carte de crédit.
 *
 * Utilisé par les actions : bloquer, activer, geler, dégeler.
 *
 * @async
 * @param {number} carteId - L'identifiant de la carte.
 * @param {string} statut  - Le nouveau statut : "ACTIVE", "GELEE", "BLOQUEE" ou "EXPIREE".
 * @returns {Promise<void>}
 */
export async function updateCarteStatut(carteId, statut) {
  await db.query("UPDATE cartes_credit SET statut = ? WHERE id = ?", [statut, carteId]);
}

/**
 * Met à jour la limite de crédit d'une carte.
 *
 * Accessible uniquement aux ADMIN (route protégée par requireAdmin).
 *
 * @async
 * @param {number} carteId      - L'identifiant de la carte.
 * @param {number} limiteCredit - La nouvelle limite de crédit (en CAD).
 * @returns {Promise<void>}
 */
export async function updateCarteLimite(carteId, limiteCredit) {
  await db.query("UPDATE cartes_credit SET limite_credit = ? WHERE id = ?", [limiteCredit, carteId]);
}

/**
 * Remplace le solde utilisé d'une carte par une valeur absolue.
 *
 * Utilisé par l'admin pour corriger manuellement le solde d'une carte.
 * Pour les remboursements normaux, utiliser decrementSoldeUtilise.
 *
 * @async
 * @param {number} carteId - L'identifiant de la carte.
 * @param {number} solde   - Le nouveau solde utilisé (en CAD).
 * @returns {Promise<void>}
 */
export async function updateSoldeUtilise(carteId, solde) {
  await db.query("UPDATE cartes_credit SET solde_utilise = ? WHERE id = ?", [solde, carteId]);
}

/**
 * Décrémente le solde utilisé d'une carte suite à un remboursement.
 *
 * GREATEST(0, ...) protège contre les valeurs négatives :
 * si le remboursement dépasse le solde utilisé (cas anormal),
 * le solde est ramené à 0 plutôt que de devenir négatif.
 *
 * @async
 * @param {number} carteId - L'identifiant de la carte à rembourser.
 * @param {number} montant - Le montant remboursé (à soustraire du solde utilisé).
 * @returns {Promise<void>}
 */
export async function decrementSoldeUtilise(carteId, montant) {
  await db.query(
    "UPDATE cartes_credit SET solde_utilise = GREATEST(0, solde_utilise - ?) WHERE id = ?",
    [montant, carteId]
  );
}

/**
 * Récupère le compte bancaire autorisé à être utilisé pour rembourser une carte.
 *
 * Seuls les comptes de type CHEQUES ou EPARGNE actifs peuvent être utilisés.
 * Pour les utilisateurs standards, le compte doit aussi leur appartenir.
 *
 * @async
 * @param {Object}  params             - Les paramètres de validation.
 * @param {number}  params.userId      - L'identifiant de l'utilisateur connecté.
 * @param {number}  params.compteId    - L'identifiant du compte choisi pour le remboursement.
 * @param {boolean} params.canReadAll  - true si admin (pas de vérification d'appartenance).
 * @returns {Promise<object|null>} Les infos du compte si valide, null sinon.
 */
export async function findSourceAccountForRemboursement({ userId, compteId, canReadAll }) {
  if (canReadAll) {
    // Admin : vérification du type et du statut seulement
    const [rows] = await db.query(
      `SELECT id, client_id, solde, numero_compte, type_compte
       FROM comptes
       WHERE id = ? AND type_compte IN ('CHEQUES', 'EPARGNE') AND est_actif = 1`,
      [compteId]
    );
    return rows[0] || null;
  }

  // Utilisateur standard : vérification de l'appartenance en plus du type et statut
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.solde, co.numero_compte, co.type_compte
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ? AND co.id = ?
       AND co.type_compte IN ('CHEQUES', 'EPARGNE') AND co.est_actif = 1`,
    [userId, compteId]
  );
  return rows[0] || null;
}

/**
 * Décrémente le solde d'un compte suite à un remboursement de carte.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte à débiter.
 * @param {number} montant  - Le montant du remboursement.
 * @returns {Promise<void>}
 */
export async function decrementAccountBalance(compteId, montant) {
  await db.query("UPDATE comptes SET solde = solde - ? WHERE id = ?", [montant, compteId]);
}

/**
 * Crée une transaction de type REMBOURSEMENT dans l'historique du compte.
 *
 * Le montant est négatif car il représente une sortie d'argent du compte
 * (vers la carte de crédit pour la rembourser).
 *
 * @async
 * @param {Object} params           - Les données de la transaction.
 * @param {number} params.compteId  - L'identifiant du compte débité.
 * @param {number} params.carteId   - L'identifiant de la carte remboursée (pour la description).
 * @param {number} params.montant   - Le montant du remboursement (positif — inversé ici).
 * @returns {Promise<void>}
 */
export async function createRemboursementTransaction({ compteId, carteId, montant }) {
  await db.query(
    `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
     VALUES (?, 'REMBOURSEMENT', ?, ?, 'TERMINEE', NOW())`,
    // Montant négatif : sortie d'argent du compte vers la carte
    [compteId, `Remboursement carte de credit #${carteId}`, -montant]
  );
}
