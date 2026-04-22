/**
 * @fileoverview Couche d'accès aux données pour les comptes bancaires.
 *
 * Ce module fournit toutes les requêtes SQL pour :
 *  - Lister les comptes d'un utilisateur ou de tous les clients (admin)
 *  - Récupérer un compte par son identifiant avec ou sans vérification d'accès
 *  - Créer de nouveaux comptes bancaires
 *  - Consulter l'historique des transactions d'un compte
 *
 * Contrôle d'accès :
 *  - Utilisateur standard : accès uniquement à ses propres comptes via utilisateurs_clients
 *  - ADMIN/MODERATEUR : accès à tous les comptes directement (fonctions "Any" ou "All")
 *
 * @module data/comptes
 */

import db from "../db.js";

/**
 * Récupère tous les comptes accessibles à un utilisateur spécifique.
 *
 * Utilise la table de jointure `utilisateurs_clients` pour filtrer
 * uniquement les comptes des clients appartenant à cet utilisateur.
 *
 * @async
 * @param {number} userId - L'identifiant de l'utilisateur connecté.
 * @returns {Promise<Array<{id: number, client_id: number, type_compte: string, numero_compte: string, numero_institution: string, numero_transit: string, swift_bic: string, solde: number, devise: string, est_actif: boolean}>>}
 *   Tous les comptes associés à cet utilisateur, triés par id.
 */
export async function findAccountsByUserId(userId) {
  // Jointure via utilisateurs_clients pour respecter le contrôle d'accès par ligne
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.numero_compte,
            co.numero_institution, co.numero_transit, co.swift_bic,
            co.solde, co.devise, co.est_actif
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ?
     ORDER BY co.id`,
    [userId]
  );

  return rows;
}

/**
 * Récupère tous les comptes de la banque avec filtrage optionnel (usage admin).
 *
 * La recherche textuelle couvre : l'id du compte, le numéro de compte,
 * le type de compte, et le nom complet du client associé.
 * Inclut les informations du client (prenom, nom) pour l'affichage admin.
 *
 * @async
 * @param {string} [search=""] - Terme de recherche optionnel (insensible à la casse).
 * @returns {Promise<Array>} Tous les comptes correspondants avec les infos du client, triés par id.
 */
export async function findAllAccounts(search = "") {
  // Nettoyage de la chaîne de recherche pour éviter les espaces parasites
  const trimmedSearch = String(search || "").trim();
  const searchTerm = `%${trimmedSearch}%`;

  const [rows] = await db.query(
    `SELECT co.id,
            co.client_id,
            co.type_compte,
            co.numero_compte,
            co.numero_institution,
            co.numero_transit,
            co.swift_bic,
            co.solde,
            co.devise,
            co.est_actif,
            c.prenom AS client_prenom,   -- Infos client pour l'affichage dans la liste admin
            c.nom AS client_nom
     FROM comptes co
     JOIN clients c ON c.id = co.client_id
     WHERE (? = ''
       OR CAST(co.id AS CHAR) LIKE ?      -- Recherche par id numérique (converti en texte)
       OR co.numero_compte LIKE ?
       OR co.type_compte LIKE ?
       OR c.prenom LIKE ?
       OR c.nom LIKE ?)
     ORDER BY co.id`,
    [trimmedSearch, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]
  );

  return rows;
}

/**
 * Récupère n'importe quel compte par son identifiant, sans restriction d'accès.
 *
 * Utilisé par les ADMIN et MODERATEUR qui peuvent consulter tous les comptes.
 * À NE PAS utiliser pour les utilisateurs standards (utiliser findOwnedAccountById).
 *
 * @async
 * @param {number} compteId - L'identifiant du compte.
 * @returns {Promise<object|null>} Le compte, ou null s'il n'existe pas.
 */
export async function findAnyAccountById(compteId) {
  const [rows] = await db.query(
    `SELECT id, client_id, type_compte, numero_compte,
            numero_institution, numero_transit, swift_bic,
            solde, devise, est_actif
     FROM comptes
     WHERE id = ?`,
    [compteId]
  );

  return rows[0] || null;
}

/**
 * Récupère un compte appartenant à un utilisateur spécifique.
 *
 * Double vérification : l'utilisateur doit être lié au client propriétaire
 * du compte via la table utilisateurs_clients. Retourne null si le compte
 * n'appartient pas à cet utilisateur.
 *
 * @async
 * @param {number} userId   - L'identifiant de l'utilisateur connecté.
 * @param {number} compteId - L'identifiant du compte à récupérer.
 * @returns {Promise<object|null>} Le compte si autorisé, null sinon.
 */
export async function findOwnedAccountById(userId, compteId) {
  // La jointure garantit que l'utilisateur est bien le propriétaire du compte
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.numero_compte,
            co.numero_institution, co.numero_transit, co.swift_bic,
            co.solde, co.devise, co.est_actif
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ? AND co.id = ?`,
    [userId, compteId]
  );

  return rows[0] || null;
}

/**
 * Vérifie qu'un utilisateur a accès à un compte (version légère — id uniquement).
 *
 * Variante allégée de findOwnedAccountById : ne retourne que l'id du compte
 * pour les cas où l'on a seulement besoin de vérifier l'autorisation,
 * sans charger toutes les données du compte.
 *
 * @async
 * @param {number} userId   - L'identifiant de l'utilisateur connecté.
 * @param {number} compteId - L'identifiant du compte à vérifier.
 * @returns {Promise<{id: number}|null>} L'id si accès autorisé, null sinon.
 */
export async function findOwnedAccountAccess(userId, compteId) {
  const [rows] = await db.query(
    `SELECT co.id
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ? AND co.id = ?`,
    [userId, compteId]
  );

  return rows[0] || null;
}

/**
 * Vérifie l'existence d'un compte par son identifiant (version minimale).
 *
 * Utilisé pour distinguer "compte inexistant (404)" de "accès refusé (403)"
 * dans les contrôleurs : si le compte n'existe pas du tout, on renvoie 404 ;
 * s'il existe mais que l'utilisateur n'y a pas accès, on renvoie 403.
 *
 * @async
 * @param {number} compteId - L'identifiant du compte.
 * @returns {Promise<{id: number}|null>} Un objet avec l'id si le compte existe, null sinon.
 */
export async function findAccountById(compteId) {
  const [rows] = await db.query("SELECT id FROM comptes WHERE id = ?", [compteId]);
  return rows[0] || null;
}

/**
 * Crée un nouveau compte bancaire dans la base de données.
 *
 * Les coordonnées bancaires (numéro institution, transit, SWIFT/BIC) utilisent
 * les valeurs de Leon Bank par défaut si non fournies.
 *
 * @async
 * @param {Object} params                      - Les informations du nouveau compte.
 * @param {number} params.clientId             - Identifiant du client propriétaire du compte.
 * @param {string} params.typeCompte           - Type : "CHEQUES", "EPARGNE" ou "CREDIT".
 * @param {string} params.numeroCompte         - Numéro de compte formaté (ex: "1234 5678 9012").
 * @param {string} params.numeroInstitution    - Numéro d'institution bancaire (défaut: "621").
 * @param {string} params.numeroTransit        - Numéro de transit à 5 chiffres.
 * @param {string} params.swiftBic             - Code SWIFT/BIC (défaut: "NXBKCA2TXXX").
 * @param {number} params.solde                - Solde initial (normalement 0 à la création).
 * @param {string} params.devise               - Code devise ISO 4217 (défaut: "CAD").
 * @returns {Promise<number>} L'identifiant auto-incrémenté du compte créé.
 */
export async function createCompte({ clientId, typeCompte, numeroCompte, numeroInstitution, numeroTransit, swiftBic, solde, devise }) {
  const [result] = await db.query(
    `INSERT INTO comptes (client_id, type_compte, numero_compte, numero_institution, numero_transit, swift_bic, solde, devise)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    // Valeurs par défaut pour les coordonnées Leon Bank si non fournies
    [clientId, typeCompte, numeroCompte, numeroInstitution || "621", numeroTransit, swiftBic || "NXBKCA2TXXX", solde ?? 0, devise || "CAD"]
  );
  return result.insertId;
}

/**
 * Récupère l'historique complet des transactions d'un compte.
 *
 * Retourne toutes les transactions associées à ce compte, triées du plus
 * récent au plus ancien (date décroissante, puis id décroissant pour les
 * transactions à la même seconde).
 *
 * @async
 * @param {number} compteId - L'identifiant du compte.
 * @returns {Promise<Array<{id: number, compte_id: number, type_transaction: string, description: string, montant: number, date_transaction: Date, statut: string}>>}
 *   L'historique des transactions, du plus récent au plus ancien.
 */
export async function findTransactionsByAccountId(compteId) {
  const [rows] = await db.query(
    `SELECT id, compte_id, type_transaction, description, montant, date_transaction, statut
     FROM transactions
     WHERE compte_id = ?
     ORDER BY date_transaction DESC, id DESC`, // Tri par date puis par id pour stabilité
    [compteId]
  );

  return rows;
}
