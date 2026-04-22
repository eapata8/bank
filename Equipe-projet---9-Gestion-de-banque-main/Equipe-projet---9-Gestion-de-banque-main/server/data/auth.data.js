/**
 * @fileoverview Couche d'accès aux données pour l'authentification des utilisateurs.
 *
 * Ce module gère toutes les opérations de base de données liées à l'authentification :
 * - Recherche d'utilisateurs par courriel ou identifiant
 * - Vérification et hachage des mots de passe avec bcrypt
 * - Création et suppression de comptes utilisateurs
 * - Gestion des modérateurs et de l'administrateur configuré
 *
 * Les mots de passe ne sont JAMAIS stockés en clair : bcrypt avec un facteur
 * de coût de 12 est utilisé pour toutes les opérations de hachage (recommandation
 * minimale 2024+ pour une application bancaire ; 10 est devenu trop rapide sur
 * du matériel moderne).
 *
 * @module data/auth
 */

import bcrypt from "bcryptjs";
import db from "../db.js";

/**
 * Facteur de coût bcrypt utilisé pour tous les hachages de mots de passe.
 * Centralisé ici pour faciliter les rotations futures.
 */
const BCRYPT_COST = 12;

/**
 * Recherche un utilisateur complet dans la base de données par son adresse courriel.
 *
 * Cette fonction est principalement utilisée lors de la connexion : elle retourne
 * le hachage du mot de passe afin que la couche service puisse effectuer la
 * vérification avec bcrypt. Ne jamais exposer le mot_de_passe_hash au client.
 *
 * @async
 * @param {string} email - L'adresse courriel de l'utilisateur à rechercher.
 * @returns {Promise<{id: number, email: string, role: string, prenom: string, nom: string, mot_de_passe_hash: string}|null>}
 *   L'objet utilisateur complet (avec le hachage), ou null si aucun utilisateur trouvé.
 */
export async function findUserByEmail(email) {
  // On sélectionne explicitement les colonnes pour éviter de ramener des champs sensibles non nécessaires
  const [rows] = await db.query(
    `SELECT id, email, role, prenom, nom, mot_de_passe_hash
     FROM utilisateurs
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  // Retourne le premier (et unique) résultat, ou null si l'utilisateur n'existe pas
  return rows[0] || null;
}

/**
 * Vérifie qu'un mot de passe en clair correspond à un hachage bcrypt stocké.
 *
 * Utilise bcrypt.compare qui est sécurisé contre les attaques de timing
 * (comparaison à temps constant).
 *
 * @async
 * @param {string} plainPassword  - Le mot de passe en clair saisi par l'utilisateur.
 * @param {string} passwordHash   - Le hachage bcrypt récupéré de la base de données.
 * @returns {Promise<boolean>} true si le mot de passe correspond, false sinon.
 */
export async function verifyPassword(plainPassword, passwordHash) {
  // bcrypt.compare effectue une comparaison sécurisée à temps constant
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Recherche l'identifiant numérique d'un utilisateur par son adresse courriel.
 *
 * Variante allégée de findUserByEmail — ne ramène que l'id, utile lorsque
 * l'on a seulement besoin de vérifier l'existence ou d'obtenir la clé primaire.
 *
 * @async
 * @param {string} email - L'adresse courriel de l'utilisateur.
 * @returns {Promise<{id: number}|null>} Un objet contenant l'id, ou null si non trouvé.
 */
export async function findUserIdByEmail(email) {
  const [rows] = await db.query("SELECT id FROM utilisateurs WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

/**
 * Crée un nouvel utilisateur dans la base de données.
 *
 * Le mot de passe en clair est haché avec bcrypt (coût 10) avant l'insertion.
 * Le rôle peut être 'CLIENT', 'MODERATEUR' ou 'ADMIN' selon le contexte d'appel.
 *
 * @async
 * @param {Object} params               - Les informations du nouvel utilisateur.
 * @param {string} params.email         - Adresse courriel unique de l'utilisateur.
 * @param {string} params.motDePasse    - Mot de passe en clair (sera haché avant stockage).
 * @param {string} params.role          - Rôle attribué : 'CLIENT', 'MODERATEUR' ou 'ADMIN'.
 * @param {string} params.prenom        - Prénom de l'utilisateur.
 * @param {string} params.nom           - Nom de famille de l'utilisateur.
 * @returns {Promise<import('mysql2').ResultSetHeader>} Le résultat MySQL (contient insertId).
 */
export async function createUser({ email, motDePasse, role, prenom, nom }) {
  // Hachage du mot de passe avec un facteur de coût 12 (recommandation bancaire moderne)
  const passwordHash = await bcrypt.hash(motDePasse, BCRYPT_COST);

  // Insertion dans la table utilisateurs avec le hachage, jamais le mot de passe en clair
  const [result] = await db.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, prenom, nom)
     VALUES (?, ?, ?, ?, ?)`,
    [email, passwordHash, role, prenom, nom]
  );

  return result;
}

/**
 * Récupère la liste de tous les modérateurs actifs, triée alphabétiquement.
 *
 * Utilisée par la section d'administration pour afficher et gérer
 * les comptes modérateurs. Seul le rôle 'MODERATEUR' est retourné.
 *
 * @async
 * @returns {Promise<Array<{id: number, email: string, role: string, prenom: string, nom: string}>>}
 *   Un tableau d'objets utilisateurs avec le rôle MODERATEUR, trié par nom puis prénom.
 */
export async function findModerateurs() {
  const [rows] = await db.query(
    `SELECT id, email, role, prenom, nom
     FROM utilisateurs
     WHERE role = 'MODERATEUR'
     ORDER BY nom ASC, prenom ASC, id ASC`
    // Tri primaire par nom, secondaire par prénom, tertiaire par id pour stabilité
  );

  return rows;
}

/**
 * Supprime un modérateur de la base de données par son identifiant.
 *
 * La clause `AND role = 'MODERATEUR'` est une protection supplémentaire :
 * elle empêche la suppression accidentelle d'un ADMIN ou d'un CLIENT,
 * même si l'identifiant est correct.
 *
 * @async
 * @param {number} id - L'identifiant numérique du modérateur à supprimer.
 * @returns {Promise<number>} Le nombre de lignes affectées (0 si non trouvé ou mauvais rôle, 1 si supprimé).
 */
export async function deleteModerateur(id) {
  const [result] = await db.query(
    // La double condition sur id ET role empêche de supprimer un utilisateur non-modérateur
    `DELETE FROM utilisateurs WHERE id = ? AND role = 'MODERATEUR'`,
    [id]
  );
  return result.affectedRows;
}

/**
 * Crée ou met à jour le compte administrateur défini dans la configuration du serveur.
 *
 * Cette fonction est conçue pour l'initialisation du serveur (seed) : elle garantit
 * qu'un compte ADMIN existe toujours avec les identifiants configurés.
 * - Si un compte existe déjà avec ce courriel, il est mis à jour (mot de passe, rôle forcé à ADMIN).
 * - Sinon, un nouveau compte ADMIN est créé.
 *
 * Accepte une connexion de transaction MySQL existante pour garantir l'atomicité
 * lors de l'initialisation de la base de données.
 *
 * @async
 * @param {import('mysql2/promise').Connection} connection - Connexion MySQL (peut être dans une transaction).
 * @param {Object} params            - Les informations de l'administrateur.
 * @param {string} params.email      - Adresse courriel de l'admin.
 * @param {string} params.motDePasse - Mot de passe en clair (sera haché).
 * @param {string} params.prenom     - Prénom de l'administrateur.
 * @param {string} params.nom        - Nom de famille de l'administrateur.
 * @returns {Promise<number>} L'identifiant (id) du compte admin créé ou mis à jour.
 */
export async function upsertConfiguredAdmin(connection, { email, motDePasse, prenom, nom }) {
  // Hachage du mot de passe configuré avant toute opération sur la base
  const passwordHash = await bcrypt.hash(motDePasse, BCRYPT_COST);

  // Vérifie si un utilisateur existe déjà avec ce courriel
  const [rows] = await connection.query("SELECT id FROM utilisateurs WHERE email = ? LIMIT 1", [email]);

  if (rows.length > 0) {
    // L'utilisateur existe déjà : on met à jour ses informations
    // Le rôle est forcé à 'ADMIN' au cas où il aurait été dégradé
    await connection.query(
      `UPDATE utilisateurs
       SET mot_de_passe_hash = ?, role = 'ADMIN', prenom = ?, nom = ?
       WHERE id = ?`,
      [passwordHash, prenom, nom, rows[0].id]
    );
    // Retourne l'id existant
    return rows[0].id;
  }

  // L'utilisateur n'existe pas encore : on crée un nouveau compte ADMIN
  const [result] = await connection.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, prenom, nom)
     VALUES (?, ?, 'ADMIN', ?, ?)`,
    [email, passwordHash, prenom, nom]
  );

  // Retourne l'id auto-incrémenté du nouveau compte
  return result.insertId;
}
