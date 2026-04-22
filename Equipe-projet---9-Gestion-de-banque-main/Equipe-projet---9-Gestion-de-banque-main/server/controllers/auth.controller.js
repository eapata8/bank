/**
 * @fileoverview Contrôleur d'authentification — Leon Bank.
 *
 * Ce module gère toutes les opérations liées à l'authentification et à la
 * gestion des comptes utilisateurs :
 *  - Connexion / déconnexion (sessions)
 *  - Inscription d'un nouvel utilisateur standard
 *  - Création et suppression de modérateurs (par les ADMIN)
 *  - Consultation du journal d'audit (par les ADMIN)
 *
 * Toutes les fonctions suivent la convention Express (req, res) => Promise<Response>.
 *
 * @module controllers/auth
 */

import {
  createUser,
  deleteModerateur as deleteModerateurRecord,
  findModerateurs,
  findUserByEmail,
  findUserIdByEmail,
  upsertConfiguredAdmin,
  verifyPassword,
} from "../data/auth.data.js";
import { createAuditLog, findRecentAuditLogs } from "../data/audit.data.js";

/**
 * Connecte un utilisateur et crée une session.
 *
 * Recherche l'utilisateur par email, vérifie le mot de passe avec bcrypt,
 * puis stocke l'objet utilisateur dans req.session.user.
 * Un message générique "Identifiants invalides" est renvoyé dans les deux
 * cas d'échec (email inexistant ou mot de passe incorrect) pour ne pas
 * révéler si l'email existe dans le système.
 *
 * @async
 * @route POST /api/auth/login
 * @param {import("express").Request}  req - Corps : { email, motDePasse }
 * @param {import("express").Response} res - 200 { message, user } | 401 | 500
 */
export const login = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    // Recherche de l'utilisateur en base de données
    const userRow = await findUserByEmail(email);

    if (!userRow) {
      // Email inexistant : même message que mot de passe incorrect pour éviter l'énumération
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    // Vérification bcrypt du mot de passe (comparaison à temps constant)
    const isValidPassword = await verifyPassword(motDePasse, userRow.mot_de_passe_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    // Construction de l'objet utilisateur de session (sans le hash du mot de passe)
    const user = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      prenom: userRow.prenom,
      nom: userRow.nom,
    };

    // Régénération de l'ID de session pour empêcher les attaques de session fixation :
    // un attaquant ne peut pas réutiliser un cookie `sid` posé chez la victime avant le login.
    // express-session garantit que l'ancienne session est détruite côté store.
    return req.session.regenerate((regenErr) => {
      if (regenErr) {
        return res.status(500).json({ message: "Erreur serveur" });
      }
      req.session.user = user;
      // Persister explicitement avant de répondre (sinon le cookie peut être posé sans données)
      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ message: "Erreur serveur" });
        }
        return res.json({ message: "Connecte", user });
      });
    });
  } catch {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Déconnecte l'utilisateur en détruisant la session.
 *
 * La session est détruite côté serveur (supprimée du store MySQL)
 * et le cookie de session est effacé côté client.
 *
 * @route POST /api/auth/logout
 * @param {import("express").Request}  req - Session active requise.
 * @param {import("express").Response} res - 200 { message }
 */
export const logout = (req, res) => {
  // Destruction de la session dans le store MySQL
  req.session.destroy(() => {
    // Effacement du cookie de session côté client
    res.clearCookie("sid");
    res.json({ message: "Deconnecte" });
  });
};

/**
 * Retourne les informations de l'utilisateur actuellement connecté.
 *
 * Utilisé par le frontend au démarrage pour vérifier si une session active existe
 * et pour récupérer les informations de l'utilisateur (nom, rôle, etc.).
 *
 * @route GET /api/auth/me
 * @param {import("express").Request}  req - Session active requise.
 * @param {import("express").Response} res - 200 { user }
 */
export const me = (req, res) => {
  // req.session.user est garanti présent grâce au middleware requireAuth sur cette route
  return res.json({ user: req.session.user });
};

/**
 * Inscrit un nouvel utilisateur avec le rôle UTILISATEUR.
 *
 * Le rôle est forcé à "UTILISATEUR" quelle que soit la valeur envoyée :
 * un utilisateur ne peut pas s'auto-attribuer un rôle ADMIN ou MODERATEUR.
 * Les comptes ADMIN ne peuvent être créés que via la configuration serveur.
 *
 * @async
 * @route POST /api/auth/register
 * @param {import("express").Request}  req - Corps : { email, motDePasse, prenom, nom, role }
 * @param {import("express").Response} res - 201 { message, id } | 403 | 409 | 500
 */
export const register = async (req, res) => {
  try {
    const { email, motDePasse, prenom, nom, role } = req.body;

    if (!email || !motDePasse || !prenom || !nom) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    // Vérification de l'unicité de l'email
    const existingUser = await findUserIdByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "Email deja utilise" });
    }

    // Bloquer explicitement la tentative de créer un compte ADMIN via l'inscription publique
    if (role === "ADMIN") {
      return res.status(403).json({
        message: "La creation d'un compte admin est reservee a la configuration serveur",
      });
    }

    // Forcer le rôle UTILISATEUR quelle que soit la valeur reçue
    const safeRole = "UTILISATEUR";
    const result = await createUser({ email, motDePasse, role: safeRole, prenom, nom });

    return res.status(201).json({ message: "Utilisateur cree", id: result.insertId });
  } catch {
    // On ne renvoie pas err.message au client : éviterait de fuiter détails de schéma SQL,
    // chemins de fichiers, etc. Le détail reste loggé côté serveur via le middleware d'erreur.
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Crée un nouveau compte modérateur (réservé aux ADMIN).
 *
 * Le modérateur créé peut approuver/rejeter les dépôts et retraits,
 * et consulter les données clients. Un log d'audit est enregistré.
 *
 * @async
 * @route POST /api/auth/moderateurs
 * @param {import("express").Request}  req - Corps : { email, motDePasse, prenom, nom }
 * @param {import("express").Response} res - 201 { message, id } | 409 | 500
 */
export const createModerateur = async (req, res) => {
  try {
    const adminUser = req.session.user;
    const { email, motDePasse, prenom, nom } = req.body;

    if (!email || !motDePasse || !prenom || !nom) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    // Vérification que l'email n'est pas déjà utilisé
    const existingUser = await findUserIdByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "Email deja utilise" });
    }

    // Création du compte avec le rôle MODERATEUR
    const result = await createUser({
      email,
      motDePasse,
      role: "MODERATEUR",
      prenom,
      nom,
    });

    // Traçabilité : enregistrement de l'action dans le journal d'audit
    await createAuditLog({
      utilisateurId: adminUser.id,
      roleUtilisateur: adminUser.role,
      action: "CREATE_MODERATEUR",
      details: `Moderateur cree: ${email}`,
    });

    return res.status(201).json({ message: "Moderateur cree", id: result.insertId });
  } catch {
    // On ne renvoie pas err.message au client : éviterait de fuiter détails de schéma SQL,
    // chemins de fichiers, etc. Le détail reste loggé côté serveur via le middleware d'erreur.
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Retourne la liste de tous les modérateurs actifs.
 *
 * @async
 * @route GET /api/auth/moderateurs
 * @param {import("express").Request}  _req - Aucun paramètre requis.
 * @param {import("express").Response} res  - 200 { data: [...] } | 500
 */
export const getModerateurs = async (_req, res) => {
  try {
    const rows = await findModerateurs();
    return res.json({ data: rows });
  } catch {
    // On ne renvoie pas err.message au client : éviterait de fuiter détails de schéma SQL,
    // chemins de fichiers, etc. Le détail reste loggé côté serveur via le middleware d'erreur.
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Supprime un compte modérateur par son identifiant.
 *
 * La suppression est protégée par la couche data (vérification que
 * l'utilisateur est bien un MODERATEUR avant de supprimer).
 * Un log d'audit est enregistré.
 *
 * @async
 * @route DELETE /api/auth/moderateurs/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message } | 404 | 500
 */
export const deleteModerateur = async (req, res) => {
  try {
    const adminUser = req.session.user;
    const moderateurId = Number(req.params.id);

    if (isNaN(moderateurId) || moderateurId <= 0) {
      return res.status(400).json({ message: "id invalide" });
    }

    // Tentative de suppression (retourne 0 si non trouvé ou pas un MODERATEUR)
    const affected = await deleteModerateurRecord(moderateurId);

    if (affected === 0) {
      return res.status(404).json({ message: "Moderateur introuvable" });
    }

    // Traçabilité de la suppression
    await createAuditLog({
      utilisateurId: adminUser.id,
      roleUtilisateur: adminUser.role,
      action: "DELETE_MODERATEUR",
      details: `Moderateur id=${moderateurId} supprime`,
    });

    return res.json({ message: "Moderateur supprime" });
  } catch {
    // On ne renvoie pas err.message au client : éviterait de fuiter détails de schéma SQL,
    // chemins de fichiers, etc. Le détail reste loggé côté serveur via le middleware d'erreur.
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Retourne les entrées récentes du journal d'audit.
 *
 * La consultation du journal est elle-même enregistrée dans l'audit
 * pour la traçabilité complète. La limite est bornée entre 1 et 200.
 *
 * @async
 * @route GET /api/auth/logs
 * @param {import("express").Request}  req - Query : { limit? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getAuditLogs = async (req, res) => {
  try {
    // La limite par défaut est 50, bornée à 200 maximum dans findRecentAuditLogs
    const limit = Number(req.query?.limit || 50);
    const rows = await findRecentAuditLogs(limit);

    // Enregistrement de la consultation elle-même dans l'audit
    await createAuditLog({
      utilisateurId: req.session.user.id,
      roleUtilisateur: req.session.user.role,
      action: "VIEW_AUDIT_LOGS",
      details: `Consultation du journal d'audit (${Math.max(1, Math.min(limit || 50, 200))} lignes)`,
    });

    return res.json({ data: rows });
  } catch {
    // On ne renvoie pas err.message au client : éviterait de fuiter détails de schéma SQL,
    // chemins de fichiers, etc. Le détail reste loggé côté serveur via le middleware d'erreur.
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

export default { login, logout, me, register, createModerateur, getModerateurs, deleteModerateur, getAuditLogs };
