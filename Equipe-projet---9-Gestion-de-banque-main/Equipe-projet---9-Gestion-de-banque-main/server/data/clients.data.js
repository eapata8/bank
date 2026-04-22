/**
 * @fileoverview Couche d'accès aux données pour la gestion des clients bancaires.
 *
 * Ce module fournit toutes les requêtes SQL nécessaires pour :
 * - Lister les clients accessibles par un utilisateur connecté
 * - Rechercher des clients (admin : tous, utilisateur : les siens uniquement)
 * - Consulter les comptes bancaires d'un client
 * - Créer de nouveaux clients et les associer à un utilisateur
 *
 * Contrôle d'accès : la table de jointure `utilisateurs_clients` est le pivot
 * central qui lie un utilisateur (MODERATEUR/CLIENT) à ses clients autorisés.
 * Un ADMIN peut contourner ce filtre et accéder à tous les clients directement.
 *
 * @module data/clients
 */

import db from "../db.js";

/**
 * Récupère tous les clients associés à un utilisateur spécifique.
 *
 * Utilise la table de jointure `utilisateurs_clients` pour filtrer
 * uniquement les clients auxquels cet utilisateur a accès.
 * Un modérateur ne voit que les clients qui lui sont attribués.
 *
 * @async
 * @param {number} userId - L'identifiant de l'utilisateur connecté.
 * @returns {Promise<Array<{id: number, prenom: string, nom: string, email_fictif: string, ville: string|null, cree_le: Date}>>}
 *   Un tableau de clients triés par identifiant croissant.
 */
export async function findClientsByUserId(userId) {
  // La jointure sur utilisateurs_clients garantit que seuls les clients
  // appartenant à cet utilisateur sont retournés (contrôle d'accès par ligne)
  const [rows] = await db.query(
    `SELECT c.id, c.prenom, c.nom, c.email_fictif, c.ville, c.cree_le
     FROM clients c
     JOIN utilisateurs_clients uc ON uc.client_id = c.id
     WHERE uc.utilisateur_id = ?
     ORDER BY c.id`,
    [userId]
  );

  return rows;
}

/**
 * Récupère tous les clients de la banque avec filtrage optionnel par recherche textuelle.
 *
 * Cette fonction est réservée aux administrateurs (canReadAll = true).
 * La recherche est insensible à la casse et couvre :
 * - L'identifiant numérique du client (converti en chaîne pour le LIKE)
 * - Le prénom
 * - Le nom de famille
 *
 * @async
 * @param {string} [search=""] - Terme de recherche optionnel (vide = tous les clients).
 * @returns {Promise<Array<{id: number, prenom: string, nom: string, email_fictif: string, ville: string|null, cree_le: Date}>>}
 *   Un tableau de tous les clients correspondant au critère, triés par id.
 */
export async function findAllClients(search = "") {
  // Nettoyage et normalisation de la chaîne de recherche
  const trimmedSearch = String(search || "").trim();
  // Ajout des jokers pour la recherche partielle LIKE
  const searchTerm = `%${trimmedSearch}%`;

  const [rows] = await db.query(
    // Si la recherche est vide (? = ''), on retourne tout sans filtrage
    // Sinon on cherche dans l'id (converti en texte), le prénom et le nom
    // On LEFT JOIN sur utilisateurs_clients/utilisateurs pour récupérer les
    // vrais emails de login du/des utilisateur(s) rattaché(s) à ce client.
    // Un client peut être lié à 0..N utilisateurs : GROUP_CONCAT les regroupe
    // en chaîne séparée par des virgules (null si aucun lien).
    `SELECT c.id, c.prenom, c.nom, c.email_fictif, c.ville, c.cree_le,
            GROUP_CONCAT(DISTINCT u.email ORDER BY u.email SEPARATOR ', ') AS login_email
     FROM clients c
     LEFT JOIN utilisateurs_clients uc ON uc.client_id = c.id
     LEFT JOIN utilisateurs u ON u.id = uc.utilisateur_id
     WHERE (? = '' OR CAST(c.id AS CHAR) LIKE ? OR c.prenom LIKE ? OR c.nom LIKE ?)
     GROUP BY c.id
     ORDER BY c.id`,
    [trimmedSearch, searchTerm, searchTerm, searchTerm]
  );

  return rows;
}

/**
 * Récupère les comptes bancaires d'un client spécifique, en vérifiant que
 * l'utilisateur courant a bien accès à ce client.
 *
 * Double filtre de sécurité :
 * 1. L'utilisateur doit être lié au client (via utilisateurs_clients)
 * 2. Le compte doit appartenir à ce même client
 *
 * Utilisé par les modérateurs/clients pour consulter les comptes d'un de leurs clients.
 *
 * @async
 * @param {number} userId   - L'identifiant de l'utilisateur connecté.
 * @param {number} clientId - L'identifiant du client dont on veut les comptes.
 * @returns {Promise<Array<{id: number, client_id: number, type_compte: string, numero_compte: string, numero_institution: string, numero_transit: string, swift_bic: string, solde: number, devise: string, est_actif: boolean}>>}
 *   Un tableau de comptes bancaires, triés par identifiant.
 */
export async function findAccountsByUserIdAndClientId(userId, clientId) {
  // Jointure sur utilisateurs_clients : vérifie que l'utilisateur a le droit
  // d'accéder à ce client avant de retourner ses comptes
  const [rows] = await db.query(
    `SELECT co.id, co.client_id, co.type_compte, co.numero_compte,
            co.numero_institution, co.numero_transit, co.swift_bic,
            co.solde, co.devise, co.est_actif
     FROM comptes co
     JOIN utilisateurs_clients uc ON uc.client_id = co.client_id
     WHERE uc.utilisateur_id = ?
       AND co.client_id = ?
     ORDER BY co.id`,
    [userId, clientId]
  );

  return rows;
}

/**
 * Récupère tous les comptes bancaires d'un client sans vérification d'accès.
 *
 * Version sans restriction d'accès, destinée aux administrateurs qui peuvent
 * consulter les comptes de n'importe quel client directement par son identifiant.
 *
 * @async
 * @param {number} clientId - L'identifiant du client.
 * @returns {Promise<Array<{id: number, client_id: number, type_compte: string, numero_compte: string, numero_institution: string, numero_transit: string, swift_bic: string, solde: number, devise: string, est_actif: boolean}>>}
 *   Un tableau de tous les comptes du client, triés par identifiant.
 */
export async function findAccountsByClientId(clientId) {
  // Pas de jointure sur utilisateurs_clients : accès direct par client_id (usage admin)
  const [rows] = await db.query(
    `SELECT id, client_id, type_compte, numero_compte,
            numero_institution, numero_transit, swift_bic,
            solde, devise, est_actif
     FROM comptes
     WHERE client_id = ?
     ORDER BY id`,
    [clientId]
  );

  return rows;
}

/**
 * Vérifie l'existence d'un client dans la base de données par son identifiant.
 *
 * Fonction de validation légère : ne retourne que l'id pour minimiser
 * le transfert de données. Utilisée pour valider les entrées avant de créer
 * des associations ou des comptes.
 *
 * @async
 * @param {number} clientId - L'identifiant du client à vérifier.
 * @returns {Promise<{id: number}|null>} Un objet avec l'id si le client existe, null sinon.
 */
export async function findClientById(clientId) {
  const [rows] = await db.query(`SELECT id FROM clients WHERE id = ?`, [clientId]);
  return rows[0] || null;
}

/**
 * Recherche un client par son adresse courriel fictive (identifiant unique interne).
 *
 * Le courriel fictif est un identifiant unique attribué aux clients pour les
 * distinguer dans le système sans utiliser de vraies adresses courriel.
 * Utilisé pour éviter les doublons lors de la création de clients.
 *
 * @async
 * @param {string} emailFictif - L'adresse courriel fictive à rechercher.
 * @returns {Promise<{id: number}|null>} L'id du client si trouvé, null sinon.
 */
export async function findClientByEmailFictif(emailFictif) {
  const [rows] = await db.query(`SELECT id FROM clients WHERE email_fictif = ?`, [emailFictif]);
  return rows[0] || null;
}

/**
 * Vérifie l'existence d'un utilisateur dans la base de données par son identifiant.
 *
 * Fonction de validation utilisée avant de créer une association
 * utilisateur-client pour s'assurer que les deux existent.
 *
 * @async
 * @param {number} utilisateurId - L'identifiant de l'utilisateur à vérifier.
 * @returns {Promise<{id: number}|null>} Un objet avec l'id si l'utilisateur existe, null sinon.
 */
export async function findUserById(utilisateurId) {
  const [rows] = await db.query(`SELECT id FROM utilisateurs WHERE id = ?`, [utilisateurId]);
  return rows[0] || null;
}

/**
 * Crée un nouveau client bancaire dans la base de données.
 *
 * Un client est une entité distincte d'un utilisateur : il représente
 * un titulaire de compte. Un utilisateur peut gérer plusieurs clients,
 * et un client peut être lié à plusieurs utilisateurs via utilisateurs_clients.
 *
 * @async
 * @param {Object}      params            - Les informations du nouveau client.
 * @param {string}      params.prenom     - Prénom du client.
 * @param {string}      params.nom        - Nom de famille du client.
 * @param {string}      params.emailFictif - Courriel fictif unique du client.
 * @param {string|null} params.ville      - Ville de résidence (optionnel, peut être null).
 * @returns {Promise<number>} L'identifiant auto-incrémenté du client nouvellement créé.
 */
export async function createClient({ prenom, nom, emailFictif, ville }) {
  const [result] = await db.query(
    `INSERT INTO clients (prenom, nom, email_fictif, ville) VALUES (?, ?, ?, ?)`,
    // La ville est optionnelle : on force null si non fournie
    [prenom, nom, emailFictif, ville || null]
  );
  return result.insertId;
}

/**
 * Crée un lien d'association entre un utilisateur et un client.
 *
 * La table `utilisateurs_clients` est la table de jointure Many-to-Many
 * qui détermine quels utilisateurs ont accès à quels clients.
 * Cette association est au cœur du contrôle d'accès basé sur les lignes (row-level security).
 *
 * @async
 * @param {number} clientId      - L'identifiant du client à associer.
 * @param {number} utilisateurId - L'identifiant de l'utilisateur propriétaire/gestionnaire.
 * @returns {Promise<void>}
 */
export async function linkClientToUser(clientId, utilisateurId) {
  // Insertion du lien Many-to-Many : un utilisateur peut avoir plusieurs clients,
  // et un client peut appartenir à plusieurs utilisateurs
  await db.query(
    `INSERT INTO utilisateurs_clients (utilisateur_id, client_id) VALUES (?, ?)`,
    [utilisateurId, clientId]
  );
}
