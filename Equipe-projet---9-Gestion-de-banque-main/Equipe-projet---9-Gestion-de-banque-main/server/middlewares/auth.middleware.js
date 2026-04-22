/**
 * @fileoverview Middlewares d'authentification et d'autorisation basés sur les rôles.
 *
 * Ce module expose des middlewares Express qui protègent les routes en vérifiant
 * la session de l'utilisateur connecté et son niveau d'accès.
 *
 * Hiérarchie des rôles (du plus élevé au plus bas) :
 *   ADMIN > MODERATEUR > UTILISATEUR
 *
 * - ADMIN       : accès complet à toutes les fonctionnalités, y compris la gestion
 *                 des autres utilisateurs, des rôles et des paramètres système.
 * - MODERATEUR  : accès élevé pour approuver/rejeter des opérations (dépôts, retraits,
 *                 virements) et consulter les données des clients.
 * - UTILISATEUR : accès limité à ses propres données (comptes, transactions, factures…).
 *
 * Chaque middleware suit la convention Express : (req, res, next) => void.
 *   - Si la vérification échoue, il répond directement avec un code HTTP d'erreur.
 *   - Si la vérification réussit, il appelle next() pour passer au prochain middleware.
 *
 * @module auth.middleware
 */

/**
 * Middleware de base : vérifie qu'une session utilisateur est active.
 *
 * Ce middleware est le gardien minimal de toutes les routes protégées.
 * Il s'assure qu'un utilisateur est bien connecté (i.e. que req.session.user
 * existe) avant de laisser passer la requête.
 *
 * Utilisé sur toutes les routes qui nécessitent au minimum d'être authentifié,
 * quel que soit le rôle.
 *
 * @param {import("express").Request}  req  - La requête HTTP entrante (doit contenir req.session.user).
 * @param {import("express").Response} res  - La réponse HTTP sortante.
 * @param {import("express").NextFunction} next - Fonction pour passer au middleware suivant.
 * @returns {void} Répond avec 401 si la session est absente, sinon appelle next().
 */
export function requireAuth(req, res, next) {
  // Vérification de l'existence de la session ET de l'objet utilisateur en session.
  // req.session peut exister sans req.session.user si la session a expiré ou n'a jamais été initialisée.
  if (!req.session || !req.session.user) {
    // 401 Unauthorized : l'utilisateur n'est pas authentifié.
    return res.status(401).json({ message: "Non autorise" });
  }

  // La session est valide et contient un utilisateur → on passe au middleware suivant.
  return next();
}

/**
 * Middleware de restriction au rôle ADMIN uniquement.
 *
 * Ce middleware protège les routes réservées exclusivement aux administrateurs,
 * comme la gestion des comptes bancaires en mode admin, la création/suppression
 * d'utilisateurs privilégiés, ou la consultation des journaux d'audit.
 *
 * Double vérification effectuée :
 *   1. L'utilisateur est bien authentifié (session valide).
 *   2. Le rôle de l'utilisateur est exactement "ADMIN".
 *
 * @param {import("express").Request}  req  - La requête HTTP entrante.
 * @param {import("express").Response} res  - La réponse HTTP sortante.
 * @param {import("express").NextFunction} next - Fonction pour passer au middleware suivant.
 * @returns {void} Répond avec 401 si non authentifié, 403 si le rôle est insuffisant,
 *                 sinon appelle next().
 */
export function requireAdmin(req, res, next) {
  // Étape 1 : vérifier qu'une session utilisateur est active.
  if (!req.session || !req.session.user) {
    // 401 Unauthorized : aucune session trouvée.
    return res.status(401).json({ message: "Non autorise" });
  }

  // Étape 2 : vérifier que l'utilisateur possède exactement le rôle ADMIN.
  // Les MODERATEUR et UTILISATEUR se voient refuser l'accès ici.
  if (req.session.user.role !== "ADMIN") {
    // 403 Forbidden : authentifié mais pas autorisé (rôle insuffisant).
    return res.status(403).json({ message: "Acces reserve a l'administrateur" });
  }

  // L'utilisateur est bien un ADMIN → accès accordé.
  return next();
}

/**
 * Middleware de restriction aux rôles "élevés" : ADMIN ou MODERATEUR.
 *
 * Ce middleware protège les routes accessibles aux deux rôles privilégiés,
 * par exemple l'approbation ou le rejet des dépôts, des retraits ou des virements,
 * ainsi que la consultation de certaines données clients sensibles.
 *
 * Un UTILISATEUR standard se verra refuser l'accès.
 *
 * Double vérification effectuée :
 *   1. L'utilisateur est authentifié.
 *   2. Son rôle est soit "ADMIN" soit "MODERATEUR".
 *
 * @param {import("express").Request}  req  - La requête HTTP entrante.
 * @param {import("express").Response} res  - La réponse HTTP sortante.
 * @param {import("express").NextFunction} next - Fonction pour passer au middleware suivant.
 * @returns {void} Répond avec 401 si non authentifié, 403 si le rôle est insuffisant,
 *                 sinon appelle next().
 */
export function requireElevated(req, res, next) {
  // Étape 1 : vérifier qu'une session utilisateur est active.
  if (!req.session || !req.session.user) {
    // 401 Unauthorized : aucune session trouvée.
    return res.status(401).json({ message: "Non autorise" });
  }

  // Extraire le rôle de l'utilisateur connecté pour la comparaison.
  const role = req.session.user.role;

  // Étape 2 : refuser l'accès si le rôle n'est ni ADMIN ni MODERATEUR.
  // Seuls ces deux rôles sont considérés comme "élevés" dans la hiérarchie.
  if (role !== "ADMIN" && role !== "MODERATEUR") {
    // 403 Forbidden : l'utilisateur est authentifié mais son rôle est trop bas.
    return res.status(403).json({ message: "Acces reserve aux administrateurs et moderateurs" });
  }

  // Le rôle est élevé (ADMIN ou MODERATEUR) → accès accordé.
  return next();
}

/**
 * Middleware qui interdit explicitement l'accès aux MODERATEUR.
 *
 * Ce middleware est utilisé sur des routes que les administrateurs et les simples
 * utilisateurs peuvent appeler, mais que les modérateurs ne doivent PAS pouvoir
 * appeler (ex. : opérations financières initiées par un client).
 *
 * Logique : toute personne authentifiée SAUF un MODERATEUR est autorisée.
 *
 * @param {import("express").Request}  req  - La requête HTTP entrante.
 * @param {import("express").Response} res  - La réponse HTTP sortante.
 * @param {import("express").NextFunction} next - Fonction pour passer au middleware suivant.
 * @returns {void} Répond avec 401 si non authentifié, 403 si l'utilisateur est MODERATEUR,
 *                 sinon appelle next().
 */
export function requireNotModerator(req, res, next) {
  // Étape 1 : vérifier qu'une session utilisateur est active.
  if (!req.session || !req.session.user) {
    // 401 Unauthorized : aucune session trouvée.
    return res.status(401).json({ message: "Non autorise" });
  }

  // Étape 2 : bloquer spécifiquement les modérateurs.
  // Les ADMIN et UTILISATEUR passent sans problème.
  if (req.session.user.role === "MODERATEUR") {
    // 403 Forbidden : les modérateurs n'ont pas accès à cette ressource.
    return res.status(403).json({ message: "Acces refuse aux moderateurs" });
  }

  // L'utilisateur n'est pas un MODERATEUR → accès accordé.
  return next();
}

/**
 * Fonction utilitaire (helper) — vérifie si un objet utilisateur a un rôle élevé.
 *
 * Cette fonction NE modifie PAS le flux de la requête HTTP ; elle ne s'utilise pas
 * comme middleware Express, mais comme un prédicat booléen dans la logique métier
 * (ex. : pour décider d'inclure ou non certains champs dans une réponse, ou pour
 * conditionner un comportement côté contrôleur).
 *
 * Un rôle est considéré "élevé" si l'utilisateur est ADMIN ou MODERATEUR.
 *
 * @param {{ role: string }} user - L'objet utilisateur (doit posséder une propriété `role`).
 * @returns {boolean} `true` si l'utilisateur est ADMIN ou MODERATEUR, `false` sinon.
 *
 * @example
 * // Dans un contrôleur, pour conditionner l'affichage de données sensibles :
 * if (isElevated(req.session.user)) {
 *   // Inclure des informations supplémentaires réservées au staff
 * }
 */
export function isElevated(user) {
  // Retourne vrai uniquement pour les deux rôles privilégiés.
  // UTILISATEUR retournera false.
  return user.role === "ADMIN" || user.role === "MODERATEUR";
}

/**
 * Export par défaut : alias vers requireAuth.
 *
 * Permet d'importer ce module sans accolades lorsqu'on n'a besoin que de la
 * vérification d'authentification de base.
 *
 * @example
 * import requireAuth from "./middlewares/auth.middleware.js";
 * router.get("/protected", requireAuth, handler);
 */
export default requireAuth;
