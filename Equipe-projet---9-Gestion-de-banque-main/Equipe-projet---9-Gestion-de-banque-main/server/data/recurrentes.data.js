/**
 * @fileoverview Couche d'accès aux données pour les transactions récurrentes planifiées.
 *
 * Ce module gère toutes les opérations SQL liées aux virements récurrents :
 *  - Consultation des transactions planifiées (par utilisateur ou globalement)
 *  - Création d'une nouvelle récurrente
 *  - Mise à jour du statut (suspension, reprise, annulation)
 *  - Récupération des récurrentes échues pour le scheduler
 *  - Mise à jour après exécution (dates, compteur d'échecs)
 *
 * @module data/recurrentes
 */

import db from "../db.js";

/**
 * Récupère la liste des transactions récurrentes selon les droits de l'utilisateur.
 *
 * Pour un utilisateur standard : uniquement ses propres récurrentes.
 * Pour un admin : toutes les récurrentes du système.
 *
 * @async
 * @param {Object}  params         - Paramètres de requête.
 * @param {number}  params.userId  - Identifiant de l'utilisateur connecté.
 * @param {boolean} params.isAdmin - true si ADMIN (accès global).
 * @returns {Promise<Array>} Les récurrentes avec infos des comptes et clients.
 */
export async function findRecurrentes({ userId, isAdmin }) {
  const whereSql = isAdmin ? "" : "WHERE tr.utilisateur_id = ?";
  const params = isAdmin ? [] : [userId];

  const [rows] = await db.query(
    `SELECT
       tr.id,
       tr.utilisateur_id,
       tr.compte_source_id,
       tr.compte_destination_id,
       tr.montant,
       tr.description,
       tr.frequence,
       tr.prochaine_execution,
       tr.derniere_execution,
       tr.date_fin,
       tr.nb_echecs,
       tr.statut,
       tr.cree_le,
       src.numero_compte AS compte_source_numero,
       src.type_compte   AS compte_source_type,
       dest.numero_compte AS compte_destination_numero,
       dest.type_compte   AS compte_destination_type,
       CONCAT(src_client.prenom, ' ', src_client.nom)  AS client_nom,
       CONCAT(dest_client.prenom, ' ', dest_client.nom) AS client_destination_nom
     FROM transactions_recurrentes tr
     JOIN comptes src       ON src.id  = tr.compte_source_id
     JOIN comptes dest      ON dest.id = tr.compte_destination_id
     JOIN clients src_client  ON src_client.id  = src.client_id
     JOIN clients dest_client ON dest_client.id = dest.client_id
     ${whereSql}
     ORDER BY tr.cree_le DESC`,
    params
  );

  return rows;
}

/**
 * Récupère une transaction récurrente par son identifiant.
 *
 * @async
 * @param {number} id - Identifiant de la récurrente.
 * @returns {Promise<Object|null>} La récurrente ou null si introuvable.
 */
export async function findRecurrenteById(id) {
  const [rows] = await db.query(
    "SELECT * FROM transactions_recurrentes WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

/**
 * Insère une nouvelle transaction récurrente en base.
 *
 * @async
 * @param {Object}      params                       - Données de la récurrente.
 * @param {number}      params.utilisateurId          - Propriétaire de la récurrente.
 * @param {number}      params.compteSourceId         - Compte source (débit).
 * @param {number}      params.compteDestinationId    - Compte destination (crédit).
 * @param {number}      params.montant                - Montant par exécution.
 * @param {string|null} params.description            - Description optionnelle.
 * @param {string}      params.frequence              - HEBDOMADAIRE | MENSUEL | ANNUEL
 * @param {string}      params.prochaineExecution     - Date ISO de la première exécution (YYYY-MM-DD).
 * @param {string|null} params.dateFin                - Date de fin optionnelle (YYYY-MM-DD).
 * @returns {Promise<import('mysql2').ResultSetHeader>} Résultat MySQL (insertId).
 */
export async function createRecurrente({
  utilisateurId,
  compteSourceId,
  compteDestinationId,
  montant,
  description,
  frequence,
  prochaineExecution,
  dateFin,
}) {
  const [result] = await db.query(
    `INSERT INTO transactions_recurrentes
       (utilisateur_id, compte_source_id, compte_destination_id, montant, description, frequence, prochaine_execution, date_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      utilisateurId,
      compteSourceId,
      compteDestinationId,
      montant,
      description || null,
      frequence,
      prochaineExecution,
      dateFin || null,
    ]
  );
  return result;
}

/**
 * Recherche un compte par son numéro (pour valider un destinataire).
 *
 * Retourne uniquement les informations non-sensibles : id, type et nom du client.
 * Le solde et les autres données privées ne sont jamais exposés.
 *
 * @async
 * @param {string} numero - Numéro de compte à rechercher.
 * @returns {Promise<{id, type_compte, client_nom}|null>}
 */
export async function findCompteByNumero(numero) {
  const [rows] = await db.query(
    `SELECT co.id, co.type_compte, co.est_actif,
            CONCAT(c.prenom, ' ', c.nom) AS client_nom
     FROM comptes co
     JOIN clients c ON c.id = co.client_id
     WHERE co.numero_compte = ?`,
    [numero]
  );
  return rows[0] || null;
}

/**
 * Met à jour le statut d'une transaction récurrente.
 *
 * @async
 * @param {number} id     - Identifiant de la récurrente.
 * @param {string} statut - Nouveau statut : ACTIVE | SUSPENDUE | ANNULEE | TERMINEE
 * @returns {Promise<void>}
 */
export async function updateStatutRecurrente(id, statut) {
  await db.query(
    "UPDATE transactions_recurrentes SET statut = ? WHERE id = ?",
    [statut, id]
  );
}

/**
 * Réinitialise le compteur d'échecs (`nb_echecs`) d'une transaction récurrente à 0
 * et la remet en statut ACTIVE. Utilisé lorsqu'un admin/utilisateur reprend une
 * récurrente précédemment SUSPENDUE après plusieurs échecs : sans reset, elle
 * serait re-suspendue dès le premier nouvel échec.
 *
 * @async
 * @param {number} id - Identifiant de la récurrente à réactiver.
 * @returns {Promise<void>}
 */
export async function resetNbEchecsRecurrente(id) {
  await db.query(
    "UPDATE transactions_recurrentes SET nb_echecs = 0, statut = 'ACTIVE' WHERE id = ?",
    [id]
  );
}

/**
 * Récupère toutes les récurrentes ACTIVE dont la prochaine_execution est aujourd'hui ou dans le passé.
 *
 * Utilisé par le scheduler pour identifier les virements à exécuter.
 *
 * @async
 * @returns {Promise<Array>} Les récurrentes échues avec informations de solde des comptes.
 */
export async function findRecurrentesEchues() {
  const [rows] = await db.query(
    `SELECT
       tr.*,
       src.solde AS solde_source
     FROM transactions_recurrentes tr
     JOIN comptes src ON src.id = tr.compte_source_id
     WHERE tr.statut = 'ACTIVE'
       AND tr.prochaine_execution <= CURDATE()`,
    []
  );
  return rows;
}

/**
 * Met à jour une transaction récurrente après son exécution (réussie ou en échec).
 *
 * Champs mis à jour : derniere_execution, prochaine_execution, nb_echecs, statut.
 *
 * @async
 * @param {number} id     - Identifiant de la récurrente.
 * @param {Object} fields - Champs à mettre à jour.
 * @param {string} fields.derniere_execution  - Date de la dernière exécution (YYYY-MM-DD).
 * @param {string} fields.prochaine_execution - Prochaine date d'exécution calculée (YYYY-MM-DD).
 * @param {number} fields.nb_echecs           - Nouveau compteur d'échecs.
 * @param {string} fields.statut              - Nouveau statut.
 * @returns {Promise<void>}
 */
export async function updateApresExecution(id, { derniere_execution, prochaine_execution, nb_echecs, statut }) {
  await db.query(
    `UPDATE transactions_recurrentes
     SET derniere_execution = ?, prochaine_execution = ?, nb_echecs = ?, statut = ?
     WHERE id = ?`,
    [derniere_execution, prochaine_execution, nb_echecs, statut, id]
  );
}
