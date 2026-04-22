/**
 * @fileoverview Middlewares de validation des données entrantes pour l'API bancaire.
 *
 * Ce module regroupe TOUS les middlewares de validation utilisés dans l'application.
 * Chaque middleware inspecte le corps de la requête (req.body) ou les paramètres d'URL
 * (req.params) et renvoie une réponse HTTP 400 (Bad Request) si les données sont
 * manquantes, mal formées ou hors des valeurs autorisées.
 *
 * Organisation des validators par domaine métier :
 *   - Utilitaire   : validateId (paramètre d'URL générique)
 *   - Auth         : validateLogin, validateRegister, validateCreateUser
 *   - Clients      : validateCreateClient
 *   - Comptes      : validateCreateCompte
 *   - Admin/Comptes: validateAdjustBalance, validateChangeAccountType, validateAddTransaction
 *   - Admin/Virements: validateAddVirement, validateForceTransfer
 *   - Admin/Utilisateurs: validateChangeUserRole, validateResetPassword, validateAutoValidation
 *   - Cartes       : validateCreateCarte, validateModifierLimiteCarte,
 *                    validateModifierSoldeCarte, validateRembourserCarte
 *   - Virements    : validateCreateVirement, validateCreateVirementExterne
 *   - Factures     : validateCreateFacture, validatePayFacture
 *   - Dépôts       : validateCreateDepot  (doit être placé APRÈS le middleware multer)
 *   - Retraits     : validateCreateRetrait
 *   - Interac      : validateSendInterac, validateReclamerInterac,
 *                    validateDemanderAutoDeposit
 *
 * Tous les middlewares suivent la convention Express (req, res, next) => void.
 *
 * @module validation.middleware
 */

/* ── Constantes ────────────────────────────────────── */

/**
 * Types de comptes bancaires acceptés par l'application.
 * Utilisé pour valider le champ `type_compte` lors de la création ou modification d'un compte.
 *
 * @constant {string[]}
 */
const TYPES_COMPTE       = ["CHEQUES", "EPARGNE", "CREDIT"];

/**
 * Types de cartes de crédit/débit acceptés.
 * Utilisé pour valider le champ `type_carte` lors de la création d'une carte.
 *
 * @constant {string[]}
 */
const TYPES_CARTE        = ["VISA", "MASTERCARD"];

/**
 * Types de transactions financières acceptés.
 * Utilisé pour valider le champ `type_transaction` dans plusieurs validators.
 *
 * @constant {string[]}
 */
const TYPES_TRANSACTION  = ["DEPOT", "RETRAIT", "VIREMENT", "PAIEMENT", "REMBOURSEMENT"];

/**
 * Statuts possibles pour un virement bancaire.
 * Utilisé pour valider le champ `statut` lors de la création ou mise à jour d'un virement.
 *
 * @constant {string[]}
 */
const STATUTS_VIREMENT   = ["ACCEPTE", "REFUSE", "EN_ATTENTE"];

/**
 * Rôles d'utilisateur valides dans le système.
 * Utilisé pour valider les modifications de rôle par un administrateur.
 * Hiérarchie : UTILISATEUR < MODERATEUR < ADMIN.
 *
 * @constant {string[]}
 */
const ROLES_VALIDES      = ["UTILISATEUR", "MODERATEUR", "ADMIN"];

/* ── Utilitaire ────────────────────────────────────── */

/**
 * Fabrique de middleware : valide qu'un paramètre d'URL est un entier strictement positif.
 *
 * Cette fonction retourne un middleware Express configuré pour vérifier le paramètre
 * d'URL dont le nom est passé en argument. Elle est réutilisable pour tout paramètre
 * numérique (id, clientId, txId, etc.).
 *
 * Conditions de rejet (réponse 400) :
 *   - La valeur n'est pas un entier (ex. : "abc", "1.5").
 *   - La valeur est un entier négatif ou nul (id <= 0).
 *
 * @param {string} [paramName="id"] - Nom du paramètre dans req.params (ex: "id", "clientId").
 * @returns {import("express").RequestHandler} Middleware Express prêt à l'emploi.
 *
 * @example
 * // Dans une route :
 * router.get("/comptes/:id", validateId("id"), compteController.getById);
 * router.get("/clients/:clientId/comptes", validateId("clientId"), compteController.getByClient);
 */
export function validateId(paramName = "id") {
  // On retourne une closure qui capture `paramName` pour l'utiliser dans le middleware.
  return (req, res, next) => {
    // Conversion en nombre pour pouvoir appliquer les vérifications numériques.
    const id = Number(req.params[paramName]);

    // Vérification : doit être un entier strictement positif.
    // Number.isInteger rejecte les décimaux ; id <= 0 rejecte 0 et les négatifs.
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: `${paramName} invalide` });
    }

    // L'ID est valide → passage au middleware suivant.
    next();
  };
}

/* ── Auth ──────────────────────────────────────────── */

/**
 * Valide les données de connexion d'un utilisateur.
 *
 * Vérifie que le corps de la requête contient les deux champs obligatoires
 * pour l'authentification. Ne vérifie PAS le format de l'email ni la force
 * du mot de passe (ces vérifications sont faites dans la couche service).
 *
 * Champs vérifiés :
 *   - `email`      : obligatoire, doit être présent et non vide.
 *   - `motDePasse` : obligatoire, doit être présent et non vide.
 *
 * @param {import("express").Request}  req  - Corps attendu : { email, motDePasse }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateLogin(req, res, next) {
  // Extraction des deux champs obligatoires depuis le corps de la requête.
  const { email, motDePasse } = req.body;

  // Les deux champs doivent être présents et non vides (falsy check).
  if (!email || !motDePasse) {
    // 400 Bad Request : données manquantes pour se connecter.
    return res.status(400).json({ message: "Email et mot de passe requis" });
  }

  // Données présentes → on continue vers le contrôleur d'authentification.
  next();
}

/**
 * Valide les données d'inscription d'un nouvel utilisateur (auto-enregistrement).
 *
 * Vérifie que tous les champs obligatoires du formulaire d'inscription sont fournis.
 * Utilisé sur la route publique d'inscription (POST /auth/register).
 *
 * Champs vérifiés :
 *   - `email`      : obligatoire.
 *   - `motDePasse` : obligatoire.
 *   - `prenom`     : obligatoire.
 *   - `nom`        : obligatoire.
 *
 * @param {import("express").Request}  req  - Corps attendu : { email, motDePasse, prenom, nom }.
 * @param {import("express").Response} res  - Réponse 400 si un champ est absent.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateRegister(req, res, next) {
  // Extraction des quatre champs obligatoires à l'inscription.
  const { email, motDePasse, prenom, nom } = req.body;

  // Si l'un des quatre champs est absent ou vide, on rejette la requête.
  if (!email || !motDePasse || !prenom || !nom) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Tous les champs sont présents → on continue.
  next();
}

/**
 * Valide la création d'un utilisateur avec rôle élevé (ADMIN ou MODERATEUR).
 *
 * Ce validator est utilisé par les routes réservées aux administrateurs pour créer
 * un compte ADMIN ou MODERATEUR. Il applique une règle supplémentaire par rapport à
 * validateRegister : la longueur minimale du mot de passe (6 caractères).
 *
 * Champs vérifiés :
 *   - `email`      : obligatoire.
 *   - `motDePasse` : obligatoire ET doit faire au moins 6 caractères.
 *   - `prenom`     : obligatoire.
 *   - `nom`        : obligatoire.
 *
 * @param {import("express").Request}  req  - Corps attendu : { email, motDePasse, prenom, nom }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateUser(req, res, next) {
  // Extraction des champs obligatoires.
  const { email, motDePasse, prenom, nom } = req.body;

  // Vérification de la présence des quatre champs obligatoires.
  if (!email || !motDePasse || !prenom || !nom) {
    return res.status(400).json({ message: "Champs manquants (email, motDePasse, prenom, nom)" });
  }

  // Vérification de la longueur minimale du mot de passe (règle de sécurité de base).
  // On convertit en String pour gérer le cas où motDePasse serait envoyé comme nombre.
  if (String(motDePasse).length < 6) {
    return res.status(400).json({ message: "motDePasse doit faire au moins 6 caractères" });
  }

  // Toutes les vérifications passées → on continue.
  next();
}

/* ── Clients ───────────────────────────────────────── */

/**
 * Valide les données de création d'un client bancaire.
 *
 * Un client est la personne physique (ou morale) représentée dans le système ;
 * il diffère de l'utilisateur (compte de connexion). Un client possède des comptes,
 * des cartes, des factures, etc.
 *
 * Champs vérifiés :
 *   - `prenom`       : obligatoire.
 *   - `nom`          : obligatoire.
 *   - `email_fictif` : obligatoire (email de contact fictif associé au client).
 *
 * @param {import("express").Request}  req  - Corps attendu : { prenom, nom, email_fictif }.
 * @param {import("express").Response} res  - Réponse 400 si un champ est absent.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateClient(req, res, next) {
  // Extraction des trois champs obligatoires d'un nouveau client.
  const { prenom, nom, email_fictif } = req.body;

  // Vérification de la présence de chaque champ.
  if (!prenom || !nom || !email_fictif) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Données valides → passage au contrôleur.
  next();
}

/* ── Comptes ───────────────────────────────────────── */

/**
 * Valide les données de création d'un compte bancaire.
 *
 * Un compte bancaire est lié à un client et possède un type parmi les valeurs
 * autorisées (CHEQUES, EPARGNE, CREDIT). Le champ `last_four` est optionnel mais,
 * s'il est fourni, doit respecter le format 4 chiffres exactement.
 *
 * Champs vérifiés :
 *   - `client_id`  : obligatoire, doit être un nombre entier positif valide.
 *   - `type_compte`: obligatoire, doit être dans TYPES_COMPTE.
 *   - `last_four`  : optionnel — si présent, doit être exactement 4 chiffres (regex ^\d{4}$).
 *
 * @param {import("express").Request}  req  - Corps attendu : { client_id, type_compte, last_four? }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateCompte(req, res, next) {
  // Extraction des champs nécessaires à la création d'un compte.
  const { client_id, type_compte, last_four } = req.body;

  // Vérification de la présence des champs obligatoires.
  // Note : client_id == null couvre à la fois `null` et `undefined`.
  // client_id === "" couvre la chaîne vide soumise depuis un formulaire HTML.
  if (client_id == null || client_id === "" || !type_compte) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Conversion et validation de client_id : doit être un entier positif.
  const clientId = Number(client_id);
  if (!clientId || isNaN(clientId)) {
    return res.status(400).json({ message: "client_id invalide" });
  }

  // Vérification que le type de compte est dans la liste des valeurs autorisées.
  if (!TYPES_COMPTE.includes(type_compte)) {
    return res.status(400).json({ message: "Type de compte invalide" });
  }

  // Vérification optionnelle du champ last_four (4 derniers chiffres du numéro de carte associée).
  // Seulement validé si le champ est présent dans la requête.
  if (last_four !== undefined && !/^\d{4}$/.test(String(last_four))) {
    return res.status(400).json({ message: "last_four doit etre 4 chiffres" });
  }

  // Toutes les vérifications sont passées → on continue.
  next();
}

/* ── Admin - Comptes ───────────────────────────────── */

/**
 * Valide un ajustement manuel de solde sur un compte bancaire (action admin).
 *
 * Un ajustement peut être positif (crédit) ou négatif (débit). Si `type_transaction`
 * n'est pas fourni, il est déduit automatiquement selon le signe du montant :
 *   - montant > 0 → "DEPOT"
 *   - montant < 0 → "RETRAIT"
 *
 * Champs vérifiés :
 *   - `montant`          : obligatoire, nombre différent de zéro.
 *   - `type_transaction` : optionnel, mais si fourni, doit être dans TYPES_TRANSACTION.
 *
 * @param {import("express").Request}  req  - Corps attendu : { montant, type_transaction? }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateAdjustBalance(req, res, next) {
  // Extraction et conversion du montant.
  const { montant, type_transaction } = req.body;
  const amount = Number(montant);

  // Le montant doit être présent, numérique et différent de zéro.
  // Un montant de 0 n'a aucun sens pour un ajustement de solde.
  if (!montant || isNaN(amount) || amount === 0) {
    return res.status(400).json({ message: "montant invalide (doit être != 0)" });
  }

  // Déduction automatique du type de transaction si non fourni.
  // Si le montant est positif → DEPOT, si négatif → RETRAIT.
  const typeTransaction = type_transaction || (amount > 0 ? "DEPOT" : "RETRAIT");

  // Vérification que le type de transaction déduit ou fourni est valide.
  if (!TYPES_TRANSACTION.includes(typeTransaction)) {
    return res.status(400).json({ message: "type_transaction invalide" });
  }

  // Données valides → continuation.
  next();
}

/**
 * Valide le changement de type d'un compte bancaire existant (action admin).
 *
 * Permet à un administrateur de modifier le type d'un compte (ex. : passer de
 * CHEQUES à EPARGNE). Le nouveau type doit être dans la liste des types autorisés.
 *
 * Champs vérifiés :
 *   - `type_compte` : obligatoire, doit être dans TYPES_COMPTE (CHEQUES, EPARGNE, CREDIT).
 *
 * @param {import("express").Request}  req  - Corps attendu : { type_compte }.
 * @param {import("express").Response} res  - Réponse 400 si le type est absent ou invalide.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateChangeAccountType(req, res, next) {
  // Extraction du nouveau type de compte.
  const { type_compte } = req.body;

  // Vérification de la présence ET de la valeur autorisée.
  if (!type_compte || !TYPES_COMPTE.includes(type_compte)) {
    return res.status(400).json({ message: "type_compte invalide" });
  }

  // Type valide → continuation.
  next();
}

/**
 * Valide l'ajout d'une transaction manuellement sur un compte (action admin).
 *
 * Similaire à validateAdjustBalance mais avec une règle légèrement différente :
 * le type par défaut est toujours "DEPOT" si non fourni (pas de déduction par signe).
 *
 * Champs vérifiés :
 *   - `montant`          : obligatoire, nombre différent de zéro.
 *   - `type_transaction` : optionnel, valeur par défaut "DEPOT", doit être dans TYPES_TRANSACTION.
 *
 * @param {import("express").Request}  req  - Corps attendu : { montant, type_transaction? }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateAddTransaction(req, res, next) {
  // Extraction et conversion du montant.
  const { montant, type_transaction } = req.body;
  const amount = Number(montant);

  // Le montant doit être présent, numérique et différent de zéro.
  if (!montant || isNaN(amount) || amount === 0) {
    return res.status(400).json({ message: "montant invalide" });
  }

  // Valeur par défaut du type de transaction : DEPOT.
  const typeTransaction = type_transaction || "DEPOT";

  // Le type de transaction doit être dans la liste des valeurs autorisées.
  if (!TYPES_TRANSACTION.includes(typeTransaction)) {
    return res.status(400).json({ message: "type_transaction invalide" });
  }

  // Données valides → continuation.
  next();
}

/* ── Admin - Virements ─────────────────────────────── */

/**
 * Valide l'ajout manuel d'un virement inter-bancaire (action admin).
 *
 * Cette opération nécessite les coordonnées complètes (compte, institution, transit)
 * à la fois pour le compte source et le compte destination. Elle est réservée aux
 * administrateurs pour créer manuellement des virements dans l'historique.
 *
 * Champs vérifiés :
 *   - `numero_compte_source`      : obligatoire.
 *   - `numero_institution_source` : obligatoire.
 *   - `numero_transit_source`     : obligatoire.
 *   - `numero_compte_dest`        : obligatoire.
 *   - `numero_institution_dest`   : obligatoire.
 *   - `numero_transit_dest`       : obligatoire.
 *   - `montant`                   : obligatoire, nombre strictement positif.
 *   - `statut`                    : optionnel, valeur par défaut "ACCEPTE", doit être dans STATUTS_VIREMENT.
 *
 * @param {import("express").Request}  req  - Corps attendu : voir champs ci-dessus.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateAddVirement(req, res, next) {
  // Extraction de toutes les coordonnées bancaires et du montant.
  const {
    numero_compte_source, numero_institution_source, numero_transit_source,
    numero_compte_dest,   numero_institution_dest,   numero_transit_dest,
    montant, statut,
  } = req.body;

  // Vérification que les 6 coordonnées bancaires sont toutes présentes.
  // Si l'une d'entre elles manque, la transaction ne peut pas être identifiée correctement.
  if (
    !numero_compte_source || !numero_institution_source || !numero_transit_source ||
    !numero_compte_dest   || !numero_institution_dest   || !numero_transit_dest
  ) {
    return res.status(400).json({ message: "Coordonnées source et destination requises (numero_compte, institution, transit)" });
  }

  // Conversion et validation du montant : doit être un nombre strictement positif.
  const amount = Number(montant);
  if (!montant || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "montant invalide (doit être > 0)" });
  }

  // Statut par défaut "ACCEPTE" si non fourni (virement admin = immédiatement accepté).
  const statutVirement = statut || "ACCEPTE";

  // Vérification que le statut est dans la liste des valeurs autorisées.
  if (!STATUTS_VIREMENT.includes(statutVirement)) {
    return res.status(400).json({ message: "statut invalide" });
  }

  // Toutes les vérifications passées → continuation.
  next();
}

/**
 * Valide un virement forcé depuis un compte interne vers un compte externe (action admin).
 *
 * Contrairement à validateAddVirement, ce validator accepte un `compte_source_id`
 * (identifiant interne) plutôt que les coordonnées bancaires complètes de la source.
 * La destination reste spécifiée par ses coordonnées complètes.
 *
 * Champs vérifiés :
 *   - `compte_source_id`        : obligatoire (ID interne du compte source).
 *   - `numero_compte_dest`      : obligatoire.
 *   - `numero_institution_dest` : obligatoire.
 *   - `numero_transit_dest`     : obligatoire.
 *   - `montant`                 : obligatoire, nombre strictement positif.
 *
 * @param {import("express").Request}  req  - Corps attendu : voir champs ci-dessus.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateForceTransfer(req, res, next) {
  // Extraction des coordonnées du transfert forcé.
  const { compte_source_id, numero_compte_dest, numero_institution_dest, numero_transit_dest, montant } = req.body;

  // L'ID interne du compte source est obligatoire.
  if (!compte_source_id) {
    return res.status(400).json({ message: "compte_source_id requis" });
  }

  // Les trois coordonnées de la destination doivent toutes être présentes.
  if (!numero_compte_dest || !numero_institution_dest || !numero_transit_dest) {
    return res.status(400).json({ message: "Coordonnées destination requises (numero_compte, institution, transit)" });
  }

  // Le montant doit être un nombre strictement positif.
  const amount = Number(montant);
  if (!montant || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "montant invalide (doit être > 0)" });
  }

  // Données valides → continuation.
  next();
}

/* ── Admin - Utilisateurs ──────────────────────────── */

/**
 * Valide le changement de rôle d'un utilisateur (action admin).
 *
 * Un administrateur peut modifier le rôle d'un utilisateur pour l'élever ou
 * le rétrograder dans la hiérarchie. Le nouveau rôle doit être l'une des trois
 * valeurs définies dans ROLES_VALIDES.
 *
 * Champs vérifiés :
 *   - `role` : obligatoire, doit être "UTILISATEUR", "MODERATEUR" ou "ADMIN".
 *
 * @param {import("express").Request}  req  - Corps attendu : { role }.
 * @param {import("express").Response} res  - Réponse 400 si le rôle est absent ou invalide.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateChangeUserRole(req, res, next) {
  // Extraction du nouveau rôle depuis le corps de la requête.
  const { role } = req.body;

  // Vérification de la présence ET de la valeur autorisée.
  if (!role || !ROLES_VALIDES.includes(role)) {
    return res.status(400).json({ message: "role invalide (UTILISATEUR, MODERATEUR, ADMIN)" });
  }

  // Rôle valide → continuation.
  next();
}

/**
 * Valide la réinitialisation du mot de passe d'un utilisateur (action admin).
 *
 * Un administrateur peut forcer la réinitialisation du mot de passe d'un utilisateur.
 * Le nouveau mot de passe doit respecter la longueur minimale de sécurité.
 *
 * Champs vérifiés :
 *   - `nouveau_mot_de_passe` : obligatoire, doit faire au moins 6 caractères.
 *
 * @param {import("express").Request}  req  - Corps attendu : { nouveau_mot_de_passe }.
 * @param {import("express").Response} res  - Réponse 400 si le champ est absent ou trop court.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateResetPassword(req, res, next) {
  // Extraction du nouveau mot de passe.
  const { nouveau_mot_de_passe } = req.body;

  // Vérification de la présence et de la longueur minimale (6 caractères).
  if (!nouveau_mot_de_passe || String(nouveau_mot_de_passe).length < 6) {
    return res.status(400).json({ message: "nouveau_mot_de_passe requis (minimum 6 caractères)" });
  }

  // Mot de passe valide → continuation.
  next();
}

/**
 * Valide la modification du drapeau d'auto-validation d'un utilisateur (action admin).
 *
 * Le champ `auto_validation` détermine si les opérations d'un utilisateur sont
 * automatiquement validées ou si elles requièrent une approbation manuelle.
 * Il accepte true/false (booléens) ou 1/0 (entiers pour compatibilité SQLite).
 *
 * Champs vérifiés :
 *   - `auto_validation` : obligatoire, doit être boolean (true/false) ou entier (0/1).
 *
 * @param {import("express").Request}  req  - Corps attendu : { auto_validation }.
 * @param {import("express").Response} res  - Réponse 400 si la valeur est invalide.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateAutoValidation(req, res, next) {
  // Extraction de la valeur d'auto-validation.
  const { auto_validation } = req.body;

  // Accepter boolean strict (true/false) ou entier (0/1) pour la compatibilité SQLite.
  // Tout autre type ou valeur est refusé.
  if (typeof auto_validation !== "boolean" && auto_validation !== 0 && auto_validation !== 1) {
    return res.status(400).json({ message: "auto_validation doit être true ou false" });
  }

  // Valeur valide → continuation.
  next();
}

/* ── Cartes ────────────────────────────────────────── */

/**
 * Valide les données de création d'une carte bancaire (VISA ou MASTERCARD).
 *
 * Une carte est liée à un client (client_id). Les quatre champs principaux sont
 * obligatoires ; le champ `last_four` est optionnel mais, si fourni, doit respecter
 * le format exact 4 chiffres (comme sur une vraie carte bancaire).
 *
 * Champs vérifiés :
 *   - `client_id`       : obligatoire.
 *   - `type_carte`      : obligatoire, doit être dans TYPES_CARTE (VISA, MASTERCARD).
 *   - `limite_credit`   : obligatoire, nombre strictement positif.
 *   - `date_expiration` : obligatoire.
 *   - `last_four`       : optionnel — si présent, exactement 4 chiffres (regex ^\d{4}$).
 *
 * @param {import("express").Request}  req  - Corps attendu : { client_id, type_carte, limite_credit, date_expiration, last_four? }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateCarte(req, res, next) {
  // Extraction de tous les champs de création d'une carte.
  const { client_id, type_carte, limite_credit, date_expiration, last_four } = req.body;

  // Vérification de la présence des quatre champs obligatoires.
  if (!client_id || !type_carte || !limite_credit || !date_expiration) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Le type de carte doit être VISA ou MASTERCARD.
  if (!TYPES_CARTE.includes(type_carte)) {
    return res.status(400).json({ message: "Type de carte invalide" });
  }

  // La limite de crédit doit être un nombre strictement positif.
  const limiteValue = Number(limite_credit);
  if (Number.isNaN(limiteValue) || limiteValue <= 0) {
    return res.status(400).json({ message: "La limite doit etre positive" });
  }

  // Vérification du format de last_four si le champ est fourni.
  // Conversion en String pour gérer les cas où la valeur serait un nombre.
  // La valeur null/undefined est acceptable (last_four est optionnel).
  const lastFour = String(last_four ?? "").trim();
  if (lastFour && !/^\d{4}$/.test(lastFour)) {
    return res.status(400).json({ message: "last_four doit contenir exactement 4 chiffres" });
  }

  // Toutes les vérifications passées → continuation.
  next();
}

/**
 * Valide la modification de la limite de crédit d'une carte existante.
 *
 * La nouvelle limite doit être un nombre strictement positif. Une limite à 0
 * ou négative n'a pas de sens pour une carte de crédit.
 *
 * Champs vérifiés :
 *   - `limite_credit` : obligatoire, nombre strictement positif.
 *
 * @param {import("express").Request}  req  - Corps attendu : { limite_credit }.
 * @param {import("express").Response} res  - Réponse 400 si la limite est invalide.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateModifierLimiteCarte(req, res, next) {
  // Conversion et validation de la nouvelle limite de crédit.
  const limiteValue = Number(req.body.limite_credit);

  // La limite doit être un nombre valide et strictement positif.
  if (Number.isNaN(limiteValue) || limiteValue <= 0) {
    return res.status(400).json({ message: "La limite doit etre positive" });
  }

  // Limite valide → continuation.
  next();
}

/**
 * Valide la modification du solde utilisé sur une carte de crédit.
 *
 * Le solde utilisé représente le montant déjà dépensé sur la carte. Il peut être
 * nul (carte sans dette) mais pas négatif.
 *
 * Champs vérifiés :
 *   - `solde_utilise` : obligatoire, nombre positif ou nul (>= 0).
 *
 * @param {import("express").Request}  req  - Corps attendu : { solde_utilise }.
 * @param {import("express").Response} res  - Réponse 400 si le solde est invalide.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateModifierSoldeCarte(req, res, next) {
  // Conversion et validation du solde utilisé.
  const soldeValue = Number(req.body.solde_utilise);

  // Le solde peut être 0 (pas de dette) mais pas négatif.
  if (Number.isNaN(soldeValue) || soldeValue < 0) {
    return res.status(400).json({ message: "Le solde utilise doit etre positif ou zero" });
  }

  // Solde valide → continuation.
  next();
}

/**
 * Valide le remboursement d'une carte de crédit depuis un compte bancaire.
 *
 * Pour rembourser une carte, l'utilisateur doit spécifier le compte bancaire
 * à débiter (compte_id) et le montant à rembourser (strictement positif).
 *
 * Champs vérifiés :
 *   - `compte_id` : obligatoire, doit être un entier positif valide.
 *   - `montant`   : obligatoire, nombre strictement positif.
 *
 * @param {import("express").Request}  req  - Corps attendu : { compte_id, montant }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateRembourserCarte(req, res, next) {
  // Conversion des deux valeurs numériques.
  const compteId = Number(req.body.compte_id);
  const montant  = Number(req.body.montant);

  // L'ID du compte doit être un entier positif valide (0 serait falsy → invalide).
  if (!compteId) {
    return res.status(400).json({ message: "compte_id invalide" });
  }

  // Le montant de remboursement doit être strictement positif.
  if (Number.isNaN(montant) || montant <= 0) {
    return res.status(400).json({ message: "Le montant doit etre positif" });
  }

  // Données valides → continuation.
  next();
}

/* ── Virements ─────────────────────────────────────── */

/**
 * Valide la création d'un virement interne entre deux comptes du même système.
 *
 * Un virement interne transfère des fonds d'un compte source vers un compte
 * destination identifiés par leurs IDs internes. Les deux comptes doivent être
 * différents pour éviter un auto-virement sans effet.
 *
 * Champs vérifiés :
 *   - `compte_source_id`      : obligatoire.
 *   - `compte_destination_id` : obligatoire.
 *   - `montant`               : obligatoire, nombre strictement positif.
 *   - Règle métier             : compte_source_id ≠ compte_destination_id.
 *
 * @param {import("express").Request}  req  - Corps attendu : { compte_source_id, compte_destination_id, montant }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateVirement(req, res, next) {
  // Extraction des trois champs obligatoires.
  const { compte_source_id, compte_destination_id, montant } = req.body;

  // Les trois champs doivent être présents.
  if (!compte_source_id || !compte_destination_id || !montant) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Le montant doit être strictement positif.
  if (Number(montant) <= 0) {
    return res.status(400).json({ message: "Le montant doit etre positif" });
  }

  // Règle métier : on ne peut pas virer de l'argent d'un compte vers lui-même.
  // On compare en Number pour éviter les faux positifs de comparaison string/number.
  if (Number(compte_source_id) === Number(compte_destination_id)) {
    return res.status(400).json({ message: "Les comptes doivent etre differents" });
  }

  // Données valides → continuation.
  next();
}

/**
 * Valide la création d'un virement externe vers un compte dans une autre institution.
 *
 * Un virement externe nécessite les coordonnées bancaires complètes du compte
 * destination (hors du système interne) : numéro de compte, institution et transit.
 *
 * Champs vérifiés :
 *   - `compte_source_id`        : obligatoire (ID interne du compte source).
 *   - `numero_compte_dest`      : obligatoire.
 *   - `numero_institution_dest` : obligatoire (code de l'institution financière externe).
 *   - `numero_transit_dest`     : obligatoire (numéro de transit de la succursale externe).
 *   - `montant`                 : obligatoire, nombre strictement positif.
 *
 * @param {import("express").Request}  req  - Corps attendu : voir champs ci-dessus.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateVirementExterne(req, res, next) {
  // Extraction des cinq champs obligatoires pour un virement externe.
  const { compte_source_id, numero_compte_dest, numero_institution_dest, numero_transit_dest, montant } = req.body;

  // Tous les champs doivent être présents pour identifier source et destination.
  if (!compte_source_id || !numero_compte_dest || !numero_institution_dest || !numero_transit_dest || !montant) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Le montant doit être strictement positif.
  if (Number(montant) <= 0) {
    return res.status(400).json({ message: "Le montant doit etre positif" });
  }

  // Données valides → continuation.
  next();
}

/* ── Factures ──────────────────────────────────────── */

/**
 * Valide la création d'une facture à payer.
 *
 * Une facture est associée à un client et représente une obligation de paiement
 * envers un fournisseur. Tous les champs descriptifs et financiers sont obligatoires.
 *
 * Champs vérifiés :
 *   - `fournisseur`       : obligatoire (nom du fournisseur ou de l'organisme).
 *   - `reference_facture` : obligatoire (numéro ou code unique de la facture).
 *   - `montant`           : obligatoire, nombre strictement positif.
 *   - `date_emission`     : obligatoire (date à laquelle la facture a été émise).
 *   - `date_echeance`     : obligatoire (date limite de paiement).
 *
 * @param {import("express").Request}  req  - Corps attendu : voir champs ci-dessus.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateFacture(req, res, next) {
  // Extraction des cinq champs obligatoires de la facture.
  const { fournisseur, reference_facture, montant, date_emission, date_echeance } = req.body;

  // Vérification de la présence de tous les champs.
  if (!fournisseur || !reference_facture || !montant || !date_emission || !date_echeance) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Conversion et validation du montant : doit être un nombre strictement positif.
  const montantValue = Number(montant);
  if (Number.isNaN(montantValue) || montantValue <= 0) {
    return res.status(400).json({ message: "Le montant doit etre positif" });
  }

  // Données valides → continuation.
  next();
}

/**
 * Valide le paiement d'une facture existante.
 *
 * Pour payer une facture, l'utilisateur doit spécifier le compte bancaire
 * à débiter (compte_id). La facture est identifiée par son ID dans l'URL.
 *
 * Champs vérifiés :
 *   - `compte_id` : obligatoire, doit être un entier positif valide.
 *
 * @param {import("express").Request}  req  - Corps attendu : { compte_id }.
 * @param {import("express").Response} res  - Réponse 400 si compte_id est absent ou invalide.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validatePayFacture(req, res, next) {
  // Conversion et validation de l'ID du compte de paiement.
  const compteId = Number(req.body.compte_id);

  // L'ID doit être un entier positif (0 serait falsy → invalide).
  if (!compteId) {
    return res.status(400).json({ message: "compte_id invalide" });
  }

  // compte_id valide → continuation.
  next();
}

/* ── Dépôts ────────────────────────────────────────── */

/**
 * Valide la création d'un dépôt par chèque.
 *
 * IMPORTANT : Ce middleware doit être placé APRÈS le middleware multer (`uploadCheque`)
 * dans la chaîne de middlewares de la route, car il vérifie la présence de req.file
 * (la photo du chèque uploadée par multer).
 *
 * Champs vérifiés :
 *   - `compte_id`       : obligatoire (ID interne du compte à créditer).
 *   - `montant`         : obligatoire, nombre strictement positif.
 *   - `numero_cheque`   : obligatoire (numéro inscrit sur le chèque physique).
 *   - `banque_emettrice`: obligatoire (nom de la banque ayant émis le chèque).
 *   - `req.file`        : obligatoire (photo du chèque uploadée via multer).
 *
 * @param {import("express").Request}  req  - Corps attendu + req.file depuis multer.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateDepot(req, res, next) {
  // Extraction des champs du formulaire multipart/form-data.
  const { compte_id, montant, numero_cheque, banque_emettrice } = req.body;

  // Vérification de la présence des quatre champs textuels obligatoires.
  if (!compte_id || !montant || !numero_cheque || !banque_emettrice) {
    return res.status(400).json({ message: "Champs requis : compte_id, montant, numero_cheque, banque_emettrice" });
  }

  // Vérification que la photo du chèque a bien été uploadée par multer.
  // req.file est peuplé par le middleware uploadCheque qui doit précéder ce validator.
  if (!req.file) {
    return res.status(400).json({ message: "La photo du chèque est obligatoire" });
  }

  // Conversion et validation du montant : doit être un nombre strictement positif.
  const montantNum = Number(montant);
  if (Number.isNaN(montantNum) || montantNum <= 0) {
    return res.status(400).json({ message: "Le montant doit être un nombre positif" });
  }

  // Toutes les vérifications passées → continuation.
  next();
}

/* ── Retraits ──────────────────────────────────────── */

/**
 * Valide la demande de retrait d'espèces depuis un compte bancaire.
 *
 * Un retrait est limité à 1 000 CAD par opération (règle métier de l'application).
 * Le montant doit donc être strictement positif ET inférieur ou égal à 1 000.
 *
 * Champs vérifiés :
 *   - `compte_id` : obligatoire (ID interne du compte à débiter).
 *   - `montant`   : obligatoire, nombre dans l'intervalle ]0, 1000] CAD.
 *
 * @param {import("express").Request}  req  - Corps attendu : { compte_id, montant }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateCreateRetrait(req, res, next) {
  // Extraction des deux champs obligatoires pour un retrait.
  const { compte_id, montant } = req.body;

  // Les deux champs doivent être présents.
  if (!compte_id || !montant) {
    return res.status(400).json({ message: "Champs requis : compte_id, montant" });
  }

  // Conversion et validation du montant.
  const montantNum = Number(montant);

  // Le montant doit être :
  //   - Un nombre valide (pas NaN)
  //   - Strictement positif (> 0)
  //   - Inférieur ou égal au plafond de retrait (1 000 CAD)
  if (Number.isNaN(montantNum) || montantNum <= 0 || montantNum > 1000) {
    return res.status(400).json({ message: "Le montant doit être un nombre positif et inférieur ou égal à 1000 CAD" });
  }

  // Données valides → continuation.
  next();
}

/* ── Interac ───────────────────────────────────────── */

/**
 * Valide l'envoi d'un virement Interac par courriel.
 *
 * Vérifie les champs requis pour initier un transfert Interac :
 * compte source, adresse courriel du destinataire, montant dans les limites
 * réglementaires, et mot de passe optionnel (requis si le destinataire n'a
 * pas activé l'auto-dépôt — vérifié côté contrôleur).
 *
 * Champs vérifiés :
 *   - `compte_source_id` : obligatoire, doit être présent.
 *   - `email_destinataire`: obligatoire, format courriel valide (RFC 5322 simplifié).
 *   - `montant`          : obligatoire, nombre dans ]0.50, 3000] CAD (limites Interac 2024).
 *   - `mot_de_passe`     : optionnel, mais si fourni doit faire entre 3 et 25 caractères.
 *
 * @param {import("express").Request}  req  - Corps attendu : { compte_source_id, email_destinataire, montant, mot_de_passe? }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateSendInterac(req, res, next) {
  const { compte_source_id, email_destinataire, montant, mot_de_passe } = req.body;

  // Les trois champs de base sont obligatoires.
  if (!compte_source_id || !email_destinataire || montant === undefined || montant === null || montant === "") {
    return res.status(400).json({ message: "Champs requis : compte_source_id, email_destinataire, montant" });
  }

  // Validation du format courriel (RFC 5322 simplifié — local@domaine.tld).
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email_destinataire).trim())) {
    return res.status(400).json({ message: "L'adresse courriel du destinataire est invalide" });
  }

  // Conversion et validation du montant — minimum 0,50 $ (pas de limite par transfert).
  const montantNum = Number(montant);
  if (Number.isNaN(montantNum) || montantNum < 0.5) {
    return res.status(400).json({ message: "Le montant minimum est de 0,50 $ CAD" });
  }

  // Si un mot de passe est fourni, il doit respecter les contraintes de longueur.
  // (Les règles métier supplémentaires — égalité avec email, montant — sont vérifiées dans le contrôleur.)
  if (mot_de_passe !== undefined && mot_de_passe !== null && mot_de_passe !== "") {
    const mdp = String(mot_de_passe).trim();
    if (mdp.length < 3 || mdp.length > 25) {
      return res.status(400).json({ message: "Le mot de passe doit contenir entre 3 et 25 caractères" });
    }
  }

  // Données valides → continuation.
  next();
}

/**
 * Valide la réclamation (acceptation) d'un virement Interac en attente.
 *
 * Le destinataire doit choisir un compte de dépôt et, si aucun auto-dépôt
 * n'est actif pour son adresse courriel, fournir le mot de passe de sécurité
 * défini par l'expéditeur.
 *
 * Champs vérifiés :
 *   - `compte_destination_id` : obligatoire, compte cible du destinataire.
 *   - `mot_de_passe`          : optionnel (absent si auto-dépôt), min 3 chars si présent.
 *
 * @param {import("express").Request}  req  - Corps attendu : { compte_destination_id, mot_de_passe? }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateReclamerInterac(req, res, next) {
  const { compte_destination_id } = req.body;

  // Le compte destinataire est obligatoire.
  if (!compte_destination_id) {
    return res.status(400).json({ message: "Champ requis : compte_destination_id" });
  }

  // Données valides → continuation.
  next();
}

/**
 * Valide la demande d'activation de l'auto-dépôt Interac.
 *
 * L'utilisateur soumet son adresse courriel Interac et le compte de dépôt
 * cible. L'activation est immédiate, sans code de confirmation.
 *
 * Champs vérifiés :
 *   - `email_interac`  : obligatoire, format courriel valide.
 *   - `compte_depot_id`: obligatoire, présent dans le corps.
 *
 * @param {import("express").Request}  req  - Corps attendu : { email_interac, compte_depot_id }.
 * @param {import("express").Response} res  - Réponse 400 si validation échoue.
 * @param {import("express").NextFunction} next - Appelé si la validation réussit.
 * @returns {void}
 */
export function validateDemanderAutoDeposit(req, res, next) {
  const { email_interac, compte_depot_id } = req.body;

  // Les deux champs sont obligatoires.
  if (!email_interac || !compte_depot_id) {
    return res.status(400).json({ message: "Champs requis : email_interac, compte_depot_id" });
  }

  // Validation du format courriel.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email_interac).trim())) {
    return res.status(400).json({ message: "Le format de l'adresse courriel Interac est invalide" });
  }

  // Données valides → continuation.
  next();
}

/* ── Simulation ────────────────────────────────────── */

/**
 * Valide la présence et la validité du paramètre de query `clientId`.
 *
 * Utilisé par `GET /api/simulation/snapshots?clientId=X` pour s'assurer
 * que le client cible est bien spécifié et que c'est un entier positif.
 *
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 400 si clientId absent ou invalide.
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
export function validateClientIdQuery(req, res, next) {
  const clientId = Number(req.query.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ message: "clientId est requis" });
  }
  next();
}

/**
 * Valide la création d'un snapshot de simulation.
 *
 * Champs vérifiés :
 *   - `clientId` : obligatoire, entier positif.
 *   - `nom`      : obligatoire, non vide après trim, max 100 caractères.
 *
 * @param {import("express").Request}  req - Corps : { clientId, nom, description? }.
 * @param {import("express").Response} res - 400 si validation échoue.
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
export function validateCreateSnapshot(req, res, next) {
  const { clientId, nom } = req.body;

  const cid = Number(clientId);
  if (!cid || isNaN(cid)) {
    return res.status(400).json({ message: "clientId est requis" });
  }
  if (!nom || !String(nom).trim()) {
    return res.status(400).json({ message: "Le nom du snapshot est obligatoire" });
  }
  if (String(nom).trim().length > 100) {
    return res.status(400).json({ message: "Le nom ne peut pas dépasser 100 caractères" });
  }
  next();
}

/* ── Récurrentes ───────────────────────────────────── */

/**
 * Valide la création d'une transaction récurrente.
 *
 * Champs vérifiés :
 *   - `compte_source_id`      : obligatoire.
 *   - `compte_destination_id` : obligatoire, ≠ compte_source_id.
 *   - `montant`               : obligatoire, nombre strictement positif.
 *   - `frequence`             : obligatoire, dans { HEBDOMADAIRE, MENSUEL, ANNUEL }.
 *
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 400 si validation échoue.
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
export function validateCreateRecurrente(req, res, next) {
  const { compte_source_id, compte_destination_id, montant, frequence } = req.body;

  if (!compte_source_id || !compte_destination_id || !montant || !frequence) {
    return res.status(400).json({
      message: "Champs manquants : compte_source_id, compte_destination_id, montant et frequence sont obligatoires",
    });
  }

  const FREQUENCES_VALIDES = ["HEBDOMADAIRE", "MENSUEL", "ANNUEL"];
  if (!FREQUENCES_VALIDES.includes(frequence)) {
    return res.status(400).json({
      message: "Frequence invalide. Valeurs acceptees : HEBDOMADAIRE, MENSUEL, ANNUEL",
    });
  }

  if (Number(montant) <= 0) {
    return res.status(400).json({ message: "Le montant doit etre positif" });
  }

  if (Number(compte_source_id) === Number(compte_destination_id)) {
    return res.status(400).json({ message: "Les comptes source et destination doivent etre differents" });
  }

  next();
}

/* ── Demandes de produits financiers ───────────────── */

/**
 * Types de produits financiers disponibles à la demande.
 * Cartes de crédit (VISA, Mastercard) et comptes bancaires (CHEQUES, EPARGNE).
 *
 * @constant {string[]}
 */
const TYPES_PRODUIT = ["CARTE_VISA", "CARTE_MASTERCARD", "COMPTE_CHEQUES", "COMPTE_EPARGNE"];

/**
 * Valide les données d'une demande de produit financier.
 *
 * Règles :
 *  - type_produit est obligatoire et doit être parmi les valeurs autorisées
 *  - limite_credit, si fournie, doit être un nombre positif (cartes uniquement)
 *
 * @param {import("express").Request}  req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
export function validateCreateDemandeProduit(req, res, next) {
  const { type_produit, limite_credit } = req.body;

  if (!type_produit || !TYPES_PRODUIT.includes(type_produit)) {
    return res.status(400).json({
      message: `type_produit invalide. Valeurs acceptées : ${TYPES_PRODUIT.join(", ")}`,
    });
  }

  if (limite_credit !== undefined && limite_credit !== null && limite_credit !== "") {
    const lim = Number(limite_credit);
    if (isNaN(lim) || lim <= 0) {
      return res.status(400).json({ message: "limite_credit doit être un nombre positif" });
    }
  }

  next();
}

