/**
 * @fileoverview Client HTTP unifié pour communiquer avec l'API Leon Bank.
 *
 * Ce module fournit des fonctions utilitaires pour effectuer des requêtes
 * vers le serveur Express depuis le frontend Next.js. Toutes les requêtes :
 *  - Incluent les cookies de session (credentials: "include")
 *  - Sérialisent automatiquement le corps en JSON si nécessaire
 *  - Lèvent une erreur ApiError en cas de réponse HTTP non-OK
 *  - Gèrent les réponses vides (endpoints qui ne renvoient rien)
 *
 * L'URL de base est /api (proxied par Next.js vers le serveur Express en dev).
 *
 * @module lib/api
 */

/** Type d'erreur renvoyé par l'API en cas d'échec. */
export type ApiError = {
  status?: number;
  message: string;
};

/**
 * Tente de parser un texte JSON de façon sécurisée.
 * Retourne null si le texte n'est pas du JSON valide (ex : réponse vide).
 *
 * @param text - Le texte brut de la réponse HTTP.
 * @returns L'objet parsé ou null.
 */
async function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Fonction de base pour toutes les requêtes vers l'API.
 *
 * Gère automatiquement :
 *  - L'ajout du préfixe /api à tous les chemins
 *  - L'envoi du cookie de session (credentials: "include")
 *  - La sérialisation du corps en JSON (Content-Type automatique si body présent)
 *  - La désérialisation de la réponse
 *  - Le lancement d'une ApiError si la réponse est non-OK (4xx, 5xx)
 *
 * @template T - Le type de la réponse attendue.
 * @param path - Le chemin de l'endpoint (ex: "/clients", "comptes/5")
 * @param init - Options de la requête (méthode, headers, corps, etc.)
 * @returns La réponse désérialisée du type T.
 * @throws {ApiError} Si la réponse est non-OK.
 */
export async function apiFetch<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<T> {
  // Normalisation du chemin : s'assurer qu'il commence par /
  const urlPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`/api${urlPath}`, {
    ...init,
    credentials: "include",  // Envoie le cookie de session sid avec chaque requête
    headers: {
      ...(init?.headers ?? {}),
      // Ajoute Content-Type: application/json uniquement si un corps est présent
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: (() => {
      if (init?.body === undefined) return undefined;
      if (typeof init.body === "string") return init.body;     // Déjà sérialisé
      return JSON.stringify(init.body);                        // Sérialisation automatique
    })() as any,
  });

  const text = await res.text();
  const data = await parseJsonSafely(text);

  // En cas d'erreur HTTP, extraire le message d'erreur du corps JSON
  if (!res.ok) {
    const message =
      (data as any)?.message ||              // Message dans le corps JSON (format API standard)
      (typeof data === "string" ? data : null) ||
      res.statusText ||
      "Erreur";
    throw { status: res.status, message } satisfies ApiError;
  }

  // Certains endpoints peuvent renvoyer du texte vide (ex: logout)
  if (!text) return undefined as T;
  return data as T;
}

/**
 * Requête GET — récupère des données depuis l'API.
 *
 * @template T - Type de la réponse.
 * @param path - Chemin de l'endpoint.
 */
export function apiGet<T>(path: string) {
  return apiFetch<T>(path);
}

/**
 * Requête POST — envoie des données et reçoit une réponse typée.
 *
 * @template T - Type de la réponse.
 * @param path - Chemin de l'endpoint.
 * @param body - Corps de la requête (sera sérialisé en JSON).
 */
export function apiPost<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "POST", body });
}

/**
 * Requête POST sans valeur de retour (ex: logout, actions sans réponse).
 *
 * @param path - Chemin de l'endpoint.
 * @param body - Corps de la requête.
 */
export function apiPostVoid(path: string, body: unknown) {
  return apiFetch<void>(path, { method: "POST", body });
}

/**
 * Requête PATCH — mise à jour partielle d'une ressource.
 *
 * @template T - Type de la réponse.
 * @param path - Chemin de l'endpoint.
 * @param body - Corps optionnel de la requête.
 */
export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body });
}

/**
 * Requête DELETE — suppression d'une ressource.
 *
 * @template T - Type de la réponse (void par défaut).
 * @param path - Chemin de l'endpoint.
 */
export function apiDelete<T = void>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}

/**
 * Télécharge un fichier CSV depuis l'API et déclenche le téléchargement dans le navigateur.
 *
 * Utilise l'API Blob pour créer un lien de téléchargement temporaire.
 * Le lien est automatiquement nettoyé après le clic.
 *
 * @param path     - Chemin de l'endpoint d'export CSV.
 * @param filename - Nom du fichier téléchargé (ex: "clients.csv").
 * @throws {ApiError} Si la réponse est non-OK.
 */
export async function apiDownloadCSV(path: string, filename: string): Promise<void> {
  const urlPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`/api${urlPath}`, { credentials: "include" });

  if (!res.ok) {
    const text = await res.text();
    const data = await parseJsonSafely(text);
    throw { status: res.status, message: (data as any)?.message || "Erreur export" } satisfies ApiError;
  }

  // Création d'un lien de téléchargement temporaire à partir du Blob reçu
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();                           // Déclenchement automatique du téléchargement
  document.body.removeChild(a);       // Nettoyage du DOM
  URL.revokeObjectURL(url);           // Libération de la mémoire du Blob
}

/**
 * Requête POST avec corps multipart/form-data (pour l'upload de fichiers).
 *
 * Contrairement à apiPost, cette fonction n'ajoute PAS Content-Type manuellement :
 * le navigateur le génère automatiquement avec le boundary correct pour multipart.
 *
 * @template T - Type de la réponse.
 * @param path     - Chemin de l'endpoint.
 * @param formData - Données du formulaire incluant les fichiers.
 * @returns La réponse désérialisée du type T.
 * @throws {ApiError} Si la réponse est non-OK.
 */
export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  const urlPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`/api${urlPath}`, {
    method: "POST",
    credentials: "include",
    body: formData,  // Le navigateur gère automatiquement Content-Type: multipart/form-data
  });

  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* réponse vide ou non-JSON */ }

  if (!res.ok) {
    const message = (data as any)?.message || res.statusText || "Erreur";
    throw { status: res.status, message };
  }
  return data as T;
}
