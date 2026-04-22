/**
 * @fileoverview Couche d'accès aux données pour les virements Interac e-Transfer.
 *
 * Gère toutes les opérations SQL liées aux virements par courriel :
 *  - Auto-dépôt direct (activation immédiate sur l'email fourni, sans code)
 *  - Création, acceptation, annulation et expiration des transferts
 *  - Vérification des limites quotidiennes et mensuelles
 *  - Mise à jour des soldes et transactions dans l'historique
 *
 * Limites Interac Canada (2024) :
 *  - Minimum par transfert  : 0,50 $ CAD
 *  - Maximum par transfert  : 3 000 $ CAD
 *  - Limite quotidienne     : 3 000 $ CAD
 *  - Limite mensuelle       : 10 000 $ CAD
 *  - Expiration             : 30 jours sans réclamation
 *
 * @module data/interac
 */

import db from "../db.js";

/* ─────────────────────────────────────────────────────────────
   CONSTANTES — Limites Interac (miroir des vraies règles 2024)
───────────────────────────────────────────────────────────── */

/** Montant minimum par transfert individuel (0,50 $). */
export const INTERAC_MIN_PAR_TRANSFERT = 0.5;

/** Limite d'envoi sur 24 heures (3 000 $). */
export const INTERAC_LIMITE_QUOTIDIENNE = 3000;

/** Limite d'envoi sur 7 jours glissants (10 000 $). */
export const INTERAC_LIMITE_7_JOURS = 10000;

/** Limite d'envoi sur 30 jours glissants (20 000 $). */
export const INTERAC_LIMITE_30_JOURS = 20000;

/** Alias maintenu pour compatibilité — même valeur que INTERAC_LIMITE_30_JOURS. */
export const INTERAC_LIMITE_MENSUELLE = 20000;

/** Délai d'expiration d'un transfert en attente (30 jours). */
export const INTERAC_EXPIRATION_JOURS = 30;

/** Durée de validité du code de confirmation auto-dépôt (en minutes). */
export const INTERAC_TOKEN_EXPIRATION_MINUTES = 15;

/* ─────────────────────────────────────────────────────────────
   AUTO-DÉPÔT
───────────────────────────────────────────────────────────── */

/**
 * Récupère le profil d'auto-dépôt d'un utilisateur (tous statuts).
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur.
 * @returns {Promise<Object|null>} Le profil ou null s'il n'existe pas.
 */
export async function findAutoDeposit(utilisateurId) {
  const [rows] = await db.query(
    `SELECT ia.id, ia.utilisateur_id, ia.email_interac, ia.compte_depot_id,
            ia.statut, ia.token_expire_le,
            ia.cree_le, ia.modifie_le,
            c.numero_compte, c.type_compte, c.solde
     FROM interac_autodeposit ia
     JOIN comptes c ON c.id = ia.compte_depot_id
     WHERE ia.utilisateur_id = ?`,
    [utilisateurId]
  );
  return rows[0] || null;
}

/**
 * Recherche un profil d'auto-dépôt ACTIF par adresse email.
 * Utilisé lors de l'envoi pour détecter si le destinataire bénéficie de l'auto-dépôt.
 *
 * @async
 * @param {string} email - L'adresse email Interac (normalisée en minuscules).
 * @returns {Promise<{utilisateur_id: number, compte_depot_id: number}|null>}
 */
export async function findActiveAutoDepositByEmail(email) {
  const [rows] = await db.query(
    `SELECT ia.utilisateur_id, ia.compte_depot_id, ia.email_interac,
            c.solde, c.est_actif AS compte_actif
     FROM interac_autodeposit ia
     JOIN comptes c ON c.id = ia.compte_depot_id
     WHERE ia.email_interac = ?
       AND ia.statut = 'ACTIVE'
       AND c.est_actif = 1`,
    [email]
  );
  return rows[0] || null;
}

/**
 * Active directement l'auto-dépôt d'un utilisateur (sans code de vérification).
 * Crée le profil s'il n'existe pas, ou met à jour le profil existant vers ACTIVE.
 *
 * @async
 * @param {Object} params
 * @param {number} params.utilisateurId   - L'identifiant de l'utilisateur.
 * @param {string} params.emailInterac    - L'adresse email Interac choisie.
 * @param {number} params.compteDepotId   - Le compte de réception par défaut.
 * @returns {Promise<import('mysql2').ResultSetHeader>}
 */
export async function activerAutoDepositDirectement({ utilisateurId, emailInterac, compteDepotId }) {
  const [result] = await db.query(
    `INSERT INTO interac_autodeposit
       (utilisateur_id, email_interac, compte_depot_id, statut, token_verification, token_expire_le)
     VALUES (?, ?, ?, 'ACTIVE', NULL, NULL)
     ON DUPLICATE KEY UPDATE
       email_interac      = VALUES(email_interac),
       compte_depot_id    = VALUES(compte_depot_id),
       statut             = 'ACTIVE',
       token_verification = NULL,
       token_expire_le    = NULL`,
    [utilisateurId, emailInterac, compteDepotId]
  );
  return result;
}

/**
 * Désactive (soft-delete) le profil d'auto-dépôt d'un utilisateur.
 * Remet le statut à EN_ATTENTE pour invalider la réception automatique.
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur.
 * @returns {Promise<void>}
 */
export async function deactivateAutoDeposit(utilisateurId) {
  await db.query(
    `UPDATE interac_autodeposit
     SET statut = 'EN_ATTENTE',
         token_verification = NULL,
         token_expire_le = NULL
     WHERE utilisateur_id = ?`,
    [utilisateurId]
  );
}

/* ─────────────────────────────────────────────────────────────
   LIMITES D'ENVOI
───────────────────────────────────────────────────────────── */

/**
 * Calcule le total envoyé aujourd'hui par un utilisateur.
 * Ne compte que les statuts EN_ATTENTE et ACCEPTEE (les annulés/expirés ne comptent pas).
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur.
 * @returns {Promise<number>} Montant total envoyé aujourd'hui en CAD.
 */
export async function getTotalEnvoyeAujourdhui(utilisateurId) {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(montant), 0) AS total
     FROM interac_transferts
     WHERE expediteur_id = ?
       AND statut IN ('EN_ATTENTE', 'ACCEPTEE')
       AND DATE(date_envoi) = CURDATE()`,
    [utilisateurId]
  );
  return Number(rows[0].total);
}

/**
 * Calcule le total envoyé sur les 7 derniers jours glissants par un utilisateur.
 * Ne compte que les statuts EN_ATTENTE et ACCEPTEE.
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur.
 * @returns {Promise<number>} Montant total envoyé sur 7 jours en CAD.
 */
export async function getTotalEnvoye7Jours(utilisateurId) {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(montant), 0) AS total
     FROM interac_transferts
     WHERE expediteur_id = ?
       AND statut IN ('EN_ATTENTE', 'ACCEPTEE')
       AND date_envoi >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [utilisateurId]
  );
  return Number(rows[0].total);
}

/**
 * Calcule le total envoyé sur les 30 derniers jours glissants par un utilisateur.
 * Ne compte que les statuts EN_ATTENTE et ACCEPTEE.
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur.
 * @returns {Promise<number>} Montant total envoyé sur 30 jours en CAD.
 */
export async function getTotalEnvoye30Jours(utilisateurId) {
  const [rows] = await db.query(
    `SELECT COALESCE(SUM(montant), 0) AS total
     FROM interac_transferts
     WHERE expediteur_id = ?
       AND statut IN ('EN_ATTENTE', 'ACCEPTEE')
       AND date_envoi >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [utilisateurId]
  );
  return Number(rows[0].total);
}

/** Alias maintenu pour compatibilité. */
export const getTotalEnvoyeCeMois = getTotalEnvoye30Jours;

/* ─────────────────────────────────────────────────────────────
   CONSULTATION DES TRANSFERTS
───────────────────────────────────────────────────────────── */

/**
 * Récupère les transferts visibles par un utilisateur.
 * Admin/modérateur : tous les transferts avec filtre optionnel.
 * Utilisateur standard : transferts envoyés + reçus sur ses comptes.
 *
 * @async
 * @param {Object}  params
 * @param {number}  params.userId   - L'identifiant de l'utilisateur connecté.
 * @param {boolean} params.isAdmin  - true si ADMIN ou MODERATEUR.
 * @param {string}  params.search   - Terme de recherche optionnel.
 * @returns {Promise<Array>} Liste des transferts triés par date décroissante.
 */
export async function findInteracTransferts({ userId, isAdmin, search }) {
  const whereClauses = [];
  const params = [];

  if (!isAdmin) {
    whereClauses.push("(it.expediteur_id = ? OR dest_uc.utilisateur_id = ?)");
    params.push(userId, userId);
  }

  if (search) {
    const likeSearch = `%${search}%`;
    const numericSearch = Number(search);
    const safeNumeric = Number.isNaN(numericSearch) ? null : numericSearch;
    whereClauses.push(
      `(it.email_destinataire LIKE ?
        OR it.description LIKE ?
        OR CONCAT(exp_u.prenom, ' ', exp_u.nom) LIKE ?
        OR (? IS NOT NULL AND it.id = ?))`
    );
    params.push(likeSearch, likeSearch, likeSearch, safeNumeric, safeNumeric || 0);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT DISTINCT
       it.id,
       it.expediteur_id,
       it.compte_source_id,
       it.email_destinataire,
       it.montant,
       it.description,
       it.statut,
       it.compte_destination_id,
       it.date_envoi,
       it.date_expiration,
       it.date_traitement,
       CONCAT(exp_u.prenom, ' ', exp_u.nom) AS expediteur_nom,
       exp_u.email                           AS expediteur_email,
       src.numero_compte                     AS compte_source_numero,
       src.type_compte                       AS compte_source_type,
       dest.numero_compte                    AS compte_destination_numero,
       dest.type_compte                      AS compte_destination_type
     FROM interac_transferts it
     JOIN utilisateurs exp_u ON exp_u.id = it.expediteur_id
     JOIN comptes src ON src.id = it.compte_source_id
     LEFT JOIN comptes dest ON dest.id = it.compte_destination_id
     LEFT JOIN utilisateurs_clients dest_uc ON dest_uc.client_id = dest.client_id
     ${whereSql}
     ORDER BY it.date_envoi DESC, it.id DESC`,
    params
  );
  return rows;
}

/**
 * Récupère les transferts EN_ATTENTE destinés à un utilisateur.
 * Filtre par email de connexion et email Interac enregistré.
 * N'inclut que les transferts non expirés.
 *
 * @async
 * @param {string}      emailUtilisateur - Email de connexion de l'utilisateur.
 * @param {string|null} emailInterac     - Email Interac actif, ou null.
 * @returns {Promise<Array>}
 */
export async function findTransfertsEnAttentePourDestinataire(emailUtilisateur, emailInterac) {
  const emails = [emailUtilisateur.toLowerCase()];
  if (emailInterac && emailInterac.toLowerCase() !== emailUtilisateur.toLowerCase()) {
    emails.push(emailInterac.toLowerCase());
  }
  const placeholders = emails.map(() => "?").join(", ");

  const [rows] = await db.query(
    `SELECT it.id,
            it.expediteur_id,
            it.email_destinataire,
            it.montant,
            it.description,
            it.date_envoi,
            it.date_expiration,
            CONCAT(u.prenom, ' ', u.nom) AS expediteur_nom,
            u.email                       AS expediteur_email
     FROM interac_transferts it
     JOIN utilisateurs u ON u.id = it.expediteur_id
     WHERE it.email_destinataire IN (${placeholders})
       AND it.statut = 'EN_ATTENTE'
       AND it.date_expiration > NOW()
     ORDER BY it.date_envoi DESC`,
    emails
  );
  return rows;
}

/**
 * Récupère un transfert par son identifiant.
 *
 * @async
 * @param {number} id - L'identifiant du transfert.
 * @returns {Promise<Object|null>}
 */
export async function findTransfertById(id) {
  const [rows] = await db.query(
    "SELECT * FROM interac_transferts WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

/* ─────────────────────────────────────────────────────────────
   CRÉATION D'UN TRANSFERT
───────────────────────────────────────────────────────────── */

/**
 * Insère un nouveau transfert Interac dans la base de données.
 * La date d'expiration est calculée automatiquement (date_envoi + 30 jours).
 *
 * @async
 * @param {Object}      params
 * @param {number}      params.expediteurId        - Utilisateur expéditeur.
 * @param {number}      params.compteSourceId       - Compte débité.
 * @param {string}      params.emailDestinataire    - Email du destinataire (normalisé).
 * @param {number}      params.montant              - Montant en CAD.
 * @param {string|null} params.description          - Message optionnel.
 * @param {string|null} params.motDePasseHash       - Hash bcrypt, ou null (auto-dépôt).
 * @param {number|null} params.compteDestinationId  - Compte destination si auto-dépôt immédiat.
 * @param {string}      params.statut               - 'EN_ATTENTE' ou 'ACCEPTEE'.
 * @returns {Promise<import('mysql2').ResultSetHeader>}
 */
export async function createInteracTransfert({
  expediteurId,
  compteSourceId,
  emailDestinataire,
  montant,
  description,
  motDePasseHash,
  compteDestinationId,
  statut,
}) {
  const dateTraitement = statut === "ACCEPTEE" ? "NOW()" : "NULL";
  const [result] = await db.query(
    `INSERT INTO interac_transferts
       (expediteur_id, compte_source_id, email_destinataire, montant, description,
        mot_de_passe_hash, statut, compte_destination_id,
        date_envoi, date_expiration, date_traitement)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?,
             NOW(),
             DATE_ADD(NOW(), INTERVAL ${INTERAC_EXPIRATION_JOURS} DAY),
             ${dateTraitement})`,
    [
      expediteurId, compteSourceId, emailDestinataire, montant,
      description || null, motDePasseHash || null, statut,
      compteDestinationId || null,
    ]
  );
  return result;
}

/* ─────────────────────────────────────────────────────────────
   MISE À JOUR DU STATUT
───────────────────────────────────────────────────────────── */

/**
 * Marque un transfert comme ACCEPTEE et enregistre le compte destination.
 * Utilise une condition WHERE sur le statut pour éviter les doubles acceptations.
 *
 * @async
 * @param {number} transfertId         - L'identifiant du transfert.
 * @param {number} compteDestinationId - Compte qui reçoit les fonds.
 * @returns {Promise<void>}
 */
export async function accepterTransfert(transfertId, compteDestinationId) {
  await db.query(
    `UPDATE interac_transferts
     SET statut = 'ACCEPTEE',
         compte_destination_id = ?,
         date_traitement = NOW()
     WHERE id = ? AND statut = 'EN_ATTENTE'`,
    [compteDestinationId, transfertId]
  );
}

/**
 * Marque un transfert comme ANNULEE.
 * Utilise une condition WHERE sur le statut pour idempotence.
 *
 * @async
 * @param {number} transfertId - L'identifiant du transfert.
 * @returns {Promise<void>}
 */
export async function annulerTransfert(transfertId) {
  await db.query(
    `UPDATE interac_transferts
     SET statut = 'ANNULEE', date_traitement = NOW()
     WHERE id = ? AND statut = 'EN_ATTENTE'`,
    [transfertId]
  );
}

/**
 * Expire les transferts EN_ATTENTE dont la date d'expiration est dépassée.
 * Retourne la liste des transferts expirés pour que le contrôleur puisse
 * rembourser les comptes source.
 *
 * @async
 * @returns {Promise<Array<{id: number, compte_source_id: number, montant: number}>>}
 */
export async function expireTransfertsExpires() {
  const [toExpire] = await db.query(
    `SELECT id, compte_source_id, montant
     FROM interac_transferts
     WHERE statut = 'EN_ATTENTE' AND date_expiration <= NOW()`
  );

  if (toExpire.length > 0) {
    const ids = toExpire.map((t) => t.id);
    await db.query(
      `UPDATE interac_transferts
       SET statut = 'EXPIREE', date_traitement = NOW()
       WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
  }

  return toExpire;
}

/* ─────────────────────────────────────────────────────────────
   OPÉRATIONS SUR LES SOLDES
───────────────────────────────────────────────────────────── */

/**
 * Décrémente le solde d'un compte (débit — réservation de fonds à l'envoi Interac).
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
 * Incrémente le solde d'un compte (crédit — réception de fonds Interac).
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
 * Vérifie qu'un utilisateur possède un compte actif via utilisateurs_clients.
 *
 * @async
 * @param {number} userId   - L'identifiant de l'utilisateur.
 * @param {number} compteId - L'identifiant du compte.
 * @returns {Promise<{id: number, solde: number, est_actif: number}|null>}
 */
export async function findAuthorizedAccount(userId, compteId) {
  const [rows] = await db.query(
    `SELECT co.id, co.solde, co.est_actif
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ? AND co.id = ? AND co.est_actif = 1`,
    [userId, compteId]
  );
  return rows[0] || null;
}

/* ─────────────────────────────────────────────────────────────
   TRANSACTIONS (historique des comptes)
───────────────────────────────────────────────────────────── */

/**
 * Insère une transaction de type VIREMENT dans l'historique d'un compte.
 * Le montant est positif pour une réception, négatif pour un envoi.
 *
 * @async
 * @param {Object} params
 * @param {number} params.compteId    - Le compte concerné.
 * @param {number} params.montant     - Montant (positif = crédit, négatif = débit).
 * @param {string} params.description - Description lisible.
 * @returns {Promise<void>}
 */
export async function createInteracTransaction({ compteId, montant, description }) {
  await db.query(
    `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
     VALUES (?, 'VIREMENT', ?, ?, 'TERMINEE', NOW())`,
    [compteId, description, montant]
  );
}

/* ─────────────────────────────────────────────────────────────
   ADMINISTRATION — Interac par client
───────────────────────────────────────────────────────────── */

/**
 * Récupère tous les transferts Interac liés aux comptes d'un client (envoyés + reçus).
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<Array>}
 */
export async function findTransfertsParClient(clientId) {
  const [rows] = await db.query(
    `SELECT DISTINCT
       it.id, it.expediteur_id, it.compte_source_id, it.email_destinataire,
       it.montant, it.description, it.statut, it.compte_destination_id,
       it.date_envoi, it.date_expiration, it.date_traitement,
       CONCAT(exp_u.prenom, ' ', exp_u.nom) AS expediteur_nom,
       exp_u.email                           AS expediteur_email,
       src.numero_compte                     AS compte_source_numero,
       src.type_compte                       AS compte_source_type,
       dest.numero_compte                    AS compte_destination_numero,
       dest.type_compte                      AS compte_destination_type
     FROM interac_transferts it
     JOIN comptes src     ON src.id  = it.compte_source_id
     JOIN utilisateurs exp_u ON exp_u.id = it.expediteur_id
     LEFT JOIN comptes dest ON dest.id = it.compte_destination_id
     WHERE src.client_id = ?
        OR (dest.id IS NOT NULL AND dest.client_id = ?)
     ORDER BY it.date_envoi DESC, it.id DESC`,
    [clientId, clientId]
  );
  return rows;
}

/**
 * Récupère le profil d'auto-dépôt de l'utilisateur associé à un client.
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<Object|null>}
 */
export async function findAutoDepositParClient(clientId) {
  const [rows] = await db.query(
    `SELECT ia.id, ia.utilisateur_id, ia.email_interac, ia.compte_depot_id,
            ia.statut, ia.cree_le, ia.modifie_le,
            u.email AS utilisateur_email,
            CONCAT(u.prenom, ' ', u.nom) AS utilisateur_nom,
            c.numero_compte, c.type_compte
     FROM interac_autodeposit ia
     JOIN utilisateurs u ON u.id = ia.utilisateur_id
     JOIN utilisateurs_clients uc ON uc.utilisateur_id = u.id
     JOIN comptes c ON c.id = ia.compte_depot_id
     WHERE uc.client_id = ?
     LIMIT 1`,
    [clientId]
  );
  return rows[0] || null;
}

/**
 * Calcule les totaux envoyés (24h / 7j / 30j) par le client via ses comptes.
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<{total_24h: number, total_7j: number, total_30j: number, nb_en_attente: number}>}
 */
export async function getStatsInteracParClient(clientId) {
  const [rows] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE(it.date_envoi) = CURDATE()
                         AND it.statut IN ('EN_ATTENTE','ACCEPTEE') THEN it.montant ELSE 0 END), 0) AS total_24h,
       COALESCE(SUM(CASE WHEN it.date_envoi >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                         AND it.statut IN ('EN_ATTENTE','ACCEPTEE') THEN it.montant ELSE 0 END), 0) AS total_7j,
       COALESCE(SUM(CASE WHEN it.date_envoi >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                         AND it.statut IN ('EN_ATTENTE','ACCEPTEE') THEN it.montant ELSE 0 END), 0) AS total_30j,
       COUNT(CASE WHEN it.statut = 'EN_ATTENTE' THEN 1 END) AS nb_en_attente
     FROM interac_transferts it
     JOIN comptes src ON src.id = it.compte_source_id
     WHERE src.client_id = ?`,
    [clientId]
  );
  return rows[0];
}

/**
 * Récupère l'utilisateur_id rattaché à un client (lecture seule).
 *
 * Utile en amont d'une écriture sensible pour vérifier l'existence sans déclencher de mutation.
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<number|null>} L'identifiant de l'utilisateur ou null si introuvable.
 */
export async function findUserIdByClientId(clientId) {
  const [rows] = await db.query(
    "SELECT utilisateur_id FROM utilisateurs_clients WHERE client_id = ? LIMIT 1",
    [clientId]
  );
  return rows[0] ? rows[0].utilisateur_id : null;
}

/**
 * Force l'activation de l'auto-dépôt pour le client (sans token, bypass admin).
 * Crée ou met à jour le profil directement en ACTIVE.
 *
 * @async
 * @param {number} clientId       - L'identifiant du client.
 * @param {string} emailInterac   - Email Interac à enregistrer.
 * @param {number} compteDepotId  - Compte de dépôt cible.
 * @returns {Promise<number|null>} userId si succès, null si aucun utilisateur trouvé.
 */
export async function forceActiverAutoDepositParClient(clientId, emailInterac, compteDepotId) {
  const userId = await findUserIdByClientId(clientId);
  if (!userId) return null;

  await db.query(
    `INSERT INTO interac_autodeposit
       (utilisateur_id, email_interac, compte_depot_id, statut)
     VALUES (?, ?, ?, 'ACTIVE')
     ON DUPLICATE KEY UPDATE
       email_interac      = VALUES(email_interac),
       compte_depot_id    = VALUES(compte_depot_id),
       statut             = 'ACTIVE',
       token_verification = NULL,
       token_expire_le    = NULL`,
    [userId, emailInterac.toLowerCase().trim(), compteDepotId]
  );
  return userId;
}

/**
 * Désactive l'auto-dépôt du client (via son utilisateur_id).
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<void>}
 */
export async function desactiverAutoDepositParClient(clientId) {
  const [ucRows] = await db.query(
    "SELECT utilisateur_id FROM utilisateurs_clients WHERE client_id = ? LIMIT 1",
    [clientId]
  );
  if (!ucRows[0]) return;
  await deactivateAutoDeposit(ucRows[0].utilisateur_id);
}

/**
 * Récupère les limites Interac personnalisées d'un client.
 * Retourne null pour chaque champ si aucune personnalisation (= valeur globale en vigueur).
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<{limite_24h: number|null, limite_7j: number|null, limite_30j: number|null}|null>}
 */
export async function getLimitesInteracParClient(clientId) {
  const [rows] = await db.query(
    `SELECT u.interac_limite_24h AS limite_24h,
            u.interac_limite_7j  AS limite_7j,
            u.interac_limite_30j AS limite_30j
     FROM utilisateurs u
     JOIN utilisateurs_clients uc ON uc.utilisateur_id = u.id
     WHERE uc.client_id = ?
     LIMIT 1`,
    [clientId]
  );
  return rows[0] || null;
}

/**
 * Définit des limites Interac personnalisées pour un client.
 * Passer null pour un champ revient à supprimer la personnalisation (retour aux valeurs globales).
 *
 * @async
 * @param {number}      clientId
 * @param {Object}      limites
 * @param {number|null} limites.limite_24h
 * @param {number|null} limites.limite_7j
 * @param {number|null} limites.limite_30j
 * @returns {Promise<boolean>} true si l'utilisateur a été trouvé et mis à jour.
 */
export async function setLimitesInteracParClient(clientId, { limite_24h, limite_7j, limite_30j }) {
  const [ucRows] = await db.query(
    "SELECT utilisateur_id FROM utilisateurs_clients WHERE client_id = ? LIMIT 1",
    [clientId]
  );
  if (!ucRows[0]) return false;
  const userId = ucRows[0].utilisateur_id;
  await db.query(
    `UPDATE utilisateurs
     SET interac_limite_24h = ?,
         interac_limite_7j  = ?,
         interac_limite_30j = ?
     WHERE id = ?`,
    [
      limite_24h !== undefined ? limite_24h : null,
      limite_7j  !== undefined ? limite_7j  : null,
      limite_30j !== undefined ? limite_30j : null,
      userId,
    ]
  );
  return true;
}

/**
 * Récupère les limites Interac personnalisées d'un utilisateur (par son id direct).
 * Retourne null pour chaque champ si aucune personnalisation (= valeur globale en vigueur).
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur.
 * @returns {Promise<{limite_24h: number|null, limite_7j: number|null, limite_30j: number|null}>}
 */
export async function getLimitesInteracParUtilisateur(utilisateurId) {
  const [rows] = await db.query(
    `SELECT interac_limite_24h AS limite_24h,
            interac_limite_7j  AS limite_7j,
            interac_limite_30j AS limite_30j
     FROM utilisateurs
     WHERE id = ?`,
    [utilisateurId]
  );
  return rows[0] ?? { limite_24h: null, limite_7j: null, limite_30j: null };
}
