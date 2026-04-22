/**
 * @fileoverview Contrôleur pour les virements Interac e-Transfer.
 *
 * Implémente la logique métier complète des virements par courriel :
 *
 * Auto-dépôt (flow 1 étape) :
 *  1. demanderAutoDeposit — active directement le profil sur l'email fourni
 *  2. desactiverAutoDeposit — désactive le profil (statut EN_ATTENTE)
 *
 * Envoi (sendTransfert) :
 *  - Validation des limites : 0,50$/min · 3 000$/transfert · 3 000$/jour · 10 000$/mois
 *  - Interdit : envoyer à sa propre adresse
 *  - Validation mot de passe : longueur, pas l'email, pas le montant
 *  - Débit immédiat du compte source (fonds réservés)
 *  - Auto-dépôt actif → ACCEPTEE immédiat ; sinon EN_ATTENTE + mdp bcrypt
 *
 * Réclamation (reclamerTransfert) :
 *  - Vérifie statut, expiration, appartenance email, mot de passe bcrypt
 *  - Crédite le compte destination
 *
 * Annulation (cancelTransfert) :
 *  - Uniquement EN_ATTENTE
 *  - Rembourse immédiatement le compte source
 *  - Admin peut annuler n'importe lequel
 *
 * @module controllers/interac
 */

import bcrypt from "bcryptjs";
import {
  findAutoDeposit,
  findActiveAutoDepositByEmail,
  activerAutoDepositDirectement,
  deactivateAutoDeposit,
  getTotalEnvoyeAujourdhui,
  getTotalEnvoye7Jours,
  getTotalEnvoye30Jours,
  findInteracTransferts,
  findTransfertsEnAttentePourDestinataire,
  findTransfertById,
  createInteracTransfert,
  accepterTransfert,
  annulerTransfert,
  expireTransfertsExpires,
  decrementAccountBalance,
  incrementAccountBalance,
  findAuthorizedAccount,
  createInteracTransaction,
  findTransfertsParClient,
  findAutoDepositParClient,
  getStatsInteracParClient,
  forceActiverAutoDepositParClient,
  findUserIdByClientId,
  desactiverAutoDepositParClient,
  getLimitesInteracParClient,
  setLimitesInteracParClient,
  getLimitesInteracParUtilisateur,
  INTERAC_MIN_PAR_TRANSFERT,
  INTERAC_LIMITE_QUOTIDIENNE,
  INTERAC_LIMITE_7_JOURS,
  INTERAC_LIMITE_30_JOURS,
} from "../data/interac.data.js";
import { createAuditLog } from "../data/audit.data.js";

/* ─────────────────────────────────────────────────────────────
   AUTO-DÉPÔT — Consultation
───────────────────────────────────────────────────────────── */

/**
 * Retourne le profil d'auto-dépôt de l'utilisateur connecté.
 *
 * @async
 * @route GET /api/interac/autodeposit
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data } | 404 | 500
 */
export const getAutoDeposit = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const profile = await findAutoDeposit(userId);
    if (!profile) {
      return res.status(404).json({ message: "Aucun profil d'auto-depot enregistre" });
    }
    return res.json({ data: profile });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   AUTO-DÉPÔT — Étape 1 : demande d'activation
───────────────────────────────────────────────────────────── */

/**
 * Active l'auto-dépôt directement en une seule étape.
 *
 * L'utilisateur fournit son email Interac et le compte de réception.
 * Le profil est immédiatement activé — aucun code de confirmation requis.
 *
 * Règle de sécurité : un email Interac ne peut appartenir qu'à un seul
 * utilisateur actif à la fois. La vérification est faite avant toute écriture.
 *
 * @async
 * @route POST /api/interac/autodeposit
 * @param {import("express").Request}  req - Corps : { email_interac, compte_depot_id }
 * @param {import("express").Response} res - 200 { message, data } | 400 | 403 | 500
 */
export const demanderAutoDeposit = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const { email_interac, compte_depot_id } = req.body;

    const emailNormalise = email_interac.trim().toLowerCase();

    // Vérifier que l'utilisateur possède le compte de réception
    const compte = await findAuthorizedAccount(userId, compte_depot_id);
    if (!compte) {
      return res.status(403).json({ message: "Compte de reception non autorise" });
    }

    // Vérifier que l'email n'est pas déjà actif chez un AUTRE utilisateur
    const autreUtilisateur = await findActiveAutoDepositByEmail(emailNormalise);
    if (autreUtilisateur && autreUtilisateur.utilisateur_id !== userId) {
      return res.status(400).json({
        message: "Cet email Interac est deja utilise par un autre compte",
      });
    }

    await activerAutoDepositDirectement({
      utilisateurId: userId,
      emailInterac: emailNormalise,
      compteDepotId: compte_depot_id,
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "INTERAC_AUTODEPOSIT_ACTIVE",
      details: `Auto-depot active pour ${emailNormalise} sur compte #${compte_depot_id}`,
    });

    const profile = await findAutoDeposit(userId);
    return res.json({ message: "Auto-depot active avec succes", data: profile });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Cet email Interac est deja utilise par un autre compte" });
    }
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   AUTO-DÉPÔT — Désactivation
───────────────────────────────────────────────────────────── */

/**
 * Désactive l'auto-dépôt de l'utilisateur connecté.
 *
 * @async
 * @route DELETE /api/interac/autodeposit
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { message } | 404 | 500
 */
export const desactiverAutoDeposit = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    const profile = await findAutoDeposit(userId);
    if (!profile || profile.statut !== "ACTIVE") {
      return res.status(404).json({ message: "Aucun profil d'auto-depot actif" });
    }

    await deactivateAutoDeposit(userId);

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "INTERAC_AUTODEPOSIT_DESACTIVE",
      details: `Auto-depot desactive pour ${profile.email_interac}`,
    });

    return res.json({ message: "Auto-depot desactive avec succes" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   CONSULTATION DES TRANSFERTS
───────────────────────────────────────────────────────────── */

/**
 * Liste les transferts Interac accessibles à l'utilisateur.
 * Expire automatiquement les transferts EN_ATTENTE dépassés avant la liste.
 *
 * @async
 * @route GET /api/interac
 * @param {import("express").Request}  req - Query : { search? }
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getTransferts = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const search = String(req.query.search || "").trim();
    const isAdmin = userRole === "ADMIN" || userRole === "MODERATEUR";

    // Expire les transferts dépassés + rembourse les comptes source
    await _expireEtRembourser(userId, userRole);

    const rows = await findInteracTransferts({ userId, isAdmin, search });

    if (isAdmin) {
      await createAuditLog({
        utilisateurId: userId,
        roleUtilisateur: userRole,
        action: "VIEW_GLOBAL_INTERAC",
        details: search ? `Recherche: ${search}` : "Consultation globale Interac",
      });
    }

    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Liste les transferts EN_ATTENTE destinés à l'utilisateur connecté.
 *
 * @async
 * @route GET /api/interac/a-reclamer
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 500
 */
export const getTransfertsAReclamer = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const emailUtilisateur = req.session.user.email;

    await _expireEtRembourser(userId, userRole);

    const autoDeposit = await findAutoDeposit(userId);
    const emailInterac = (autoDeposit?.statut === "ACTIVE") ? autoDeposit.email_interac : null;

    const rows = await findTransfertsEnAttentePourDestinataire(emailUtilisateur, emailInterac);
    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   ENVOI D'UN TRANSFERT
───────────────────────────────────────────────────────────── */

/**
 * Envoie un virement Interac par courriel.
 *
 * Règles appliquées (miroir Interac Canada 2024) :
 *  1. Montant minimum : 0,50 $
 *  2. Montant maximum : 3 000 $
 *  3. Limite quotidienne : 3 000 $ (cumul EN_ATTENTE + ACCEPTEE)
 *  4. Limite mensuelle  : 10 000 $ (même cumul)
 *  5. Interdit d'envoyer à sa propre adresse de connexion
 *  6. Mot de passe : 3-25 car., pas l'email dest., pas le montant
 *  7. Débit immédiat du compte source (fonds en transit)
 *  8. Auto-dépôt ACTIF → ACCEPTEE + crédit immédiat
 *  9. Pas d'auto-dépôt → EN_ATTENTE + mot de passe bcrypt requis
 *
 * @async
 * @route POST /api/interac
 * @param {import("express").Request}  req - Corps : { compte_source_id, email_destinataire, montant, description?, mot_de_passe? }
 * @param {import("express").Response} res - 201 { message, id, statut } | 400 | 403 | 500
 */
export const sendTransfert = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const emailExpediteur = req.session.user.email;
    const { compte_source_id, email_destinataire, montant, description, mot_de_passe } = req.body;
    // Validation de format déjà assurée par validateSendInterac

    const montantValue = Number(montant);
    const emailNormalise = email_destinataire.trim().toLowerCase();

    // ── Interdit d'envoyer à sa propre adresse ────────────
    if (emailNormalise === emailExpediteur.toLowerCase()) {
      return res.status(400).json({ message: "Vous ne pouvez pas vous envoyer un virement Interac a vous-meme" });
    }

    // ── Vérification du compte source ─────────────────────
    const sourceAccount = await findAuthorizedAccount(userId, compte_source_id);
    if (!sourceAccount) {
      return res.status(403).json({ message: "Compte source non autorise" });
    }
    if (Number(sourceAccount.solde) < montantValue) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // ── Récupération des limites effectives (perso > global) ─
    const limitePerso = await getLimitesInteracParUtilisateur(userId);
    const limite24h = limitePerso.limite_24h ?? INTERAC_LIMITE_QUOTIDIENNE;
    const limite7j  = limitePerso.limite_7j  ?? INTERAC_LIMITE_7_JOURS;
    const limite30j = limitePerso.limite_30j ?? INTERAC_LIMITE_30_JOURS;

    // ── Limite 24 heures ──────────────────────────────────
    const total24h = await getTotalEnvoyeAujourdhui(userId);
    if (total24h + montantValue > limite24h) {
      const restant = Math.max(0, limite24h - total24h);
      return res.status(400).json({
        message: `Limite de 24 heures Interac atteinte. Vous pouvez encore envoyer ${restant.toFixed(2)} $ aujourd'hui.`,
      });
    }

    // ── Limite 7 jours ────────────────────────────────────
    const total7j = await getTotalEnvoye7Jours(userId);
    if (total7j + montantValue > limite7j) {
      const restant = Math.max(0, limite7j - total7j);
      return res.status(400).json({
        message: `Limite de 7 jours Interac atteinte. Vous pouvez encore envoyer ${restant.toFixed(2)} $ cette semaine.`,
      });
    }

    // ── Limite 30 jours ───────────────────────────────────
    const total30j = await getTotalEnvoye30Jours(userId);
    if (total30j + montantValue > limite30j) {
      const restant = Math.max(0, limite30j - total30j);
      return res.status(400).json({
        message: `Limite de 30 jours Interac atteinte. Vous pouvez encore envoyer ${restant.toFixed(2)} $ sur 30 jours.`,
      });
    }

    // ── Détection auto-dépôt ──────────────────────────────
    const autoDeposit = await findActiveAutoDepositByEmail(emailNormalise);

    let statut;
    let motDePasseHash = null;
    let compteDestinationId = null;

    if (autoDeposit) {
      // Destinataire a l'auto-dépôt actif → transfert immédiat sans mot de passe
      statut = "ACCEPTEE";
      compteDestinationId = autoDeposit.compte_depot_id;
    } else {
      // Pas d'auto-dépôt → mot de passe obligatoire
      if (!mot_de_passe || String(mot_de_passe).trim().length < 3) {
        return res.status(400).json({
          message: "Un mot de passe est requis (3 a 25 caracteres) car le destinataire n'a pas l'auto-depot actif",
        });
      }
      const mdpTrim = String(mot_de_passe).trim();
      if (mdpTrim.length > 25) {
        return res.status(400).json({ message: "Le mot de passe ne peut pas depasser 25 caracteres" });
      }
      // Mot de passe ne doit pas être l'email du destinataire
      if (mdpTrim.toLowerCase() === emailNormalise) {
        return res.status(400).json({ message: "Le mot de passe ne peut pas etre l'email du destinataire" });
      }
      // Mot de passe ne doit pas être le montant
      if (mdpTrim === String(montantValue) || mdpTrim === montantValue.toFixed(2)) {
        return res.status(400).json({ message: "Le mot de passe ne peut pas etre le montant du transfert" });
      }
      motDePasseHash = await bcrypt.hash(mdpTrim, 10);
      statut = "EN_ATTENTE";
    }

    // ── Débit immédiat du compte source ───────────────────
    await decrementAccountBalance(compte_source_id, montantValue);

    // ── Création de l'enregistrement ──────────────────────
    const result = await createInteracTransfert({
      expediteurId: userId,
      compteSourceId: compte_source_id,
      emailDestinataire: emailNormalise,
      montant: montantValue,
      description,
      motDePasseHash,
      compteDestinationId,
      statut,
    });

    const transfertId = result.insertId;
    const descBase = description ? description.trim() : `Interac #${transfertId}`;

    // ── Transaction historique — débit expéditeur ─────────
    await createInteracTransaction({
      compteId: compte_source_id,
      montant: -montantValue,
      description: `${descBase} — Envoi Interac vers ${emailNormalise}`,
    });

    // ── Auto-dépôt : crédit immédiat du destinataire ──────
    if (autoDeposit) {
      await incrementAccountBalance(autoDeposit.compte_depot_id, montantValue);
      await createInteracTransaction({
        compteId: autoDeposit.compte_depot_id,
        montant: montantValue,
        description: `${descBase} — Reception Interac (auto-depot)`,
      });
    }

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "INTERAC_ENVOI",
      details: `Transfert #${transfertId} de ${montantValue} $ vers ${emailNormalise} — statut: ${statut}`,
    });

    return res.status(201).json({
      message: autoDeposit
        ? "Virement Interac envoye et depose automatiquement"
        : "Virement Interac envoye — en attente de reclamation par le destinataire",
      id: transfertId,
      statut,
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   RÉCLAMATION (acceptation par le destinataire)
───────────────────────────────────────────────────────────── */

/**
 * Permet au destinataire de réclamer un virement EN_ATTENTE.
 *
 * Séquence :
 *  1. Vérification que le transfert est EN_ATTENTE et non expiré
 *  2. Vérification que l'email du transfert correspond à l'utilisateur
 *     (email de connexion OU email Interac actif)
 *  3. Vérification du mot de passe bcrypt
 *  4. Crédit du compte destination choisi
 *  5. Mise à jour statut → ACCEPTEE
 *
 * @async
 * @route POST /api/interac/:id/reclamer
 * @param {import("express").Request}  req - Params : { id }; Corps : { compte_destination_id, mot_de_passe }
 * @param {import("express").Response} res - 200 { message } | 400 | 403 | 404 | 500
 */
export const reclamerTransfert = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const emailUtilisateur = req.session.user.email;
    const transfertId = Number(req.params.id);
    const { compte_destination_id, mot_de_passe } = req.body;
    // Validation de format assurée par validateReclamerInterac

    const transfert = await findTransfertById(transfertId);
    if (!transfert) {
      return res.status(404).json({ message: "Virement Interac introuvable" });
    }
    if (transfert.statut !== "EN_ATTENTE") {
      return res.status(400).json({ message: "Ce virement n'est plus en attente" });
    }
    if (new Date(transfert.date_expiration) <= new Date()) {
      return res.status(400).json({ message: "Ce virement a expire" });
    }

    // Vérification que l'utilisateur est bien le destinataire
    const autoDeposit = await findAutoDeposit(userId);
    const emailInteracActif = (autoDeposit?.statut === "ACTIVE") ? autoDeposit.email_interac : null;
    const emailsAutorises = [emailUtilisateur.toLowerCase()];
    if (emailInteracActif) emailsAutorises.push(emailInteracActif.toLowerCase());

    if (!emailsAutorises.includes(transfert.email_destinataire.toLowerCase())) {
      return res.status(403).json({ message: "Ce virement ne vous est pas destine" });
    }

    // Vérification du mot de passe
    if (!transfert.mot_de_passe_hash) {
      return res.status(400).json({ message: "Ce virement ne necessite pas de mot de passe" });
    }
    const motDePasseValide = await bcrypt.compare(String(mot_de_passe), transfert.mot_de_passe_hash);
    if (!motDePasseValide) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    // Vérification du compte destination
    const compteDestination = await findAuthorizedAccount(userId, compte_destination_id);
    if (!compteDestination) {
      return res.status(403).json({ message: "Compte de reception non autorise" });
    }

    // Crédit + mise à jour statut
    await incrementAccountBalance(compte_destination_id, Number(transfert.montant));
    await accepterTransfert(transfertId, compte_destination_id);

    const descBase = transfert.description || `Interac #${transfertId}`;
    await createInteracTransaction({
      compteId: compte_destination_id,
      montant: Number(transfert.montant),
      description: `${descBase} — Reception Interac`,
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "INTERAC_RECLAMATION",
      details: `Transfert #${transfertId} de ${transfert.montant} $ reclame sur compte #${compte_destination_id}`,
    });

    return res.json({ message: "Virement Interac reclame avec succes" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   ANNULATION
───────────────────────────────────────────────────────────── */

/**
 * Annule un virement EN_ATTENTE et rembourse le compte source.
 * L'expéditeur peut annuler ses propres transferts. L'admin peut tout annuler.
 *
 * @async
 * @route DELETE /api/interac/:id
 * @param {import("express").Request}  req - Params : { id }
 * @param {import("express").Response} res - 200 { message } | 400 | 403 | 404 | 500
 */
export const cancelTransfert = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    const isAdmin = userRole === "ADMIN";
    const transfertId = Number(req.params.id);

    const transfert = await findTransfertById(transfertId);
    if (!transfert) {
      return res.status(404).json({ message: "Virement Interac introuvable" });
    }
    if (transfert.statut !== "EN_ATTENTE") {
      return res.status(400).json({ message: "Seuls les virements en attente peuvent etre annules" });
    }
    if (!isAdmin && transfert.expediteur_id !== userId) {
      return res.status(403).json({ message: "Vous n'etes pas autorise a annuler ce virement" });
    }

    // Remboursement immédiat du compte source
    await incrementAccountBalance(transfert.compte_source_id, Number(transfert.montant));
    await annulerTransfert(transfertId);

    await createInteracTransaction({
      compteId: transfert.compte_source_id,
      montant: Number(transfert.montant),
      description: `Interac #${transfertId} — Remboursement (annulation)`,
    });

    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "INTERAC_ANNULATION",
      details: `Transfert #${transfertId} annule — remboursement de ${transfert.montant} $ sur compte #${transfert.compte_source_id}`,
    });

    return res.json({ message: "Virement Interac annule et remboursement effectue" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
   UTILITAIRE INTERNE — Expiration + remboursement
───────────────────────────────────────────────────────────── */

/**
 * Expire les transferts EN_ATTENTE dépassés et rembourse les comptes source.
 * Appelé automatiquement avant chaque lecture de liste.
 *
 * @async
 * @private
 */
async function _expireEtRembourser(userId, userRole) {
  const expires = await expireTransfertsExpires();
  for (const t of expires) {
    await incrementAccountBalance(t.compte_source_id, Number(t.montant));
    await createInteracTransaction({
      compteId: t.compte_source_id,
      montant: Number(t.montant),
      description: `Interac #${t.id} — Remboursement (expiration 30 jours)`,
    });
    await createAuditLog({
      utilisateurId: userId,
      roleUtilisateur: userRole,
      action: "INTERAC_EXPIRATION",
      details: `Transfert #${t.id} expire — remboursement de ${t.montant} $ sur compte #${t.compte_source_id}`,
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   ADMINISTRATION — Interac par client
───────────────────────────────────────────────────────────── */

export const adminGetTransfertsClient = async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const rows = await findTransfertsParClient(clientId);
    return res.json({ data: rows });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export const adminGetStatsClient = async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const stats = await getStatsInteracParClient(clientId);
    return res.json({ data: stats });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export const adminGetAutoDepositClient = async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const profile = await findAutoDepositParClient(clientId);
    return res.json({ data: profile });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export const adminForceActiverAutoDeposit = async (req, res) => {
  try {
    const adminId   = req.session.user.id;
    const adminRole = req.session.user.role;
    const clientId  = Number(req.params.clientId);
    const { email_interac, compte_depot_id } = req.body;

    if (!email_interac || !compte_depot_id) {
      return res.status(400).json({ message: "Champs requis : email_interac, compte_depot_id" });
    }

    // 1) Lecture seule : récupérer l'utilisateur cible AVANT toute mutation
    const targetUserId = await findUserIdByClientId(clientId);
    if (!targetUserId) {
      return res.status(404).json({ message: "Aucun utilisateur trouvé pour ce client" });
    }

    // 2) Vérifier que l'email n'est pas déjà actif chez un AUTRE utilisateur
    //    (sans cette vérification AVANT l'écriture, on activait avant de valider)
    const autreAD = await findActiveAutoDepositByEmail(email_interac.trim().toLowerCase());
    if (autreAD && autreAD.utilisateur_id !== targetUserId) {
      return res.status(400).json({ message: "Cet email Interac est déjà actif chez un autre utilisateur" });
    }

    // 3) Maintenant seulement, on persiste la modification
    const userId = await forceActiverAutoDepositParClient(clientId, email_interac, Number(compte_depot_id));
    if (!userId) {
      return res.status(404).json({ message: "Aucun utilisateur trouvé pour ce client" });
    }

    await createAuditLog({
      utilisateurId: adminId,
      roleUtilisateur: adminRole,
      action: "ADMIN_INTERAC_AUTODEPOSIT_FORCE",
      details: `Auto-dépôt forcé pour client #${clientId} — email: ${email_interac} — compte: #${compte_depot_id}`,
    });

    const profile = await findAutoDepositParClient(clientId);
    return res.json({ message: "Auto-dépôt activé avec succès (admin)", data: profile });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export const adminDesactiverAutoDeposit = async (req, res) => {
  try {
    const adminId   = req.session.user.id;
    const adminRole = req.session.user.role;
    const clientId  = Number(req.params.clientId);

    await desactiverAutoDepositParClient(clientId);

    await createAuditLog({
      utilisateurId: adminId,
      roleUtilisateur: adminRole,
      action: "ADMIN_INTERAC_AUTODEPOSIT_DESACTIVE",
      details: `Auto-dépôt désactivé pour client #${clientId}`,
    });

    return res.json({ message: "Auto-dépôt désactivé" });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Récupère les limites Interac personnalisées d'un client.
 * Les champs null signifient que la valeur globale est en vigueur.
 *
 * @async
 * @route GET /api/admin/interac/client/:clientId/limites
 */
export const adminGetLimitesClient = async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const limites  = await getLimitesInteracParClient(clientId);
    if (!limites) {
      return res.status(404).json({ message: "Client introuvable" });
    }
    return res.json({ data: limites });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Met à jour les limites Interac personnalisées d'un client.
 * Envoyer null pour un champ supprime la personnalisation (retour aux valeurs globales).
 *
 * @async
 * @route PATCH /api/admin/interac/client/:clientId/limites
 */
export const adminSetLimitesClient = async (req, res) => {
  try {
    const adminId   = req.session.user.id;
    const adminRole = req.session.user.role;
    const clientId  = Number(req.params.clientId);
    const { limite_24h, limite_7j, limite_30j } = req.body;

    const updated = await setLimitesInteracParClient(clientId, {
      limite_24h: limite_24h !== undefined ? (limite_24h === null ? null : Number(limite_24h)) : undefined,
      limite_7j:  limite_7j  !== undefined ? (limite_7j  === null ? null : Number(limite_7j))  : undefined,
      limite_30j: limite_30j !== undefined ? (limite_30j === null ? null : Number(limite_30j)) : undefined,
    });
    if (!updated) {
      return res.status(404).json({ message: "Client introuvable" });
    }

    await createAuditLog({
      utilisateurId: adminId,
      roleUtilisateur: adminRole,
      action: "ADMIN_INTERAC_LIMITES_MODIFIEES",
      details: `Limites Interac du client #${clientId} modifiées : 24h=${limite_24h ?? "global"}, 7j=${limite_7j ?? "global"}, 30j=${limite_30j ?? "global"}`,
    });

    const limites = await getLimitesInteracParClient(clientId);
    return res.json({ message: "Limites mises à jour", data: limites });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

/**
 * Retourne les limites effectives de l'utilisateur connecté
 * (personnalisées si définies par un admin, globales sinon).
 *
 * @async
 * @route GET /api/interac/limites
 */
export const getLimitesInterac = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const perso  = await getLimitesInteracParUtilisateur(userId);

    // Montants déjà envoyés sur les fenêtres 24h / 7j / 30j (statuts
    // EN_ATTENTE et ACCEPTEE seulement — les annulés ne comptent pas).
    const [use24, use7, use30] = await Promise.all([
      getTotalEnvoyeAujourdhui(userId),
      getTotalEnvoye7Jours(userId),
      getTotalEnvoye30Jours(userId),
    ]);

    const lim24 = perso.limite_24h ?? INTERAC_LIMITE_QUOTIDIENNE;
    const lim7  = perso.limite_7j  ?? INTERAC_LIMITE_7_JOURS;
    const lim30 = perso.limite_30j ?? INTERAC_LIMITE_30_JOURS;

    return res.json({
      data: {
        limite_24h: lim24,
        limite_7j:  lim7,
        limite_30j: lim30,
        perso_24h:  perso.limite_24h !== null,
        perso_7j:   perso.limite_7j  !== null,
        perso_30j:  perso.limite_30j !== null,
        // Utilisation courante et solde restant (permet à l'UI d'afficher
        // "restant / max" et de décrémenter en direct après un envoi).
        utilise_24h:  use24,
        utilise_7j:   use7,
        utilise_30j:  use30,
        restant_24h:  Math.max(0, lim24 - use24),
        restant_7j:   Math.max(0, lim7  - use7),
        restant_30j:  Math.max(0, lim30 - use30),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

export default {
  getAutoDeposit,
  demanderAutoDeposit,
  desactiverAutoDeposit,
  getLimitesInterac,
  getTransferts,
  getTransfertsAReclamer,
  sendTransfert,
  reclamerTransfert,
  cancelTransfert,
  adminGetTransfertsClient,
  adminGetStatsClient,
  adminGetAutoDepositClient,
  adminForceActiverAutoDeposit,
  adminDesactiverAutoDeposit,
  adminGetLimitesClient,
  adminSetLimitesClient,
};
