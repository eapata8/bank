/**
 * @fileoverview Couche d'accès aux données pour les dépôts par chèque.
 *
 * Ce module gère toutes les opérations SQL liées aux dépôts de chèques :
 *  - Consultation des dépôts (avec filtrage selon le rôle)
 *  - Validation du compte cible avant dépôt
 *  - Création d'une demande de dépôt
 *  - Approbation / rejet d'un dépôt par un modérateur ou admin
 *  - Crédit du solde et création de la transaction associée
 *  - Lecture du flag auto_validation de l'utilisateur
 *
 * Flux de traitement d'un dépôt :
 *  1. Utilisateur soumet une demande → statut EN_ATTENTE
 *  2a. Auto-validation activée → approuvé immédiatement, solde crédité
 *  2b. Moderateur/Admin approuve → statut APPROUVE, solde crédité
 *  2c. Moderateur/Admin rejette → statut REJETE
 *
 * @module data/depots
 */

import db from "../db.js";

/**
 * Récupère la liste des dépôts selon les droits de l'utilisateur.
 *
 * Pour un utilisateur standard : retourne uniquement les dépôts de ses clients.
 * Pour un admin/modérateur : retourne tous les dépôts.
 * Inclut les informations du client, du compte et de l'agent qui a traité le dépôt.
 *
 * @async
 * @param {Object}  params             - Les paramètres de filtrage.
 * @param {number}  params.userId      - L'identifiant de l'utilisateur connecté.
 * @param {boolean} params.canReadAll  - true si ADMIN ou MODERATEUR (accès global).
 * @param {string}  params.search      - Terme de recherche optionnel.
 * @returns {Promise<Array>} Les dépôts correspondants avec infos enrichies, triés du plus récent.
 */
export async function findDepots({ userId, canReadAll, search }) {
  const whereClauses = [];
  const params = [];

  // Restreindre aux dépôts des clients de cet utilisateur si pas admin/modérateur
  if (!canReadAll) {
    whereClauses.push("uc.utilisateur_id = ?");
    params.push(userId);
  }

  if (search) {
    const like = `%${search}%`;
    const num = Number(search);
    // Null si la recherche n'est pas un nombre valide (évite les erreurs de cast)
    const safeNum = Number.isNaN(num) ? null : num;

    // Recherche dans : numéro de chèque, banque émettrice, nom du client, statut, et id
    whereClauses.push(
      `(d.numero_cheque LIKE ? OR d.banque_emettrice LIKE ? OR CONCAT(c.prenom,' ',c.nom) LIKE ? OR d.statut LIKE ? OR (? IS NOT NULL AND d.id = ?))`
    );
    params.push(like, like, like, like, safeNum, safeNum || 0);
  }

  const where = whereClauses.length
    ? `WHERE ${whereClauses.join(" AND ")}`
    : "";

  // La jointure sur utilisateurs_clients n'est nécessaire que pour les utilisateurs non-admin
  const join = canReadAll
    ? ""
    : "JOIN utilisateurs_clients uc ON uc.client_id = d.client_id";

  // d.* récupère toutes les colonnes de depots_cheques
  // Les colonnes supplémentaires enrichissent l'affichage (nom client, numéro de compte, agent)
  const [rows] = await db.query(
    `SELECT d.*,
            CONCAT(c.prenom,' ',c.nom) AS client_nom,
            co.numero_compte           AS compte_numero,
            co.type_compte             AS compte_type,
            CONCAT(u.prenom,' ',u.nom) AS traite_par_nom  -- Agent qui a approuvé/rejeté
     FROM depots_cheques d
     JOIN clients c  ON c.id  = d.client_id
     JOIN comptes co ON co.id = d.compte_id
     LEFT JOIN utilisateurs u ON u.id = d.traite_par  -- LEFT JOIN car peut être null si EN_ATTENTE
     ${join}
     ${where}
     ORDER BY d.depose_le DESC  -- Du plus récent au plus ancien
     `,
    params
  );
  return rows;
}

/**
 * Récupère un dépôt spécifique par son identifiant avec toutes les infos enrichies.
 *
 * @async
 * @param {number} id - L'identifiant du dépôt.
 * @returns {Promise<object|null>} Le dépôt avec infos enrichies, ou null s'il n'existe pas.
 */
export async function findDepotById(id) {
  const [rows] = await db.query(
    `SELECT d.*,
            CONCAT(c.prenom,' ',c.nom) AS client_nom,
            co.numero_compte           AS compte_numero,
            co.type_compte             AS compte_type,
            CONCAT(u.prenom,' ',u.nom) AS traite_par_nom
     FROM depots_cheques d
     JOIN clients c  ON c.id  = d.client_id
     JOIN comptes co ON co.id = d.compte_id
     LEFT JOIN utilisateurs u ON u.id = d.traite_par
     WHERE d.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Vérifie qu'un compte est valide pour recevoir un dépôt d'un utilisateur standard.
 *
 * Conditions requises :
 *  1. Le compte doit appartenir à un client de cet utilisateur
 *  2. Le type doit être CHEQUES ou EPARGNE (pas CREDIT)
 *  3. Le compte doit être actif (est_actif = 1)
 *
 * @async
 * @param {number} compteId - L'identifiant du compte cible.
 * @param {number} userId   - L'identifiant de l'utilisateur connecté.
 * @returns {Promise<{id: number, client_id: number, type_compte: string, est_actif: boolean, solde: number}|null>}
 *   Les infos du compte si valide, null si non trouvé ou non autorisé.
 */
export async function findCompteForDepot(compteId, userId) {
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.est_actif, co.solde
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE co.id = ? AND uc.utilisateur_id = ?
       AND co.type_compte IN ('CHEQUES','EPARGNE')  -- Seuls ces types acceptent des dépôts
       AND co.est_actif = 1  -- Le compte ne doit pas être bloqué
     `,
    [compteId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Vérifie qu'un compte est valide pour recevoir un dépôt (version admin sans contrôle d'accès).
 *
 * Même conditions que findCompteForDepot mais sans vérification d'appartenance
 * à un utilisateur spécifique (les admins peuvent déposer sur n'importe quel compte).
 *
 * @async
 * @param {number} compteId - L'identifiant du compte cible.
 * @returns {Promise<object|null>} Les infos du compte si valide, null sinon.
 */
export async function findCompteForDepotAdmin(compteId) {
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.est_actif
     FROM comptes co
     WHERE co.id = ?
       AND co.type_compte IN ('CHEQUES','EPARGNE')
       AND co.est_actif = 1`,
    [compteId]
  );
  return rows[0] ?? null;
}

/**
 * Crée une nouvelle demande de dépôt par chèque avec statut EN_ATTENTE.
 *
 * Le fichier image du chèque est stocké séparément sur le disque (voir upload.middleware.js) ;
 * seul le nom du fichier (chemin relatif) est stocké en base de données.
 *
 * @async
 * @param {Object}      params                  - Les données du dépôt.
 * @param {number}      params.compte_id         - Identifiant du compte destinataire.
 * @param {number}      params.client_id         - Identifiant du client propriétaire du compte.
 * @param {number}      params.montant           - Montant du chèque.
 * @param {string}      params.numero_cheque     - Numéro du chèque (identifiant unique du chèque).
 * @param {string}      params.banque_emettrice  - Nom de la banque qui a émis le chèque.
 * @param {string|null} params.fichier_chemin    - Nom du fichier image uploadé (null si non fourni).
 * @returns {Promise<number>} L'identifiant auto-incrémenté du dépôt créé.
 */
export async function createDepot({ compte_id, client_id, montant, numero_cheque, banque_emettrice, fichier_chemin }) {
  const [result] = await db.query(
    `INSERT INTO depots_cheques (compte_id, client_id, montant, numero_cheque, banque_emettrice, fichier_chemin)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [compte_id, client_id, montant, numero_cheque, banque_emettrice, fichier_chemin ?? null]
  );
  return result.insertId;
}

/**
 * Approuve un dépôt en attente et enregistre l'agent traitant.
 *
 * Met à jour le statut à APPROUVE, enregistre la date de traitement
 * et l'identifiant de l'agent qui a approuvé.
 * La clause `AND statut = 'EN_ATTENTE'` protège contre la double approbation.
 *
 * @async
 * @param {number} id        - L'identifiant du dépôt à approuver.
 * @param {number} traitePar - L'identifiant de l'agent (modérateur ou admin) qui approuve.
 * @returns {Promise<void>}
 */
export async function approuverDepot(id, traitePar) {
  await db.query(
    `UPDATE depots_cheques
     SET statut = 'APPROUVE', traite_le = NOW(), traite_par = ?
     WHERE id = ? AND statut = 'EN_ATTENTE'`, // Protection : ne met à jour que si encore EN_ATTENTE
    [traitePar, id]
  );
}

/**
 * Rejette un dépôt en attente avec un motif optionnel.
 *
 * Met à jour le statut à REJETE et enregistre les notes de rejet.
 *
 * @async
 * @param {number}      id        - L'identifiant du dépôt à rejeter.
 * @param {number}      traitePar - L'identifiant de l'agent qui rejette.
 * @param {string|null} notes     - Motif du rejet (optionnel mais recommandé).
 * @returns {Promise<void>}
 */
export async function rejeterDepot(id, traitePar, notes) {
  await db.query(
    `UPDATE depots_cheques
     SET statut = 'REJETE', traite_le = NOW(), traite_par = ?, notes = ?
     WHERE id = ? AND statut = 'EN_ATTENTE'`,
    [traitePar, notes ?? null, id]
  );
}

/**
 * Crédite le solde d'un compte suite à l'approbation d'un dépôt.
 *
 * Appelé uniquement après approbation — jamais à la création de la demande.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte à créditer.
 * @param {number} montant  - Le montant à ajouter au solde.
 * @returns {Promise<void>}
 */
export async function creditAccountBalance(compteId, montant) {
  await db.query(
    `UPDATE comptes SET solde = solde + ? WHERE id = ?`,
    [montant, compteId]
  );
}

/**
 * Crée une transaction de type DEPOT dans l'historique du compte.
 *
 * Appelé en même temps que creditAccountBalance lors de l'approbation
 * pour garder un historique cohérent des mouvements de fonds.
 *
 * @async
 * @param {number} compteId  - L'identifiant du compte concerné.
 * @param {number} montant   - Le montant du dépôt (positif).
 * @param {string} reference - Le numéro du chèque (pour la description de la transaction).
 * @returns {Promise<void>}
 */
export async function createDepotTransaction(compteId, montant, reference) {
  await db.query(
    `INSERT INTO transactions (compte_id, type_transaction, description, montant, date_transaction, statut)
     VALUES (?, 'DEPOT', ?, ?, NOW(), 'TERMINEE')`,
    [compteId, `Dépôt chèque #${reference}`, montant]
  );
}

/**
 * Lit le flag d'auto-validation d'un utilisateur.
 *
 * Lorsque auto_validation = 1, les dépôts et retraits soumis par cet utilisateur
 * sont approuvés automatiquement sans intervention d'un modérateur.
 *
 * @async
 * @param {number} userId - L'identifiant de l'utilisateur.
 * @returns {Promise<number>} 1 si auto-validation activée, 0 sinon.
 */
export async function findUserAutoValidation(userId) {
  const [rows] = await db.query(`SELECT auto_validation FROM utilisateurs WHERE id = ? LIMIT 1`, [userId]);
  // Retourne 0 par défaut si l'utilisateur n'est pas trouvé
  return rows[0]?.auto_validation ?? 0;
}

/**
 * Approuve un dépôt de façon atomique : mise à jour du statut, crédit du solde
 * et création de la transaction dans une seule transaction DB.
 *
 * Si l'une des opérations échoue, l'ensemble est annulé (ROLLBACK).
 *
 * @async
 * @param {number} id          - Identifiant du dépôt à approuver.
 * @param {number} userId      - Identifiant de l'agent qui approuve.
 * @param {number} compteId    - Identifiant du compte à créditer.
 * @param {number} montant     - Montant du dépôt.
 * @param {string} numeroCheque - Numéro du chèque (pour la description de transaction).
 * @returns {Promise<void>}
 */
export async function executeApprouvementDepotAtomique(id, userId, compteId, montant, numeroCheque) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE depots_cheques
       SET statut = 'APPROUVE', traite_le = NOW(), traite_par = ?
       WHERE id = ? AND statut = 'EN_ATTENTE'`,
      [userId, id]
    );

    await conn.query(
      "UPDATE comptes SET solde = solde + ? WHERE id = ?",
      [montant, compteId]
    );

    await conn.query(
      `INSERT INTO transactions (compte_id, type_transaction, description, montant, date_transaction, statut)
       VALUES (?, 'DEPOT', ?, ?, NOW(), 'TERMINEE')`,
      [compteId, `Dépôt chèque #${numeroCheque}`, montant]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
