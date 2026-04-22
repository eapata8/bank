/**
 * @fileoverview Point d'entrée principal du serveur Express — Leon Bank API.
 *
 * Ce fichier initialise et configure l'application Express :
 *  - Chargement des variables d'environnement (.env)
 *  - Middleware JSON et fichiers statiques
 *  - Sessions persistantes stockées en base MySQL
 *  - Montage de toutes les routes API
 *  - Démarrage du serveur sur le port configuré
 *
 * @module server/index
 */

import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import MySQLSession from "express-mysql-session";

// Importation de toutes les routes de l'application
import clientsRoutes from "./routes/clients.routes.js";
import comptesRoutes from "./routes/comptes.routes.js";
import virementsRoutes from "./routes/virements.routes.js";
import authRoutes from "./routes/auth.routes.js";
import facturesRoutes from "./routes/factures.routes.js";
import cartesRoutes from "./routes/cartes.routes.js";
import depotsRoutes from "./routes/depots.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import exportRoutes from "./routes/export.routes.js";
import retraitsRoutes from "./routes/retraits.routes.js";
import interacRoutes from "./routes/interac.routes.js";
import recurrentesRoutes from "./routes/recurrentes.routes.js";
import beneficiairesRoutes from "./routes/beneficiaires.routes.js";
import simulationRoutes from "./routes/simulation.routes.js";
import demandesProduitsRoutes from "./routes/demandes_produits.routes.js";
import { executerTransactionsRecurrentes } from "./scheduler.js";

// Charge les variables d'environnement depuis le fichier .env (DB_HOST, SESSION_SECRET, etc.)
dotenv.config();

// Refuser de démarrer si SESSION_SECRET n'est pas défini en production
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.error("❌ SESSION_SECRET est requis en production. Arrêt du serveur.");
  process.exit(1);
}

// __dirname n'est pas disponible nativement avec les modules ES — on le recrée manuellement
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Permet de lire les corps de requêtes JSON (Content-Type: application/json)
app.use(express.json());

// Sert les fichiers uploadés (photos de chèques, etc.) depuis le dossier /uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* ── Configuration du store de sessions MySQL ─────────────────────────── */

// MySQLStore est initialisé en injectant la dépendance `session` pour éviter
// les conflits de versions entre express-session et express-mysql-session
const MySQLStore = MySQLSession(session);

// Le store de sessions utilise les mêmes credentials que la base de données principale
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/* ── Configuration du middleware de session ──────────────────────────── */

app.use(
  session({
    key: "sid",                                              // Nom du cookie de session
    secret: process.env.SESSION_SECRET || "dev_secret_change_me", // Clé de signature du cookie
    store: sessionStore,                                     // Persistance MySQL
    resave: false,                                           // Ne pas re-sauvegarder si pas de modification
    saveUninitialized: false,                               // Ne pas créer de session vide
    cookie: {
      httpOnly: true,                                        // Inaccessible depuis JavaScript côté client (protection XSS)
      sameSite: "lax",                                       // Protection CSRF basique
      maxAge: 1000 * 60 * 60 * 2,                           // Durée de vie : 2 heures (en ms)
      secure: process.env.NODE_ENV === "production",         // HTTPS uniquement en production
    },
  })
);

/* ── Route de santé ──────────────────────────────────────────────────── */

// Route racine simple pour vérifier que l'API répond correctement
app.get("/", (req, res) => res.json({ message: "Leon Bank API OK" }));

/* ── Montage des routes API ──────────────────────────────────────────── */

app.use("/api/auth", authRoutes);           // Authentification, inscription, sessions
app.use("/api/clients", clientsRoutes);     // Gestion des clients bancaires
app.use("/api/comptes", comptesRoutes);     // Comptes bancaires (CHEQUES, EPARGNE, CREDIT)
app.use("/api/virements", virementsRoutes); // Virements internes et externes
app.use("/api/factures", facturesRoutes);   // Factures et paiements de factures
app.use("/api/cartes", cartesRoutes);       // Cartes de crédit (VISA, Mastercard)
app.use("/api/depots", depotsRoutes);       // Dépôts par chèque avec image
app.use("/api/admin", adminRoutes);         // Administration (ADMIN/MODERATEUR seulement)
app.use("/api/export", exportRoutes);       // Export CSV (audit, transactions, etc.)
app.use("/api/retraits", retraitsRoutes);   // Retraits en espèces
app.use("/api/interac", interacRoutes);     // Virements Interac par courriel
app.use("/api/recurrentes", recurrentesRoutes);     // Transactions récurrentes planifiées
app.use("/api/beneficiaires", beneficiairesRoutes); // Bénéficiaires Interac sauvegardés
app.use("/api/simulation", simulationRoutes);           // Mode simulation — snapshots / restauration
app.use("/api/demandes-produits", demandesProduitsRoutes); // Demandes de produits financiers

/* ── Démarrage du serveur ────────────────────────────────────────────── */

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);

  executerTransactionsRecurrentes();
  setInterval(executerTransactionsRecurrentes, 60 * 60 * 1000);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[ERREUR] Le port ${PORT} est déjà utilisé par un autre processus.\nTue-le avec : npx kill-port ${PORT}\n`);
  } else {
    console.error("[ERREUR] Démarrage du serveur :", err.message);
  }
  process.exit(1);
});

// Arrêt propre sur signal SIGTERM (Docker, Kubernetes, PM2, etc.)
process.on("SIGTERM", () => {
  console.log("SIGTERM reçu — arrêt propre du serveur...");
  server.close(() => {
    console.log("Serveur arrêté proprement.");
    process.exit(0);
  });
});

export default app;
