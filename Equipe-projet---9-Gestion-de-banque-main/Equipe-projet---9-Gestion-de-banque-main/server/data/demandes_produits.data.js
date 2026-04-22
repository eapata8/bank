/**
 * @fileoverview Couche d'accès aux données pour les demandes de produits financiers.
 *
 * Ce module gère toutes les opérations SQL liées aux demandes de produits :
 *  - Consultation des demandes (filtrée selon le rôle)
 *  - Création d'une demande (carte VISA/Mastercard ou compte CHEQUES/EPARGNE)
 *  - Vérification de doublon EN_ATTENTE
 *  - Mise à jour du statut (APPROUVEE / REFUSEE)
 *  - Auto-provisionnement du produit lors de l'approbation (transaction atomique)
 *
 * Flux de traitement :
 *  1. Client soumet une demande → statut EN_ATTENTE
 *  2a. Admin/modérateur approuve → produit créé (carte ou compte), statut APPROUVEE
 *  2b. Admin/modérateur refuse   → statut REFUSEE, aucun produit créé
 *
 * @module data/demandes_produits
 */

import db from "../db.js";

/**
 * Récupère la liste des demandes selon les droits.
 *
 * Pour un utilisateur standard : uniquement les demandes de ses clients.
 * Pour un admin/modérateur : toutes les demandes avec infos client.
 *
 * @async
 * @param {Object}  params            - Paramètres de filtrage.
 * @param {number}  params.userId     - Identifiant de l'utilisateur connecté.
 * @param {boolean} params.canReadAll - true si ADMIN ou MODERATEUR.
 * @returns {Promise<Array>} Les demandes enrichies, triées du plus récent.
 */
export async function findAllDemandes({ userId, canReadAll }) {
  const join = canReadAll
    ? ""
    : "JOIN utilisateurs_clients uc ON uc.client_id = dp.client_id AND uc.utilisateur_id = ?";

  const params = canReadAll ? [] : [userId];

  const [rows] = await db.query(
    `SELECT dp.*,
            c.prenom        AS client_prenom,
            c.nom           AS client_nom,
            c.email_fictif  AS client_email,
            CONCAT(u.prenom,' ',u.nom) AS traite_par_nom
     FROM demandes_produits dp
     JOIN clients c ON c.id = dp.client_id
     ${join}
     LEFT JOIN utilisateurs u ON u.id = dp.traite_par
     ORDER BY dp.cree_le DESC`,
    params
  );
  return rows;
}

/**
 * Récupère une demande spécifique par son identifiant avec infos enrichies.
 *
 * @async
 * @param {number} id - Identifiant de la demande.
 * @returns {Promise<object|null>} La demande enrichie, ou null si introuvable.
 */
export async function findDemandeById(id) {
  const [rows] = await db.query(
    `SELECT dp.*,
            c.prenom        AS client_prenom,
            c.nom           AS client_nom,
            c.email_fictif  AS client_email,
            CONCAT(u.prenom,' ',u.nom) AS traite_par_nom
     FROM demandes_produits dp
     JOIN clients c ON c.id = dp.client_id
     LEFT JOIN utilisateurs u ON u.id = dp.traite_par
     WHERE dp.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Vérifie si une demande EN_ATTENTE existe déjà pour ce client et ce type de produit.
 *
 * Utilisé pour prévenir les doublons : un client ne peut pas avoir deux demandes
 * EN_ATTENTE pour le même type de produit simultanément.
 *
 * @async
 * @param {number} client_id    - Identifiant du client.
 * @param {string} type_produit - Type de produit (CARTE_VISA, etc.).
 * @returns {Promise<boolean>} true si une demande EN_ATTENTE existe.
 */
export async function hasPendingDemande(client_id, type_produit) {
  const [rows] = await db.query(
    `SELECT 1 FROM demandes_produits
     WHERE client_id = ? AND type_produit = ? AND statut = 'EN_ATTENTE'
     LIMIT 1`,
    [client_id, type_produit]
  );
  return rows.length > 0;
}

/**
 * Crée une nouvelle demande de produit avec statut EN_ATTENTE.
 *
 * @async
 * @param {Object}      params              - Données de la demande.
 * @param {number}      params.client_id    - Identifiant du client.
 * @param {string}      params.type_produit - Type de produit demandé.
 * @param {string|null} params.notes        - Notes optionnelles du client.
 * @param {number|null} params.limite_credit - Limite souhaitée (cartes uniquement).
 * @returns {Promise<number>} L'identifiant auto-incrémenté de la demande créée.
 */
export async function createDemande({ client_id, type_produit, notes, limite_credit }) {
  const [result] = await db.query(
    `INSERT INTO demandes_produits (client_id, type_produit, notes, limite_credit)
     VALUES (?, ?, ?, ?)`,
    [client_id, type_produit, notes ?? null, limite_credit ?? null]
  );
  return result.insertId;
}

/**
 * Approuve une demande et crée le produit correspondant dans une transaction atomique.
 *
 * Pour CARTE_VISA / CARTE_MASTERCARD : insère une ligne dans cartes_credit.
 * Pour COMPTE_CHEQUES / COMPTE_EPARGNE : insère une ligne dans comptes.
 *
 * @async
 * @param {number} id         - Identifiant de la demande.
 * @param {number} traite_par - Identifiant de l'agent qui approuve.
 * @param {object} demande    - Objet demande complet (client_id, type_produit, limite_credit).
 * @returns {Promise<void>}
 */
export async function approuverDemande(id, traite_par, demande) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Mise à jour du statut de la demande
    await conn.query(
      `UPDATE demandes_produits
       SET statut = 'APPROUVEE', traite_par = ?, traite_le = NOW()
       WHERE id = ?`,
      [traite_par, id]
    );

    const { client_id, type_produit, limite_credit } = demande;

    if (type_produit === "CARTE_VISA" || type_produit === "CARTE_MASTERCARD") {
      // Génération du numéro de carte (même logique que cartes.controller.js)
      const rand4 = () => String(Math.floor(1000 + Math.random() * 9000));
      const prefix = type_produit === "CARTE_VISA" ? "4" : "5";
      const g1 = prefix + String(Math.floor(100 + Math.random() * 900));
      const g2 = rand4();
      const g3 = rand4();
      const g4 = rand4();
      const numeroCarte = `${g1} ${g2} ${g3} ${g4}`;
      const cvv = String(Math.floor(100 + Math.random() * 900));
      const typeCarte = type_produit === "CARTE_VISA" ? "VISA" : "MASTERCARD";
      const limite = limite_credit ?? 5000;

      // Date d'expiration : 3 ans à partir d'aujourd'hui
      const exp = new Date();
      exp.setFullYear(exp.getFullYear() + 3);
      const dateExp = exp.toISOString().slice(0, 10);

      await conn.query(
        `INSERT INTO cartes_credit
           (client_id, numero_compte, type_carte, limite_credit, solde_utilise, cvv, date_expiration, statut)
         VALUES (?, ?, ?, ?, 0, ?, ?, 'ACTIVE')`,
        [client_id, numeroCarte, typeCarte, limite, cvv, dateExp]
      );
    } else {
      // COMPTE_CHEQUES ou COMPTE_EPARGNE — format identique à comptes.controller.js
      // numero_compte : "XXXX XXXX XXXX" (3 groupes de 4 chiffres)
      const typeCompte = type_produit === "COMPTE_CHEQUES" ? "CHEQUES" : "EPARGNE";
      const rand4c = () => String(Math.floor(1000 + Math.random() * 9000));
      const numeroCompte = `${rand4c()} ${rand4c()} ${rand4c()}`;
      const numeroTransit = String(Math.floor(10000 + Math.random() * 90000));

      await conn.query(
        `INSERT INTO comptes
           (client_id, type_compte, numero_compte, numero_institution, numero_transit, swift_bic, solde, devise)
         VALUES (?, ?, ?, '621', ?, 'NXBKCA2TXXX', 0, 'CAD')`,
        [client_id, typeCompte, numeroCompte, numeroTransit]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Vérifie si un utilisateur est propriétaire d'une demande (via utilisateurs_clients).
 *
 * @async
 * @param {number} demandeId - Identifiant de la demande.
 * @param {number} userId    - Identifiant de l'utilisateur.
 * @returns {Promise<boolean>} true si l'utilisateur est lié au client de la demande.
 */
export async function isDemandeOwner(demandeId, userId) {
  const [rows] = await db.query(
    `SELECT 1 FROM demandes_produits dp
     JOIN utilisateurs_clients uc ON uc.client_id = dp.client_id
     WHERE dp.id = ? AND uc.utilisateur_id = ?
     LIMIT 1`,
    [demandeId, userId]
  );
  return rows.length > 0;
}

/**
 * Supprime une demande EN_ATTENTE (annulation par le client).
 *
 * @async
 * @param {number} id - Identifiant de la demande à supprimer.
 * @returns {Promise<number>} Nombre de lignes supprimées (0 si déjà traitée).
 */
export async function annulerDemande(id) {
  const [result] = await db.query(
    `DELETE FROM demandes_produits
     WHERE id = ? AND statut = 'EN_ATTENTE'`,
    [id]
  );
  return result.affectedRows;
}

/**
 * Vérifie si l'auto-validation est activée pour un utilisateur.
 *
 * Lorsque auto_validation = 1, les demandes de produits soumises par cet
 * utilisateur sont approuvées automatiquement (produit créé) sans
 * intervention d'un modérateur.
 *
 * @async
 * @param {number} userId - Identifiant de l'utilisateur.
 * @returns {Promise<number>} 1 si auto-validation activée, 0 sinon.
 */
export async function findUserAutoValidation(userId) {
  const [rows] = await db.query(
    `SELECT auto_validation FROM utilisateurs WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0]?.auto_validation ?? 0;
}

/**
 * Refuse une demande en attente.
 *
 * @async
 * @param {number}      id         - Identifiant de la demande.
 * @param {number}      traite_par - Identifiant de l'agent qui refuse.
 * @param {string|null} notes      - Motif du refus (optionnel).
 * @returns {Promise<void>}
 */
export async function refuserDemande(id, traite_par, notes) {
  await db.query(
    `UPDATE demandes_produits
     SET statut = 'REFUSEE', traite_par = ?, traite_le = NOW(), notes = COALESCE(?, notes)
     WHERE id = ?`,
    [traite_par, notes ?? null, id]
  );
}
