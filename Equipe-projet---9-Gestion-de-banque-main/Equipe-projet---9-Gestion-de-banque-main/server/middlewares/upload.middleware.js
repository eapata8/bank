/**
 * @fileoverview Middleware d'upload de fichiers pour les dépôts par chèque.
 *
 * Ce module configure Multer pour gérer l'upload d'images de chèques lors
 * de la soumission d'un dépôt. Les fichiers sont stockés sur le disque
 * dans le répertoire uploads/depots/ avec un nom unique horodaté.
 *
 * Contraintes appliquées :
 *  - Types acceptés : JPEG, PNG, WEBP, GIF (images uniquement)
 *  - Taille maximale : 5 Mo par fichier
 *  - Nom de fichier : "cheque-{timestamp}.{extension}"
 *  - Champ de formulaire attendu : "photo_cheque"
 *
 * @module middlewares/upload
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Reconstruction de __dirname pour les modules ES (non disponible nativement)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chemin absolu vers le répertoire de stockage des images de chèques
const uploadDir = path.join(__dirname, "../../uploads/depots");

// Création automatique du répertoire s'il n'existe pas encore
// (ex : premier démarrage du serveur ou après suppression manuelle)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // recursive: true crée les dossiers parents si nécessaire
}

/**
 * Configuration du stockage Multer sur disque.
 *
 * - destination : dossier cible pour les fichiers uploadés
 * - filename    : génère un nom unique "cheque-{timestamp}.{ext}" pour éviter les collisions
 */
const storage = multer.diskStorage({
  // Détermine le répertoire de destination du fichier uploadé
  destination: (_req, _file, cb) => cb(null, uploadDir),

  // Génère un nom de fichier unique basé sur l'horodatage Unix (millisecondes)
  // L'extension est normalisée en minuscules (.JPG → .jpg)
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cheque-${Date.now()}${ext}`);
  },
});

/**
 * Filtre de validation du type MIME des fichiers uploadés.
 *
 * Seules les images sont acceptées pour les photos de chèques.
 * Les fichiers d'autres types (PDF, exécutables, etc.) sont rejetés
 * avec une erreur explicite.
 *
 * @param {import("express").Request} _req - La requête HTTP (non utilisée ici).
 * @param {Express.Multer.File} file - Le fichier en cours d'upload.
 * @param {Function} cb - Callback Multer : cb(error, accepter).
 */
function fileFilter(_req, file, cb) {
  // Liste blanche des types MIME autorisés
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (allowed.includes(file.mimetype)) {
    // Fichier valide : on l'accepte
    cb(null, true);
  } else {
    // Fichier invalide : on le rejette avec un message d'erreur clair
    cb(new Error("Seules les images sont acceptées (JPEG, PNG, WEBP)"));
  }
}

/**
 * Middleware Multer configuré pour l'upload d'une photo de chèque.
 *
 * Ce middleware doit être utilisé sur la route POST /api/depots avant
 * le middleware de validation. Il gère :
 *  - Le stockage du fichier sur disque
 *  - La validation du type MIME
 *  - La limitation de taille (5 Mo max)
 *
 * Après exécution, le fichier est disponible via req.file.
 *
 * @example
 * // Dans les routes :
 * router.post("/", requireNotModerator, uploadCheque, validateCreateDepot, depots.createDepot);
 */
export const uploadCheque = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite à 5 Mo (5 × 1024 × 1024 octets)
}).single("photo_cheque"); // N'accepte qu'un seul fichier dans le champ "photo_cheque"
