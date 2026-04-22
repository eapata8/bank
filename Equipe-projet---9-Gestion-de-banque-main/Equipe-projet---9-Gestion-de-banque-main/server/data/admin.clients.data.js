/**
 * @fileoverview Couche d'accès aux données pour la vue détaillée d'un client (côté admin).
 *
 * Ce module fournit toutes les requêtes nécessaires pour consulter le profil complet
 * d'un client spécifique depuis l'interface d'administration :
 *  - Informations du client (profil de base)
 *  - Comptes bancaires associés
 *  - Virements (source ou destination)
 *  - Dépôts par chèque
 *  - Retraits
 *  - Factures
 *  - Cartes de crédit
 *
 * Ces fonctions sont utilisées dans admin.controller.js pour la page détail d'un client.
 *
 * @module data/admin.clients
 */

import db from "../db.js";

/**
 * Retourne les informations de base d'un client par son identifiant.
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<object|null>} Le client (id, prenom, nom, email_fictif, ville, cree_le), ou null.
 */
export async function findClientById(clientId) {
  const [rows] = await db.query(
    `SELECT id, prenom, nom, email_fictif, ville, cree_le
     FROM clients WHERE id = ?`,
    [clientId]
  );
  return rows[0] || null;
}

/**
 * Retourne tous les comptes bancaires associés à un client.
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<Array>} Tableau de comptes (id, type, numéro, solde, devise, statut actif).
 */
export async function findClientComptes(clientId) {
  const [rows] = await db.query(
    `SELECT id, type_compte, numero_compte, solde, devise, est_actif
     FROM comptes
     WHERE client_id = ?
     ORDER BY id DESC`,
    [clientId]
  );
  return rows;
}

/**
 * Retourne les 100 derniers virements impliquant ce client (source ou destination).
 *
 * Inclut les informations des deux comptes concernés et les noms des clients impliqués
 * pour permettre un affichage complet sans jointures supplémentaires côté frontend.
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<Array>} Tableau de virements enrichis, triés du plus récent.
 */
export async function findClientVirements(clientId) {
  const [rows] = await db.query(
    `SELECT v.id, v.montant, v.description, v.date_virement, v.statut,
            cs.numero_compte AS compte_source_numero, cs.type_compte AS compte_source_type,
            cd.numero_compte AS compte_destination_numero, cd.type_compte AS compte_destination_type,
            CONCAT(cl_src.prenom, ' ', cl_src.nom) AS client_source_nom,
            CONCAT(cl_dst.prenom, ' ', cl_dst.nom) AS client_destination_nom
     FROM virements v
     JOIN comptes cs ON cs.id = v.compte_source_id
     JOIN comptes cd ON cd.id = v.compte_destination_id
     JOIN clients cl_src ON cl_src.id = cs.client_id
     JOIN clients cl_dst ON cl_dst.id = cd.client_id
     WHERE cs.client_id = ? OR cd.client_id = ?
     ORDER BY v.date_virement DESC
     LIMIT 100`,
    [clientId, clientId]
  );
  return rows;
}

/**
 * Retourne tous les dépôts par chèque associés à un client, du plus récent au plus ancien.
 *
 * Inclut le numéro et le type du compte destinataire pour le contexte d'affichage.
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<Array>} Tableau de dépôts (montant, chèque, banque, statut, dates, infos compte).
 */
export async function findClientDepots(clientId) {
  const [rows] = await db.query(
    `SELECT d.id, d.montant, d.numero_cheque, d.banque_emettrice, d.statut, d.depose_le, d.traite_le,
            c.numero_compte, c.type_compte
     FROM depots_cheques d
     JOIN comptes c ON c.id = d.compte_id
     WHERE d.client_id = ?
     ORDER BY d.depose_le DESC`,
    [clientId]
  );
  return rows;
}

/**
 * Retourne tous les retraits associés à un client, du plus récent au plus ancien.
 *
 * Inclut le numéro et le type du compte source pour le contexte d'affichage.
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<Array>} Tableau de retraits (montant, description, statut, dates, infos compte).
 */
export async function findClientRetraits(clientId) {
  const [rows] = await db.query(
    `SELECT r.id, r.montant, r.description, r.statut, r.date_demande, r.date_approbation,
            c.numero_compte, c.type_compte
     FROM retraits r
     JOIN comptes c ON c.id = r.compte_id
     WHERE r.client_id = ?
     ORDER BY r.date_demande DESC`,
    [clientId]
  );
  return rows;
}

/**
 * Retourne toutes les factures associées à un client, triées par date d'échéance.
 *
 * Inclut le numéro du compte de paiement lié (LEFT JOIN car peut être null si non payée).
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<Array>} Tableau de factures (fournisseur, référence, montant, statut, dates, compte).
 */
export async function findClientFactures(clientId) {
  const [rows] = await db.query(
    `SELECT f.id, f.fournisseur, f.reference_facture, f.montant, f.statut,
            f.date_emission, f.date_echeance, f.payee_le,
            cp.numero_compte AS compte_paiement_numero
     FROM factures f
     LEFT JOIN comptes cp ON cp.id = f.compte_paiement_id
     WHERE f.client_id = ?
     ORDER BY f.date_echeance DESC`,
    [clientId]
  );
  return rows;
}

/**
 * Retourne toutes les cartes de crédit associées à un client.
 *
 * @async
 * @param {number} clientId - Identifiant du client.
 * @returns {Promise<Array>} Tableau de cartes (type, numéro, limite, solde utilisé, statut, expiration).
 */
export async function findClientCartes(clientId) {
  const [rows] = await db.query(
    `SELECT id, type_carte, numero_compte, limite_credit, solde_utilise, statut, date_expiration, cree_le
     FROM cartes_credit
     WHERE client_id = ?
     ORDER BY id DESC`,
    [clientId]
  );
  return rows;
}
