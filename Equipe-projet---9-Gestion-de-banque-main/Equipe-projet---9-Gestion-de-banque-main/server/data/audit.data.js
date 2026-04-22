/**
 * @fileoverview Couche d'accès aux données pour le journal d'audit.
 *
 * Ce module gère l'enregistrement et la consultation des événements
 * importants de l'application dans la table `audit_logs`.
 *
 * Chaque action sensible (connexion, création de compte, virement, etc.)
 * génère une entrée dans ce journal avec :
 *  - L'identifiant et le rôle de l'utilisateur responsable
 *  - Le type d'action effectuée (ex : "CREATE_VIREMENT", "BLOQUER_CARTE")
 *  - Des détails contextuels en texte libre
 *
 * Le journal d'audit est accessible uniquement aux ADMIN via GET /api/auth/logs.
 *
 * @module data/audit
 */

import db from "../db.js";

/**
 * Enregistre une nouvelle entrée dans le journal d'audit.
 *
 * Cette fonction est appelée après chaque opération sensible dans les contrôleurs
 * pour tracer qui a fait quoi et quand. Elle ne lève pas d'exception :
 * si l'insertion échoue, l'opération principale ne doit pas être annulée.
 *
 * @async
 * @param {Object}      params                   - Les données de l'entrée d'audit.
 * @param {number}      params.utilisateurId     - Identifiant de l'utilisateur ayant effectué l'action.
 * @param {string}      params.roleUtilisateur   - Rôle de l'utilisateur au moment de l'action (ADMIN, MODERATEUR, UTILISATEUR).
 * @param {string}      params.action            - Code de l'action effectuée (ex : "CREATE_VIREMENT", "LOGIN").
 * @param {string|null} params.details           - Description textuelle optionnelle avec contexte supplémentaire.
 * @returns {Promise<void>}
 */
export async function createAuditLog({ utilisateurId, roleUtilisateur, action, details }) {
  // L'horodatage (cree_le) est généré automatiquement par la base de données (DEFAULT NOW())
  await db.query(
    `INSERT INTO audit_logs (utilisateur_id, role_utilisateur, action, details)
     VALUES (?, ?, ?, ?)`,
    [utilisateurId, roleUtilisateur, action, details || null]
  );
}

/**
 * Récupère les entrées les plus récentes du journal d'audit avec les informations
 * de l'utilisateur associé.
 *
 * Le nombre de résultats est limité et borné entre 1 et 200 pour éviter
 * les requêtes trop lourdes sur une table potentiellement volumineuse.
 *
 * @async
 * @param {number} [limit=50] - Nombre maximum d'entrées à retourner (borné entre 1 et 200).
 * @returns {Promise<Array<{
 *   id: number,
 *   utilisateur_id: number,
 *   role_utilisateur: string,
 *   action: string,
 *   details: string|null,
 *   cree_le: Date,
 *   email: string,
 *   prenom: string,
 *   nom: string
 * }>>} Les entrées d'audit les plus récentes, enrichies des informations utilisateur.
 */
export async function findRecentAuditLogs(limit = 50) {
  // Sécurisation de la limite : minimum 1, maximum 200, valeur par défaut 50
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  // La jointure avec utilisateurs enrichit chaque entrée avec les infos de l'utilisateur
  // (email, prénom, nom) pour un affichage plus lisible dans l'interface d'administration
  const [rows] = await db.query(
    `SELECT
       al.id,
       al.utilisateur_id,
       al.role_utilisateur,
       al.action,
       al.details,
       al.cree_le,
       u.email,
       u.prenom,
       u.nom
     FROM audit_logs al
     JOIN utilisateurs u ON u.id = al.utilisateur_id
     ORDER BY al.cree_le DESC, al.id DESC
     LIMIT ${safeLimit}`  // safeLimit est un entier validé, pas un paramètre utilisateur brut
  );

  return rows;
}
