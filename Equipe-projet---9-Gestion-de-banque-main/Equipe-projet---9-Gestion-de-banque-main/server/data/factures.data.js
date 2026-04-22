/**
 * @fileoverview Couche d'accès aux données pour les factures et paiements.
 *
 * Ce module gère toutes les opérations SQL liées aux factures :
 *  - Consultation des factures (filtrée selon le rôle)
 *  - Récupération d'une facture par id avec ou sans contrôle d'accès
 *  - Validation du compte pour le paiement
 *  - Création de factures
 *  - Marquage comme payée et création de la transaction de paiement
 *
 * Statuts possibles d'une facture :
 *  - A_VENIR  : facture créée par l'admin, pas encore à payer
 *  - IMPAYEE  : facture due et non encore payée
 *  - PAYEE    : facture acquittée
 *
 * Les factures IMPAYEE sont prioritaires dans l'ordre d'affichage
 * (triées par date d'échéance croissante pour faciliter le suivi).
 *
 * @module data/factures
 */

import db from "../db.js";

/**
 * Récupère la liste des factures selon les droits de l'utilisateur.
 *
 * Tri prioritaire : IMPAYEE en premier, puis A_VENIR, puis PAYEE,
 * avec sous-tri par date d'échéance croissante pour chaque groupe.
 *
 * @async
 * @param {Object}  params             - Les paramètres de filtrage.
 * @param {number}  params.userId      - L'identifiant de l'utilisateur connecté.
 * @param {boolean} params.canReadAll  - true si ADMIN ou MODERATEUR (accès global).
 * @param {string}  params.search      - Terme de recherche optionnel.
 * @returns {Promise<Array>} Les factures avec infos enrichies, triées par priorité et échéance.
 */
export async function findFactures({ userId, canReadAll, search }) {
  const whereClauses = [];
  const params = [];

  // Restriction aux factures des clients de cet utilisateur si pas admin/modérateur
  if (!canReadAll) {
    whereClauses.push("uc.utilisateur_id = ?");
    params.push(userId);
  }

  if (search) {
    const likeSearch = `%${search}%`;
    const numericSearch = Number(search);
    const safeNumeric = Number.isNaN(numericSearch) ? null : numericSearch;

    // Recherche multi-champs : fournisseur, référence, description, nom client, email fictif, statut, id
    whereClauses.push(
      `(
        f.fournisseur LIKE ?
        OR f.reference_facture LIKE ?
        OR f.description LIKE ?
        OR CONCAT(c.prenom, ' ', c.nom) LIKE ?
        OR c.email_fictif LIKE ?
        OR f.statut LIKE ?
        OR (? IS NOT NULL AND (f.id = ? OR c.id = ?))
      )`
    );
    params.push(
      likeSearch,
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

  // DISTINCT pour éviter les doublons si un client est lié à plusieurs utilisateurs
  const [rows] = await db.query(
    `SELECT DISTINCT
       f.id,
       f.client_id,
       f.compte_paiement_id,
       f.fournisseur,
       f.reference_facture,
       f.description,
       f.montant,
       f.date_emission,
       f.date_echeance,
       f.statut,
       f.payee_le,
       CONCAT(c.prenom, ' ', c.nom) AS client_nom,
       c.email_fictif AS client_email,
       cp.numero_compte AS compte_paiement_numero  -- Numéro du compte utilisé pour le paiement
     FROM factures f
     JOIN clients c ON c.id = f.client_id
     LEFT JOIN utilisateurs_clients uc ON uc.client_id = f.client_id
     LEFT JOIN comptes cp ON cp.id = f.compte_paiement_id
     ${whereSql}
     ORDER BY
       CASE f.statut
         WHEN 'IMPAYEE' THEN 1  -- Priorité max : factures urgentes à payer
         WHEN 'A_VENIR' THEN 2  -- Secondaire : factures prévues mais pas encore dues
         ELSE 3                  -- Payées : en dernier
       END,
       f.date_echeance ASC,     -- Par date d'échéance (plus urgente = affichée en premier)
       f.id DESC`,
    params
  );

  return rows;
}

/**
 * Récupère une facture par son identifiant (sans contrôle d'accès).
 *
 * Utilisé par les ADMIN/MODERATEUR ou pour vérifier l'existence d'une facture
 * avant de décider entre 404 et 403.
 *
 * @async
 * @param {number} factureId - L'identifiant de la facture.
 * @returns {Promise<object|null>} La facture avec les infos client, ou null si non trouvée.
 */
export async function findFactureById(factureId) {
  const [rows] = await db.query(
    `SELECT
       f.id,
       f.client_id,
       f.compte_paiement_id,
       f.fournisseur,
       f.reference_facture,
       f.description,
       f.montant,
       f.date_emission,
       f.date_echeance,
       f.statut,
       f.payee_le,
       CONCAT(c.prenom, ' ', c.nom) AS client_nom,
       c.email_fictif AS client_email
     FROM factures f
     JOIN clients c ON c.id = f.client_id
     WHERE f.id = ?`,
    [factureId]
  );

  return rows[0] || null;
}

/**
 * Récupère une facture en vérifiant que l'utilisateur est autorisé à y accéder.
 *
 * Un utilisateur standard ne peut accéder qu'aux factures de ses propres clients.
 * La vérification se fait via la jointure sur utilisateurs_clients.
 *
 * @async
 * @param {number} userId    - L'identifiant de l'utilisateur connecté.
 * @param {number} factureId - L'identifiant de la facture demandée.
 * @returns {Promise<object|null>} La facture si autorisée, null sinon.
 */
export async function findAuthorizedFactureById(userId, factureId) {
  const [rows] = await db.query(
    `SELECT f.*
     FROM factures f
     JOIN utilisateurs_clients uc ON uc.client_id = f.client_id
     WHERE uc.utilisateur_id = ? AND f.id = ?`,
    [userId, factureId]
  );

  return rows[0] || null;
}

/**
 * Récupère le compte bancaire à utiliser pour payer une facture.
 *
 * Vérifie deux conditions de sécurité :
 *  1. Le compte appartient bien au client de la facture (pas de paiement croisé)
 *  2. L'utilisateur connecté est autorisé à utiliser ce compte (sauf admin)
 *
 * @async
 * @param {Object}  params                   - Les paramètres de validation.
 * @param {number}  params.userId            - L'identifiant de l'utilisateur connecté.
 * @param {number}  params.factureClientId   - L'identifiant du client propriétaire de la facture.
 * @param {number}  params.compteId          - L'identifiant du compte choisi pour le paiement.
 * @param {boolean} params.canReadAll        - true si admin (pas de vérification d'appartenance utilisateur).
 * @returns {Promise<{id: number, client_id: number, solde: number, numero_compte: string}|null>}
 *   Les infos du compte si valide, null sinon.
 */
export async function findAccountForFacturePayment({ userId, factureClientId, compteId, canReadAll }) {
  if (canReadAll) {
    // Admin : vérifie seulement que le compte appartient au bon client
    const [rows] = await db.query(
      `SELECT id, client_id, solde, numero_compte
       FROM comptes
       WHERE id = ? AND client_id = ?`,
      [compteId, factureClientId]
    );
    return rows[0] || null;
  }

  // Utilisateur standard : triple vérification (utilisateur → client → compte)
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.solde, co.numero_compte
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ?
       AND co.id = ?
       AND co.client_id = ?`,  // Le compte doit appartenir au même client que la facture
    [userId, compteId, factureClientId]
  );

  return rows[0] || null;
}

/**
 * Récupère l'identifiant du client associé à un utilisateur.
 *
 * Utilisé lors de la création de facture par un utilisateur standard :
 * le client_id est automatiquement déterminé à partir de l'utilisateur connecté.
 * Retourne le premier client lié à cet utilisateur.
 *
 * @async
 * @param {number} userId - L'identifiant de l'utilisateur connecté.
 * @returns {Promise<number|null>} L'identifiant du client, ou null si aucun client associé.
 */
export async function findClientIdForUser(userId) {
  const [rows] = await db.query(
    `SELECT client_id FROM utilisateurs_clients WHERE utilisateur_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0]?.client_id || null;
}

/**
 * Insère une nouvelle facture dans la base de données.
 *
 * @async
 * @param {Object}      params                   - Les données de la facture.
 * @param {number}      params.clientId          - Identifiant du client à facturer.
 * @param {string}      params.fournisseur       - Nom du fournisseur / émetteur de la facture.
 * @param {string}      params.referenceFacture  - Numéro ou référence unique de la facture.
 * @param {string|null} params.description       - Description optionnelle.
 * @param {number}      params.montant           - Montant total de la facture.
 * @param {string}      params.dateEmission      - Date d'émission (format YYYY-MM-DD).
 * @param {string}      params.dateEcheance      - Date d'échéance (format YYYY-MM-DD).
 * @param {string}      params.statut            - Statut initial : "A_VENIR" ou "IMPAYEE".
 * @returns {Promise<import('mysql2').ResultSetHeader>} Résultat MySQL (contient insertId).
 */
export async function createFacture({
  clientId,
  fournisseur,
  referenceFacture,
  description,
  montant,
  dateEmission,
  dateEcheance,
  statut,
}) {
  const [result] = await db.query(
    `INSERT INTO factures
      (client_id, fournisseur, reference_facture, description, montant, date_emission, date_echeance, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [clientId, fournisseur, referenceFacture, description || null, montant, dateEmission, dateEcheance, statut]
  );

  return result;
}

/**
 * Marque une facture comme payée et enregistre le compte et la date de paiement.
 *
 * @async
 * @param {Object} params           - Les données du paiement.
 * @param {number} params.factureId - L'identifiant de la facture à marquer comme payée.
 * @param {number} params.compteId  - L'identifiant du compte utilisé pour le paiement.
 * @returns {Promise<void>}
 */
export async function markFactureAsPaid({ factureId, compteId }) {
  await db.query(
    `UPDATE factures
     SET statut = 'PAYEE',
         compte_paiement_id = ?,   -- Mémorisation du compte utilisé pour le paiement
         payee_le = NOW()          -- Horodatage automatique du paiement
     WHERE id = ?`,
    [compteId, factureId]
  );
}

/**
 * Décrémente le solde d'un compte suite au paiement d'une facture.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte à débiter.
 * @param {number} montant  - Le montant de la facture à soustraire.
 * @returns {Promise<void>}
 */
export async function decrementAccountBalance(compteId, montant) {
  await db.query("UPDATE comptes SET solde = solde - ? WHERE id = ?", [montant, compteId]);
}

/**
 * Crée une transaction de type PAIEMENT dans l'historique du compte.
 *
 * Le montant est négatif pour représenter une sortie d'argent (paiement de facture).
 *
 * @async
 * @param {Object} params             - Les données de la transaction.
 * @param {number} params.compteId    - L'identifiant du compte débité.
 * @param {string} params.fournisseur - Nom du fournisseur (pour la description).
 * @param {number} params.factureId   - Identifiant de la facture (pour la description).
 * @param {number} params.montant     - Montant payé (positif — sera inversé en négatif ici).
 * @returns {Promise<void>}
 */
export async function createBillPaymentTransaction({ compteId, fournisseur, factureId, montant }) {
  await db.query(
    `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
     VALUES (?, 'PAIEMENT', ?, ?, 'TERMINEE', NOW())`,
    // Montant négatif : sortie d'argent du compte lors du paiement
    [compteId, `Paiement facture #${factureId} - ${fournisseur}`, -montant]
  );
}

/**
 * Paie une facture de façon atomique : débit atomique du solde, marquage PAYEE
 * et création de la transaction dans une seule transaction DB.
 *
 * Le débit atomique (WHERE solde >= ?) protège contre les race conditions.
 * Si le solde est insuffisant au moment précis du débit, SOLDE_INSUFFISANT est levé.
 *
 * @async
 * @param {Object} params
 * @param {number} params.factureId  - Identifiant de la facture.
 * @param {number} params.compteId   - Identifiant du compte à débiter.
 * @param {number} params.montant    - Montant de la facture.
 * @param {string} params.fournisseur - Nom du fournisseur.
 * @returns {Promise<void>}
 * @throws {Error} avec .code === "SOLDE_INSUFFISANT" si le solde est insuffisant
 */
export async function executePayementFactureAtomique({ factureId, compteId, montant, fournisseur }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Débit atomique
    const [debitResult] = await conn.query(
      "UPDATE comptes SET solde = solde - ? WHERE id = ? AND solde >= ?",
      [montant, compteId, montant]
    );
    if (debitResult.affectedRows === 0) {
      await conn.rollback();
      const err = new Error("Solde insuffisant");
      err.code = "SOLDE_INSUFFISANT";
      throw err;
    }

    await conn.query(
      `UPDATE factures
       SET statut = 'PAYEE', compte_paiement_id = ?, payee_le = NOW()
       WHERE id = ?`,
      [compteId, factureId]
    );

    await conn.query(
      `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
       VALUES (?, 'PAIEMENT', ?, ?, 'TERMINEE', NOW())`,
      [compteId, `Paiement facture #${factureId} - ${fournisseur}`, -montant]
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
