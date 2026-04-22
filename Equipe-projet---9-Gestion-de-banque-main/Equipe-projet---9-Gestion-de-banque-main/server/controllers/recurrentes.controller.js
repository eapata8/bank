/**
 * @fileoverview Contrôleur pour la gestion des transactions récurrentes planifiées.
 *
 * Ce module permet aux utilisateurs de configurer des virements automatiques
 * qui se répètent selon une fréquence définie (hebdomadaire, mensuel, annuel).
 *
 * Fonctionnalités :
 *  - Lister ses récurrentes avec calcul des 5 prochaines dates d'exécution
 *  - Créer une nouvelle récurrente (avec validation de propriété des comptes)
 *  - Suspendre / reprendre / annuler une récurrente
 *  - Vue admin globale sur toutes les récurrentes
 *
 * @module controllers/recurrentes
 */

import {
  findRecurrentes,
  findRecurrenteById,
  createRecurrente as dbCreateRecurrente,
  updateStatutRecurrente,
  resetNbEchecsRecurrente,
  findCompteByNumero,
} from "../data/recurrentes.data.js";
import {
  findAuthorizedSourceAccount,
  findAccountById,
} from "../data/virements.data.js";
import { createAuditLog } from "../data/audit.data.js";
import { executerTransactionsRecurrentes } from "../scheduler.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper pur — calcul de la prochaine date d'exécution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule la prochaine date d'exécution selon la fréquence.
 *
 * Gère correctement les fins de mois : si le mois suivant n'a pas le même
 * jour (ex. : 31 janvier → février n'a pas de 31), on prend le dernier jour du mois.
 *
 * @param {string} frequence - HEBDOMADAIRE | MENSUEL | ANNUEL
 * @param {string} dateBase  - Date ISO de référence (YYYY-MM-DD).
 * @returns {string} Date ISO de la prochaine exécution (YYYY-MM-DD).
 */
export function calculerProchaine(frequence, dateBase) {
  const d = new Date(dateBase + "T00:00:00");

  if (frequence === "HEBDOMADAIRE") {
    d.setDate(d.getDate() + 7);
  } else if (frequence === "MENSUEL") {
    const jourOriginal = d.getDate();
    d.setMonth(d.getMonth() + 1);
    // Si setMonth a débordé sur le mois suivant (ex. 31 jan → 3 mars), reculer au dernier jour
    if (d.getDate() !== jourOriginal) {
      d.setDate(0); // Dernier jour du mois précédent (= mois voulu)
    }
  } else {
    // ANNUEL
    const jourOriginal = d.getDate();
    const moisOriginal = d.getMonth();
    d.setFullYear(d.getFullYear() + 1);
    // Gestion du 29 février en année non-bissextile
    if (d.getMonth() !== moisOriginal) {
      d.setDate(0);
    }
    if (d.getDate() !== jourOriginal && d.getMonth() === moisOriginal) {
      // Pas de débordement
    }
  }

  return d.toISOString().slice(0, 10);
}

/**
 * Normalise une valeur de date retournée par MySQL vers le format ISO YYYY-MM-DD.
 *
 * MySQL2 retourne les colonnes DATE comme des objets Date JavaScript (pas des strings).
 * Cette fonction gère les deux cas : Date object → toISOString().slice(0,10),
 * string déjà en YYYY-MM-DD → slice(0,10) pour enlever l'éventuelle heure.
 *
 * @param {Date|string|null} val - Valeur de date brute issue de la base.
 * @returns {string} Date au format YYYY-MM-DD.
 */
function toDateStr(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

/**
 * Calcule les N prochaines dates d'exécution à partir d'une date de départ.
 *
 * @param {string} frequence   - HEBDOMADAIRE | MENSUEL | ANNUEL
 * @param {string} dateDepart  - Date ISO de la prochaine exécution (YYYY-MM-DD).
 * @param {number} [n=5]       - Nombre de dates à calculer.
 * @returns {string[]} Tableau de dates ISO.
 */
function calculerProchainesN(frequence, dateDepart, n = 5) {
  const dates = [];
  let current = dateDepart;
  for (let i = 0; i < n; i++) {
    dates.push(current);
    current = calculerProchaine(frequence, current);
  }
  return dates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrôleurs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la liste des transactions récurrentes de l'utilisateur connecté.
 *
 * Ajoute sur chaque entrée un champ `prochaines_executions` contenant les
 * 5 prochaines dates planifiées (calculées en JS pur, sans appel DB).
 *
 * @async
 * @route GET /api/recurrentes
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getRecurrentes = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const isAdmin = userRole === "ADMIN";

    const rows = await findRecurrentes({ userId, isAdmin });

    // Enrichir chaque entrée avec les 5 prochaines dates d'exécution
    const data = rows.map((r) => ({
      ...r,
      prochaines_executions: calculerProchainesN(r.frequence, toDateStr(r.prochaine_execution)),
    }));

    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée une nouvelle transaction récurrente.
 *
 * Validations :
 *  - Champs obligatoires présents
 *  - Montant strictement positif
 *  - Comptes source et destination différents
 *  - Compte source appartient à l'utilisateur
 *  - Compte destination existe
 *
 * La prochaine_execution est calculée à partir de date_debut (si fournie) ou
 * d'aujourd'hui + 1 période.
 *
 * @async
 * @route POST /api/recurrentes
 * @param {import("express").Request}  req - Corps : { compte_source_id, compte_destination_id, montant, frequence, description?, date_debut?, date_fin? }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 403 | 404 | 500
 */
export const createRecurrente = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { compte_source_id, compte_destination_id, montant, frequence, description, date_debut, date_fin } = req.body;
    const montantValue = Number(montant);

    if (!compte_source_id || !compte_destination_id || !montant || !frequence) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    const FREQUENCES_VALIDES = ["HEBDOMADAIRE", "MENSUEL", "ANNUEL"];
    if (!FREQUENCES_VALIDES.includes(frequence)) {
      return res.status(400).json({ message: "Frequence invalide" });
    }

    if (montantValue <= 0) {
      return res.status(400).json({ message: "Le montant doit etre positif" });
    }

    if (Number(compte_source_id) === Number(compte_destination_id)) {
      return res.status(400).json({ message: "Les comptes source et destination doivent etre differents" });
    }

    // Vérification que le compte source appartient à l'utilisateur
    const sourceAccount = await findAuthorizedSourceAccount(userId, compte_source_id);
    if (!sourceAccount) {
      return res.status(403).json({ message: "Compte source non autorise" });
    }

    // Vérification que le compte destination existe
    const destAccount = await findAccountById(compte_destination_id);
    if (!destAccount) {
      return res.status(404).json({ message: "Compte destination introuvable" });
    }

    // Calcul de la première prochaine_execution
    let prochaineExecution;
    if (date_debut) {
      prochaineExecution = String(date_debut).slice(0, 10);
    } else {
      // Pas de date de début → première exécution dans 1 période à partir d'aujourd'hui
      const today = new Date().toISOString().slice(0, 10);
      prochaineExecution = calculerProchaine(frequence, today);
    }

    const result = await dbCreateRecurrente({
      utilisateurId: userId,
      compteSourceId: compte_source_id,
      compteDestinationId: compte_destination_id,
      montant: montantValue,
      description,
      frequence,
      prochaineExecution,
      dateFin: date_fin || null,
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "RECURRENTE_CREEE",
      details: `Recurrente #${result.insertId} — ${frequence} — ${montantValue} CAD — source: ${compte_source_id} → dest: ${compte_destination_id}`,
    });

    return res.status(201).json({ message: "Transaction recurrente creee avec succes", id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Suspend une transaction récurrente ACTIVE.
 *
 * Seul le propriétaire (ou un ADMIN) peut suspendre une récurrente.
 * La récurrente doit être au statut ACTIVE.
 *
 * @async
 * @route PATCH /api/recurrentes/:id/suspendre
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 | 400 | 403 | 404 | 500
 */
export const suspendreRecurrente = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { id } = req.params;

    const recurrente = await findRecurrenteById(Number(id));
    if (!recurrente) {
      return res.status(404).json({ message: "Transaction recurrente introuvable" });
    }

    // Vérification du droit : propriétaire ou ADMIN
    if (recurrente.utilisateur_id !== userId && userRole !== "ADMIN") {
      return res.status(403).json({ message: "Acces non autorise" });
    }

    if (recurrente.statut !== "ACTIVE") {
      return res.status(400).json({ message: "Seule une transaction ACTIVE peut etre suspendue" });
    }

    await updateStatutRecurrente(Number(id), "SUSPENDUE");

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "RECURRENTE_SUSPENDUE",
      details: `Recurrente #${id} suspendue`,
    });

    return res.json({ message: "Transaction recurrente suspendue" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Reprend une transaction récurrente SUSPENDUE.
 *
 * Remet le statut à ACTIVE et remet le compteur d'échecs à 0 via un UPDATE direct.
 *
 * @async
 * @route PATCH /api/recurrentes/:id/reprendre
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 | 400 | 403 | 404 | 500
 */
export const reprendreRecurrente = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { id } = req.params;

    const recurrente = await findRecurrenteById(Number(id));
    if (!recurrente) {
      return res.status(404).json({ message: "Transaction recurrente introuvable" });
    }

    if (recurrente.utilisateur_id !== userId && userRole !== "ADMIN") {
      return res.status(403).json({ message: "Acces non autorise" });
    }

    if (recurrente.statut !== "SUSPENDUE") {
      return res.status(400).json({ message: "Seule une transaction SUSPENDUE peut etre reprise" });
    }

    // Reprise : reset du nb_echecs + statut ACTIVE
    await resetNbEchecsRecurrente(Number(id));

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "RECURRENTE_REPRISE",
      details: `Recurrente #${id} reprise`,
    });

    return res.json({ message: "Transaction recurrente reprise" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Annule définitivement une transaction récurrente.
 *
 * Une récurrente déjà ANNULEE ou TERMINEE ne peut pas être ré-annulée.
 *
 * @async
 * @route DELETE /api/recurrentes/:id
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 | 400 | 403 | 404 | 500
 */
export const annulerRecurrente = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { id } = req.params;

    const recurrente = await findRecurrenteById(Number(id));
    if (!recurrente) {
      return res.status(404).json({ message: "Transaction recurrente introuvable" });
    }

    if (recurrente.utilisateur_id !== userId && userRole !== "ADMIN") {
      return res.status(403).json({ message: "Acces non autorise" });
    }

    if (recurrente.statut === "ANNULEE" || recurrente.statut === "TERMINEE") {
      return res.status(400).json({ message: "Cette transaction ne peut plus etre annulee" });
    }

    await updateStatutRecurrente(Number(id), "ANNULEE");

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "RECURRENTE_ANNULEE",
      details: `Recurrente #${id} annulee`,
    });

    return res.json({ message: "Transaction recurrente annulee" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Déclenche manuellement l'exécution des transactions récurrentes (admin only).
 *
 * @async
 * @route POST /api/recurrentes/admin/executer
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { message } | 500
 */
export const adminExecuterRecurrentes = async (req, res) => {
  try {
    await executerTransactionsRecurrentes();
    return res.json({ message: "Transactions récurrentes exécutées avec succès" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur lors de l'exécution des récurrentes", error: err.message });
  }
};

/**
 * Vue admin — retourne toutes les transactions récurrentes du système.
 *
 * @async
 * @route GET /api/recurrentes/admin/all
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const adminGetRecurrentes = async (req, res) => {
  try {
    const rows = await findRecurrentes({ userId: null, isAdmin: true });

    const data = rows.map((r) => ({
      ...r,
      prochaines_executions: calculerProchainesN(r.frequence, toDateStr(r.prochaine_execution)),
    }));

    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Vérifier un numéro de compte — retourne uniquement id + type + nom client, jamais le solde.
 *
 * Utilisé pour valider les comptes destinataires dans les récurrentes.
 *
 * @route GET /api/recurrentes/verifier-compte
 * @queryParam {string} numero - Numéro du compte à vérifier (ex. "CA0012345")
 * @returns {Object} { id, type_compte, client_nom }
 * @throws {400} Si numero est absent ou vide, ou si le compte est inactif
 * @throws {404} Si aucun compte ne correspond
 * @throws {500} Erreur serveur
 */
export const verifierCompte = async (req, res) => {
  try {
    const { numero } = req.query;

    // Validation : numero est obligatoire et non vide
    if (!numero || typeof numero !== "string" || !numero.trim()) {
      return res.status(400).json({ message: "Le paramètre 'numero' est obligatoire" });
    }

    const numeroTrimmed = numero.trim();
    const compte = await findCompteByNumero(numeroTrimmed);

    if (!compte) {
      return res.status(404).json({ message: "Compte non trouvé" });
    }

    // Vérifier que le compte est actif
    if (!compte.est_actif) {
      return res.status(400).json({ message: "Le compte est inactif" });
    }

    // Retourner uniquement les informations non-sensibles
    return res.json({
      id: compte.id,
      type_compte: compte.type_compte,
      client_nom: compte.client_nom,
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default {
  getRecurrentes,
  createRecurrente,
  suspendreRecurrente,
  reprendreRecurrente,
  annulerRecurrente,
  adminGetRecurrentes,
  adminExecuterRecurrentes,
  verifierCompte,
};
