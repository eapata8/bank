/**
 * @fileoverview Contrôleur pour la gestion des cartes de crédit.
 *
 * Ce module gère toutes les opérations sur les cartes de crédit bancaires :
 *  - Consultation des cartes (filtrée selon le rôle)
 *  - Création de cartes (ADMIN uniquement, génération du numéro et CVV)
 *  - Changement de statut : bloquer (admin), activer (admin), geler (utilisateur), dégeler
 *  - Modification de la limite de crédit (admin)
 *  - Modification du solde utilisé (admin — correction manuelle)
 *  - Remboursement via un compte bancaire (utilisateur ou admin)
 *
 * Hiérarchie des statuts :
 *  ACTIVE ↔ GELEE (utilisateur peut geler/dégeler ses propres cartes)
 *  ACTIVE → BLOQUEE (admin seulement — blocage administratif)
 *  BLOQUEE → ACTIVE (admin seulement via /activer)
 *
 * @module controllers/cartes
 */

import {
  createCarte,
  createRemboursementTransaction,
  decrementAccountBalance,
  decrementSoldeUtilise,
  findAuthorizedCarteById,
  findCarteById,
  findCartes,
  findSourceAccountForRemboursement,
  updateCarteLimite,
  updateCarteStatut,
  updateSoldeUtilise,
} from "../data/cartes.data.js";
import { createAuditLog } from "../data/audit.data.js";
import { isElevated } from "../middlewares/auth.middleware.js";

/**
 * Retourne la liste des cartes de crédit selon les droits de l'utilisateur.
 *
 * Admin/modérateur : toutes les cartes, filtrables.
 * Utilisateur : uniquement ses propres cartes.
 *
 * @async
 * @route GET /api/cartes
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getCartes = async (req, res) => {
  try {
    const user = req.session.user;
    const rows = await findCartes({
      userId: user.id,
      canReadAll: isElevated(user),
      search: String(req.query?.search || "").trim(),
    });

    // Log d'audit pour les consultations globales (admin/modérateur)
    if (isElevated(user)) {
      await createAuditLog({
        utilisateurId: user.id,
        roleUtilisateur: user.role,
        action: "VIEW_GLOBAL_CARTES",
        details: req.query?.search
          ? `Recherche: ${String(req.query.search).trim()}`
          : "Consultation globale des cartes",
      });
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne les détails d'une carte par son identifiant.
 *
 * Admin/modérateur : accès direct.
 * Utilisateur : accès uniquement à ses propres cartes.
 *
 * @async
 * @route GET /api/cartes/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { data: carte } | 403 | 404 | 500
 */
export const getCarteById = async (req, res) => {
  try {
    const user = req.session.user;
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });

    const carte = isElevated(user)
      ? await findCarteById(carteId)
      : await findAuthorizedCarteById(user.id, carteId);

    if (!carte) {
      // Distinguer inexistant (404) de non autorisé (403)
      const existingCarte = await findCarteById(carteId);
      if (!existingCarte) {
        return res.status(404).json({ message: "Carte introuvable" });
      }
      return res.status(403).json({ message: "Acces refuse" });
    }

    return res.json({ data: carte });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Crée une nouvelle carte de crédit pour un client (ADMIN uniquement).
 *
 * Génère automatiquement :
 *  - Un numéro de carte réaliste (préfixe 4xxx pour VISA, 5xxx pour Mastercard)
 *  - Un CVV à 3 chiffres
 *  - Les 4 derniers chiffres peuvent être fournis manuellement ou générés
 *
 * @async
 * @route POST /api/cartes
 * @param {import("express").Request}  req - Corps : { client_id, last_four?, type_carte, limite_credit, date_expiration }
 * @param {import("express").Response} res - 201 { message, id } | 500
 */
export const createCarteItem = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === "MODERATEUR") {
      return res.status(403).json({ message: "Accès refusé" });
    }
    const { client_id, last_four, type_carte, limite_credit, date_expiration } = req.body;
    if (!client_id || !type_carte || !limite_credit || !date_expiration) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    if (!["VISA", "MASTERCARD"].includes(type_carte)) {
      return res.status(400).json({ message: "Type de carte invalide" });
    }
    const limiteValue = Number(limite_credit);
    if (limiteValue <= 0 || isNaN(limiteValue)) {
      return res.status(400).json({ message: "La limite doit etre positive" });
    }

    // Les 4 derniers chiffres : fournis manuellement ou générés aléatoirement
    let lastFour = String(last_four ?? "").trim();
    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      return res.status(400).json({ message: "last_four doit contenir exactement 4 chiffres" });
    }
    if (!lastFour) {
      lastFour = String(Math.floor(1000 + Math.random() * 9000));
    }

    // Génération d'un numéro de carte réaliste à 16 chiffres
    function rand4() {
      return String(Math.floor(1000 + Math.random() * 9000));
    }
    // VISA commence par 4, Mastercard par 5 (standards réels)
    const prefix = type_carte === "VISA" ? "4" : "5";
    const g1 = prefix + String(Math.floor(100 + Math.random() * 900)); // 4 chiffres avec le bon préfixe
    const g2 = rand4();
    const g3 = rand4();
    const numeroCompte = `${g1} ${g2} ${g3} ${lastFour}`;
    const cvv = String(Math.floor(100 + Math.random() * 900)); // CVV à 3 chiffres

    const result = await createCarte({
      clientId: Number(client_id),
      numeroCompte,
      cvv,
      typeCarte: type_carte,
      limiteCredit: limiteValue,
      dateExpiration: date_expiration,
    });

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "CREATE_CARTE",
      details: `Carte #${result.insertId} creee pour client ${client_id} (${type_carte} ${numeroCompte})`,
    });

    return res.status(201).json({ message: "Carte creee", id: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Bloque administrativement une carte (ADMIN uniquement).
 *
 * Le blocage est une mesure admin permanente (fraude, contentieux).
 * Seul un admin peut débloquer une carte BLOQUEE via /activer.
 * Une carte GELEE peut aussi être bloquée (upgrade du gel vers blocage admin).
 *
 * @async
 * @route PATCH /api/cartes/:id/bloquer
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const bloquerCarte = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role !== "ADMIN") return res.status(403).json({ message: "Accès refusé" });
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });

    const carte = await findCarteById(carteId);
    if (!carte) {
      return res.status(404).json({ message: "Carte introuvable" });
    }

    // Empêcher de bloquer une carte déjà bloquée
    if (carte.statut === "BLOQUEE") {
      return res.status(400).json({ message: "La carte est deja bloquee" });
    }
    // Note : une carte GELEE peut être bloquée (passage du gel user au blocage admin)

    await updateCarteStatut(carteId, "BLOQUEE");

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "BLOQUER_CARTE",
      details: `Carte #${carteId} bloquee (${carte.numero_compte})`,
    });

    return res.json({ message: "Carte bloquee avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Active (ou réactive) une carte (ADMIN uniquement).
 *
 * Permet de réactiver une carte BLOQUEE ou GELEE.
 * Seul l'admin peut utiliser cette action (les utilisateurs utilisent /degeler).
 *
 * @async
 * @route PATCH /api/cartes/:id/activer
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const activerCarte = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role !== "ADMIN") return res.status(403).json({ message: "Accès refusé" });
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });

    const carte = await findCarteById(carteId);
    if (!carte) {
      return res.status(404).json({ message: "Carte introuvable" });
    }

    // Empêcher d'activer une carte déjà active
    if (carte.statut === "ACTIVE") {
      return res.status(400).json({ message: "La carte est deja active" });
    }

    await updateCarteStatut(carteId, "ACTIVE");

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "ACTIVER_CARTE",
      details: `Carte #${carteId} activee (${carte.numero_compte})`,
    });

    return res.json({ message: "Carte activee avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Gèle une carte — mesure de sécurité temporaire initiée par l'utilisateur.
 *
 * Contrairement au blocage admin, le gel peut être effectué par l'utilisateur
 * lui-même (ex : carte perdue temporairement). L'utilisateur peut aussi la dégeler.
 * Un admin peut geler n'importe quelle carte.
 *
 * Restrictions : impossible de geler une carte déjà gelée, bloquée ou expirée.
 *
 * @async
 * @route PATCH /api/cartes/:id/geler
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 403 | 404 | 500
 */
export const gelerCarte = async (req, res) => {
  try {
    const user = req.session.user;
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });

    // Admin peut geler n'importe quelle carte ; l'utilisateur seulement les siennes
    const carte = user.role === "ADMIN"
      ? await findCarteById(carteId)
      : await findAuthorizedCarteById(user.id, carteId);

    if (!carte) {
      const exists = await findCarteById(carteId);
      if (!exists) return res.status(404).json({ message: "Carte introuvable" });
      return res.status(403).json({ message: "Acces refuse" });
    }

    // Validation du statut actuel avant le gel
    if (carte.statut === "GELEE") {
      return res.status(400).json({ message: "La carte est deja gelee" });
    }
    if (carte.statut === "BLOQUEE") {
      return res.status(400).json({ message: "La carte est bloquee administrativement - contactez l'administrateur" });
    }
    if (carte.statut === "EXPIREE") {
      return res.status(400).json({ message: "Impossible de geler une carte expiree" });
    }

    await updateCarteStatut(carteId, "GELEE");

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "GELER_CARTE",
      details: `Carte #${carteId} gelee (${carte.numero_compte})`,
    });

    return res.json({ message: "Carte gelee avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Dégèle une carte précédemment gelée par l'utilisateur.
 *
 * L'utilisateur peut dégeler ses propres cartes GELEE.
 * Un admin peut dégeler et même débloquer via cette route.
 * Un utilisateur ne peut PAS dégeler une carte BLOQUEE (blocage admin).
 *
 * @async
 * @route PATCH /api/cartes/:id/degeler
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 403 | 404 | 500
 */
export const degelerCarte = async (req, res) => {
  try {
    const user = req.session.user;
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });

    // Admin peut dégeler n'importe quelle carte ; l'utilisateur seulement les siennes
    const carte = user.role === "ADMIN"
      ? await findCarteById(carteId)
      : await findAuthorizedCarteById(user.id, carteId);

    if (!carte) {
      const exists = await findCarteById(carteId);
      if (!exists) return res.status(404).json({ message: "Carte introuvable" });
      return res.status(403).json({ message: "Acces refuse" });
    }

    // Validation du statut actuel
    if (carte.statut === "ACTIVE") {
      return res.status(400).json({ message: "La carte est deja active" });
    }
    if (carte.statut === "EXPIREE") {
      return res.status(400).json({ message: "Impossible de degeler une carte expiree" });
    }
    // Un utilisateur standard ne peut pas lever un blocage administratif
    if (carte.statut === "BLOQUEE" && user.role !== "ADMIN") {
      return res.status(403).json({ message: "Cette carte a ete bloquee par un administrateur. Contactez le support." });
    }

    await updateCarteStatut(carteId, "ACTIVE");

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "DEGELER_CARTE",
      details: `Carte #${carteId} degelee (${carte.numero_compte})`,
    });

    return res.json({ message: "Carte degelee avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Modifie la limite de crédit d'une carte (ADMIN uniquement).
 *
 * @async
 * @route PATCH /api/cartes/:id/limite
 * @param {import("express").Request}  req - Params : { id } | Corps : { limite_credit }
 * @param {import("express").Response} res - 200 { message, id } | 404 | 500
 */
export const modifierLimiteCarte = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === "MODERATEUR") return res.status(403).json({ message: "Accès refusé" });
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });
    const limiteValue = Number(req.body.limite_credit);
    if (limiteValue <= 0 || isNaN(limiteValue)) return res.status(400).json({ message: "La limite doit etre positive" });

    const carte = await findCarteById(carteId);
    if (!carte) {
      return res.status(404).json({ message: "Carte introuvable" });
    }

    await updateCarteLimite(carteId, limiteValue);

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "MODIFIER_LIMITE_CARTE",
      details: `Carte #${carteId}: limite modifiee a ${limiteValue} CAD`,
    });

    return res.json({ message: "Limite modifiee avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Modifie manuellement le solde utilisé d'une carte (ADMIN uniquement).
 *
 * Utilisé pour les corrections manuelles par l'admin.
 * Pour les remboursements normaux, utiliser POST /api/cartes/:id/rembourser.
 *
 * @async
 * @route PATCH /api/cartes/:id/solde
 * @param {import("express").Request}  req - Params : { id } | Corps : { solde_utilise }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 404 | 500
 */
export const modifierSoldeCarte = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === "MODERATEUR") return res.status(403).json({ message: "Accès refusé" });
    const carteId = Number(req.params.id);
    if (!carteId || carteId <= 0) return res.status(400).json({ message: "id invalide" });
    const soldeValue = Number(req.body.solde_utilise);
    if (soldeValue < 0 || isNaN(soldeValue)) return res.status(400).json({ message: "Le solde utilise ne peut pas etre negatif" });

    const carte = await findCarteById(carteId);
    if (!carte) {
      return res.status(404).json({ message: "Carte introuvable" });
    }

    // Le solde utilisé ne peut pas dépasser la limite de crédit accordée
    if (soldeValue > Number(carte.limite_credit)) {
      return res.status(400).json({ message: "Le solde utilise ne peut pas depasser la limite de credit" });
    }

    await updateSoldeUtilise(carteId, soldeValue);

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "MODIFIER_SOLDE_CARTE",
      details: `Carte #${carteId}: solde utilise modifie a ${soldeValue} CAD`,
    });

    return res.json({ message: "Solde utilise modifie avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Rembourse une carte de crédit en débitant un compte bancaire.
 *
 * Séquence :
 *  1. Récupération et autorisation de la carte
 *  2. Vérifications : carte non bloquée/gelée, solde carte > 0, montant <= solde carte
 *  3. Validation du compte source (appartenance, type CHEQUES/EPARGNE, solde suffisant)
 *  4. Débit du compte bancaire
 *  5. Décrémentation du solde utilisé de la carte
 *  6. Création de la transaction de remboursement
 *  7. Log d'audit
 *
 * @async
 * @route POST /api/cartes/:id/rembourser
 * @param {import("express").Request}  req - Params : { id } | Corps : { compte_id, montant }
 * @param {import("express").Response} res - 200 { message, id } | 400 | 403 | 404 | 500
 */
export const rembourserCarte = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === "MODERATEUR") return res.status(403).json({ message: "Accès refusé" });
    const carteId = Number(req.params.id);
    const compteId = Number(req.body.compte_id);
    const montant = Number(req.body.montant);
    if (!carteId || carteId <= 0 || !compteId || compteId <= 0) {
      return res.status(400).json({ message: "Carte, compte ou montant invalide" });
    }
    if (montant < 0) return res.status(400).json({ message: "Le montant doit etre positif" });

    const canAll = user.role === "ADMIN";

    // Récupération de la carte avec contrôle d'accès
    const carte = canAll
      ? await findCarteById(carteId)
      : await findAuthorizedCarteById(user.id, carteId);

    if (!carte) {
      const existingCarte = await findCarteById(carteId);
      if (!existingCarte) {
        return res.status(404).json({ message: "Carte introuvable" });
      }
      return res.status(403).json({ message: "Acces refuse" });
    }

    // Impossible de rembourser une carte bloquée ou gelée
    if (carte.statut === "BLOQUEE" || carte.statut === "GELEE") {
      return res.status(400).json({ message: "Impossible de rembourser une carte bloquee ou gelee" });
    }

    // Vérification que la carte a un solde à rembourser
    if (Number(carte.solde_utilise) === 0) {
      return res.status(400).json({ message: "Le solde de la carte est deja a zero" });
    }

    // Le remboursement ne peut pas dépasser le solde actuellement utilisé
    if (montant > Number(carte.solde_utilise)) {
      return res.status(400).json({ message: "Le montant depasse le solde utilise de la carte" });
    }

    // Validation du compte source pour le remboursement
    const account = await findSourceAccountForRemboursement({
      userId: user.id,
      compteId,
      canReadAll: canAll,
    });

    if (!account) {
      return res.status(403).json({ message: "Compte non autorise pour ce remboursement" });
    }

    // Vérification du solde du compte bancaire source
    if (Number(account.solde) < montant) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // Traitement du remboursement
    await decrementAccountBalance(compteId, montant);     // Débit du compte bancaire
    await decrementSoldeUtilise(carteId, montant);        // Crédit sur la carte (réduction du solde utilisé)
    await createRemboursementTransaction({ compteId, carteId, montant });

    await createAuditLog({
      utilisateurId: user.id,
      roleUtilisateur: user.role,
      action: "REMBOURSER_CARTE",
      details: `Remboursement de ${montant} CAD sur carte #${carteId} via compte ${compteId}`,
    });

    return res.json({ message: "Remboursement effectue avec succes", id: carteId });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default {
  getCartes,
  getCarteById,
  createCarteItem,
  bloquerCarte,
  activerCarte,
  gelerCarte,
  degelerCarte,
  modifierLimiteCarte,
  modifierSoldeCarte,
  rembourserCarte,
};
