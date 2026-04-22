/**
 * @fileoverview Couche d'accès aux données pour les virements bancaires.
 *
 * Ce module gère toutes les opérations SQL liées aux virements :
 *  - Consultation des virements (avec filtrage par utilisateur ou global pour admin)
 *  - Validation des comptes source/destination avant virement
 *  - Création d'enregistrements de virement
 *  - Mise à jour des soldes (débit source, crédit destination)
 *  - Insertion des transactions associées dans l'historique
 *
 * Deux types de virements sont supportés :
 *  - Virement interne : entre comptes du même utilisateur (par id de compte)
 *  - Virement externe : vers un compte identifié par ses coordonnées bancaires
 *
 * @module data/virements
 */

import db from "../db.js";

/**
 * Récupère la liste des virements selon les droits de l'utilisateur.
 *
 * Pour un utilisateur standard : retourne uniquement les virements impliquant
 * l'un de ses comptes (source ou destination), via la table utilisateurs_clients.
 * Pour un admin/modérateur : retourne tous les virements.
 * Un filtrage textuel optionnel est appliqué sur plusieurs champs.
 *
 * @async
 * @param {Object}  params          - Les paramètres de filtrage.
 * @param {number}  params.userId   - L'identifiant de l'utilisateur connecté.
 * @param {boolean} params.isAdmin  - true si ADMIN ou MODERATEUR (accès global).
 * @param {string}  params.search   - Terme de recherche optionnel.
 * @returns {Promise<Array>} Les virements correspondants, triés du plus récent au plus ancien.
 */
export async function findVirements({ userId, isAdmin, search }) {
  // Tableau des clauses WHERE et des paramètres correspondants (construits dynamiquement)
  const whereClauses = [];
  const params = [];

  // Restriction aux virements de l'utilisateur si ce n'est pas un admin/modérateur
  if (!isAdmin) {
    // Un utilisateur voit les virements où il est côté source OU côté destination
    whereClauses.push("(src_uc.utilisateur_id = ? OR dest_uc.utilisateur_id = ?)");
    params.push(userId, userId);
  }

  if (search) {
    const likeSearch = `%${search}%`;
    const numericSearch = Number(search);
    // Pour la recherche numérique (par id de virement, compte, etc.)
    const safeNumeric = Number.isNaN(numericSearch) ? null : numericSearch;

    // La recherche couvre : description, numéros de compte, noms des clients, email fictif, et id numérique
    whereClauses.push(
      `(
        v.description LIKE ?
        OR src.numero_compte LIKE ?
        OR dest.numero_compte LIKE ?
        OR CONCAT(src_client.prenom, ' ', src_client.nom) LIKE ?
        OR CONCAT(dest_client.prenom, ' ', dest_client.nom) LIKE ?
        OR src_client.email_fictif LIKE ?
        OR dest_client.email_fictif LIKE ?
        OR (? IS NOT NULL AND (v.id = ? OR src.id = ? OR dest.id = ?))
      )`
    );
    params.push(
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      likeSearch,
      safeNumeric,
      safeNumeric || 0,
      safeNumeric || 0,
      safeNumeric || 0
    );
  }

  // Construction de la clause WHERE finale (vide si admin sans filtre)
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // DISTINCT évite les doublons causés par les LEFT JOINs sur utilisateurs_clients
  // quand un client est lié à plusieurs utilisateurs
  const [rows] = await db.query(
    `SELECT DISTINCT
       v.id,
       v.compte_source_id,
       v.compte_destination_id,
       v.montant,
       v.description,
       v.date_virement,
       v.statut,
       src.numero_compte AS compte_source_numero,
       dest.numero_compte AS compte_destination_numero,
       src.type_compte AS compte_source_type,
       dest.type_compte AS compte_destination_type,
       CONCAT(src_client.prenom, ' ', src_client.nom) AS client_source_nom,
       CONCAT(dest_client.prenom, ' ', dest_client.nom) AS client_destination_nom
     FROM virements v
     JOIN comptes src ON src.id = v.compte_source_id
     JOIN comptes dest ON dest.id = v.compte_destination_id
     JOIN clients src_client ON src_client.id = src.client_id
     JOIN clients dest_client ON dest_client.id = dest.client_id
     LEFT JOIN utilisateurs_clients src_uc ON src_uc.client_id = src.client_id
     LEFT JOIN utilisateurs_clients dest_uc ON dest_uc.client_id = dest.client_id
     ${whereSql}
     ORDER BY v.date_virement DESC, v.id DESC`,
    params
  );

  return rows;
}

/**
 * Vérifie qu'un utilisateur est autorisé à utiliser un compte comme source de virement.
 *
 * Retourne les informations du compte (id, solde) si l'utilisateur en est
 * le propriétaire (via utilisateurs_clients). Utilisé pour les virements
 * initiés par un utilisateur standard.
 *
 * @async
 * @param {number} userId        - L'identifiant de l'utilisateur connecté.
 * @param {number} compteSourceId - L'identifiant du compte source demandé.
 * @returns {Promise<{id: number, solde: number}|null>} Le compte si autorisé, null sinon.
 */
export async function findAuthorizedSourceAccount(userId, compteSourceId) {
  const [rows] = await db.query(
    `SELECT co.id, co.solde
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ? AND co.id = ? AND co.est_actif = 1`,
    [userId, compteSourceId]
  );

  return rows[0] || null;
}

/**
 * Récupère un compte par son id avec son solde (sans vérification d'accès).
 *
 * Utilisé par les admins qui peuvent initier un virement depuis n'importe quel compte.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte.
 * @returns {Promise<{id: number, solde: number}|null>} Le compte ou null s'il n'existe pas.
 */
export async function findAccountById(compteId) {
  const [rows] = await db.query("SELECT id, solde FROM comptes WHERE id = ?", [compteId]);
  return rows[0] || null;
}

/**
 * Vérifie qu'un utilisateur est autorisé à utiliser un compte comme destination de virement.
 *
 * Un virement interne n'est autorisé que vers un compte appartenant au même utilisateur.
 * Cette vérification empêche les virements vers des comptes d'autres clients.
 *
 * @async
 * @param {number} userId              - L'identifiant de l'utilisateur connecté.
 * @param {number} compteDestinationId - L'identifiant du compte destination.
 * @returns {Promise<{id: number}|null>} L'id du compte si autorisé, null sinon.
 */
export async function findAuthorizedDestinationAccount(userId, compteDestinationId) {
  const [rows] = await db.query(
    `SELECT co.id
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ? AND co.id = ? AND co.est_actif = 1`,
    [userId, compteDestinationId]
  );

  return rows[0] || null;
}

/**
 * Recherche un compte par ses coordonnées bancaires complètes.
 *
 * Utilisé pour les virements externes : l'utilisateur fournit le numéro de compte,
 * le numéro d'institution, le numéro de transit et optionnellement le SWIFT/BIC
 * pour identifier le compte destinataire.
 *
 * Seuls les comptes actifs (est_actif = 1) sont retournés, car on ne peut pas
 * faire de virement vers un compte bloqué.
 *
 * @async
 * @param {Object}      params                   - Les coordonnées bancaires.
 * @param {string}      params.numeroCompte       - Numéro de compte formaté.
 * @param {string}      params.numeroInstitution  - Numéro d'institution bancaire.
 * @param {string}      params.numeroTransit      - Numéro de transit à 5 chiffres.
 * @param {string|null} params.swiftBic           - Code SWIFT/BIC (optionnel).
 * @returns {Promise<{id: number, solde: number}|null>} Le compte trouvé, ou null.
 */
export async function findAccountByCoords({ numeroCompte, numeroInstitution, numeroTransit, swiftBic }) {
  const [rows] = await db.query(
    `SELECT id, solde FROM comptes
     WHERE numero_compte = ?
       AND numero_institution = ?
       AND numero_transit = ?
       AND (? IS NULL OR swift_bic = ?)  -- SWIFT optionnel : ignoré si null
       AND est_actif = 1  -- Seuls les comptes actifs acceptent des virements
     `,
    [numeroCompte, numeroInstitution, numeroTransit, swiftBic || null, swiftBic || null]
  );
  return rows[0] || null;
}

/**
 * Insère un nouvel enregistrement de virement dans la table `virements`.
 *
 * Le statut est toujours 'ACCEPTE' à la création (les virements ne nécessitent
 * pas d'approbation contrairement aux dépôts et retraits).
 *
 * @async
 * @param {Object}      params                     - Les données du virement.
 * @param {number}      params.compteSourceId       - Identifiant du compte source.
 * @param {number}      params.compteDestinationId  - Identifiant du compte destination.
 * @param {number}      params.montant              - Montant du virement (positif).
 * @param {string|null} params.description          - Description optionnelle du virement.
 * @returns {Promise<import('mysql2').ResultSetHeader>} Résultat MySQL (contient insertId).
 */
export async function createVirementRecord({ compteSourceId, compteDestinationId, montant, description }) {
  const [result] = await db.query(
    `INSERT INTO virements (compte_source_id, compte_destination_id, montant, description, date_virement, statut)
     VALUES (?, ?, ?, ?, NOW(), 'ACCEPTE')`, // Horodatage et statut définis automatiquement
    [compteSourceId, compteDestinationId, montant, description || null]
  );

  return result;
}

/**
 * Décrémente le solde d'un compte (débit — opération de sortie d'argent).
 *
 * Utilisé lors de la création d'un virement pour débiter le compte source.
 * L'opération est directe (pas de vérification de solde suffisant ici —
 * cette vérification est faite dans le contrôleur avant d'appeler cette fonction).
 *
 * @async
 * @param {number} compteId - L'identifiant du compte à débiter.
 * @param {number} montant  - Le montant à soustraire (positif).
 * @returns {Promise<void>}
 */
export async function decrementAccountBalance(compteId, montant) {
  await db.query("UPDATE comptes SET solde = solde - ? WHERE id = ?", [montant, compteId]);
}

/**
 * Incrémente le solde d'un compte (crédit — opération d'entrée d'argent).
 *
 * Utilisé lors de la création d'un virement pour créditer le compte destination.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte à créditer.
 * @param {number} montant  - Le montant à ajouter (positif).
 * @returns {Promise<void>}
 */
export async function incrementAccountBalance(compteId, montant) {
  await db.query("UPDATE comptes SET solde = solde + ? WHERE id = ?", [montant, compteId]);
}

/**
 * Exécute un virement complet de façon atomique dans une transaction DB.
 *
 * Séquence :
 *  1. BEGIN TRANSACTION
 *  2. UPDATE atomique du solde source avec vérification (solde >= montant)
 *     — si affectedRows=0 → ROLLBACK + erreur SOLDE_INSUFFISANT
 *  3. Crédit du compte destination
 *  4. Insertion du virement (statut ACCEPTE)
 *  5. Insertion des deux transactions miroir
 *  6. COMMIT
 *
 * En cas d'erreur : ROLLBACK automatique, connexion libérée.
 *
 * @async
 * @param {Object}      params
 * @param {number}      params.compteSourceId
 * @param {number}      params.compteDestinationId
 * @param {number}      params.montant
 * @param {string|null} params.description
 * @param {string}      params.typeLabel  - "interne" | "externe" (pour la description auto)
 * @returns {Promise<number>} insertId du virement créé
 * @throws {Error} avec .code === "SOLDE_INSUFFISANT" si le solde est insuffisant au moment du débit
 */
export async function executeVirementAtomique({ compteSourceId, compteDestinationId, montant, description, typeLabel = "interne" }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Débit atomique : échoue si solde < montant (race condition impossible)
    const [debitResult] = await conn.query(
      "UPDATE comptes SET solde = solde - ? WHERE id = ? AND solde >= ? AND est_actif = 1",
      [montant, compteSourceId, montant]
    );
    if (debitResult.affectedRows === 0) {
      await conn.rollback();
      const err = new Error("Solde insuffisant");
      err.code = "SOLDE_INSUFFISANT";
      throw err;
    }

    // Crédit destination
    await conn.query(
      "UPDATE comptes SET solde = solde + ? WHERE id = ?",
      [montant, compteDestinationId]
    );

    // Enregistrement du virement
    const [virResult] = await conn.query(
      `INSERT INTO virements (compte_source_id, compte_destination_id, montant, description, date_virement, statut)
       VALUES (?, ?, ?, ?, NOW(), 'ACCEPTE')`,
      [compteSourceId, compteDestinationId, montant, description || null]
    );
    const virementId = virResult.insertId;

    // Transactions miroir (historique des comptes)
    const baseDesc = description || `Virement ${typeLabel} #${virementId}`;
    await conn.query(
      `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
       VALUES (?, 'VIREMENT', ?, ?, 'TERMINEE', NOW()),
              (?, 'VIREMENT', ?, ?, 'TERMINEE', NOW())`,
      [compteSourceId, `${baseDesc} (sortant)`, -montant,
       compteDestinationId, `${baseDesc} (entrant)`, montant]
    );

    await conn.commit();
    return virementId;
  } catch (err) {
    if (err.code !== "SOLDE_INSUFFISANT") {
      await conn.rollback();
    }
    throw err;
  } /* c8 ignore next */ finally {
    conn.release();
  }
}

