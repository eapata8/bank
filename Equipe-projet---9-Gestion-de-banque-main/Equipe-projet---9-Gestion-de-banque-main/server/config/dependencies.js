/**
 * @fileoverview Centralisation et export des dépendances partagées du serveur.
 *
 * Ce module regroupe en un seul endroit toutes les dépendances npm utilisées
 * par l'application Express. L'objectif est de simplifier les imports dans
 * les différents modules et d'avoir une version unique de chaque dépendance.
 *
 * Note : dans l'architecture actuelle, la plupart des modules importent
 * directement leurs dépendances. Ce fichier sert de registre de référence
 * pour documenter les dépendances disponibles.
 *
 * @module server/config/dependencies
 */

import express from "express";
import session from "express-session";
import MySQLSession from "express-mysql-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import mysql2 from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

/**
 * Objet centralisant toutes les dépendances principales de l'application.
 *
 * @property {Function}  express     - Framework web Express.js
 * @property {Function}  session     - Middleware de gestion des sessions (express-session)
 * @property {Function}  MySQLStore  - Store de sessions MySQL (express-mysql-session configuré)
 * @property {Function}  cookieParser - Middleware de parsing des cookies
 * @property {Function}  cors        - Middleware de gestion du Cross-Origin Resource Sharing
 * @property {object}    mysql2      - Driver MySQL2 avec support des Promises
 * @property {object}    dotenv      - Chargement des variables d'environnement depuis .env
 * @property {object}    path        - Utilitaires Node.js pour les chemins de fichiers
 * @property {string}    version     - Version de l'API (utilisée pour la documentation)
 */
export default {
  express,
  session,
  MySQLStore: MySQLSession(session), // Initialisation du store avec inject de session pour compatibilité
  cookieParser,
  cors,
  mysql2,
  dotenv,
  path,
  version: "1.0.0",
};
