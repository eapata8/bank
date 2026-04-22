/**
 * @fileoverview Configuration et export du pool de connexions MySQL.
 *
 * Ce module crée un pool de connexions réutilisables vers la base de données MySQL.
 * L'utilisation d'un pool (plutôt qu'une connexion unique) permet de :
 *  - Gérer plusieurs requêtes simultanées sans attente
 *  - Réutiliser les connexions existantes (économie de ressources)
 *  - Limiter le nombre de connexions ouvertes en parallèle (connectionLimit)
 *
 * Les paramètres de connexion sont lus depuis les variables d'environnement
 * définies dans le fichier .env à la racine du projet.
 *
 * @module server/db
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Charge les variables d'environnement (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)
dotenv.config();

/**
 * Pool de connexions MySQL partagé par toute l'application.
 *
 * Toutes les couches d'accès aux données (fichiers data/*.js) importent
 * ce pool pour exécuter leurs requêtes SQL via pool.query().
 *
 * @type {import('mysql2/promise').Pool}
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),  // Par défaut : port MySQL standard 3306
  waitForConnections: true,                    // Mettre les requêtes en file si toutes les connexions sont occupées
  connectionLimit: 10,                         // Maximum 10 connexions simultanées dans le pool
});

export default pool;
