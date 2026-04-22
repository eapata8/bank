/**
 * @fileoverview Définitions des types TypeScript partagés dans le frontend.
 *
 * Ce module centralise tous les types de données correspondant aux entités
 * retournées par l'API Leon Bank. Ces types reflètent la structure des
 * réponses JSON du serveur et sont utilisés dans tout le frontend pour
 * garantir la cohérence des données.
 *
 * @module lib/types
 */

/**
 * Représente un utilisateur connecté dans le système.
 *
 * Correspond à l'objet retourné par GET /api/auth/me.
 * Le mot de passe n'est jamais inclus dans cet objet.
 */
export type User = {
  id: number;
  email: string;
  role: "UTILISATEUR" | "MODERATEUR" | "ADMIN"; // Hiérarchie : UTILISATEUR < MODERATEUR < ADMIN
  prenom: string;
  nom: string;
};

/**
 * Représente un client bancaire (distinct d'un utilisateur).
 *
 * Un client est un titulaire de compte. Il peut être associé à un ou
 * plusieurs utilisateurs via la table utilisateurs_clients.
 * L'email fictif est un identifiant interne unique (pas une vraie adresse email).
 */
export type Client = {
  id: number;
  prenom: string;
  nom: string;
  email_fictif: string;   // Identifiant interne unique du client (format email mais fictif)
  ville: string | null;   // Optionnel : ville de résidence
  cree_le?: string;       // Horodatage de création (ISO 8601)
  login_email?: string | null; // Email(s) de login du/des utilisateur(s) rattaché(s) — renvoyé côté admin
};

/**
 * Représente un compte bancaire.
 *
 * Trois types de comptes sont supportés : CHEQUES, EPARGNE, CREDIT.
 * Les coordonnées bancaires (institution, transit, SWIFT) suivent
 * le format bancaire canadien.
 */
export type Account = {
  id: number;
  client_id: number;
  type_compte: "CHEQUES" | "EPARGNE" | "CREDIT";
  numero_compte: string;        // Format : "XXXX XXXX XXXX"
  numero_institution?: string;  // Code d'institution (Leon Bank : "621")
  numero_transit?: string;      // Code de transit à 5 chiffres (identifiant de succursale)
  swift_bic?: string;           // Code SWIFT international (Leon Bank : "NXBKCA2TXXX")
  solde: number | string;       // MySQL retourne parfois des chaînes pour les DECIMAL
  devise: string;               // Code devise ISO 4217 (ex: "CAD")
  est_actif: number | boolean;  // 0/1 en MySQL, boolean en JS
  client_prenom?: string;       // Enrichi pour l'affichage admin
  client_nom?: string;          // Enrichi pour l'affichage admin
};

/**
 * Représente une transaction dans l'historique d'un compte.
 *
 * Types de transactions : DEPOT, RETRAIT, VIREMENT, PAIEMENT, REMBOURSEMENT.
 * Le montant peut être positif (crédit) ou négatif (débit).
 */
export type Transaction = {
  id: number;
  compte_id: number;
  type_transaction: string;     // DEPOT, RETRAIT, VIREMENT, PAIEMENT, REMBOURSEMENT
  description: string;
  montant: number | string;     // Positif = crédit, négatif = débit
  date_transaction: string;     // ISO 8601
  statut: string;               // Généralement TERMINEE
};

/**
 * Représente un virement bancaire (interne ou externe).
 *
 * Inclut les informations enrichies sur les comptes source et destination
 * ainsi que les noms des clients associés pour l'affichage.
 */
export type Virement = {
  id: number;
  compte_source_id: number;
  compte_destination_id: number;
  montant: number | string;
  description: string | null;
  date_virement: string;          // ISO 8601
  statut: string;                 // Toujours ACCEPTE (virements sans modération)
  compte_source_numero: string;
  compte_destination_numero: string;
  compte_source_type: string;     // CHEQUES, EPARGNE, CREDIT
  compte_destination_type: string;
  client_source_nom: string;      // "Prénom Nom" du client source
  client_destination_nom: string; // "Prénom Nom" du client destination
};

/**
 * Représente une facture bancaire.
 *
 * Statuts possibles :
 *  - A_VENIR : créée par l'admin, pas encore due
 *  - IMPAYEE : due et non encore payée
 *  - PAYEE   : acquittée
 *
 * Le compte de paiement et la date de paiement sont renseignés lors du paiement.
 */
export type Facture = {
  id: number;
  client_id: number;
  compte_paiement_id: number | null;      // Null si pas encore payée
  fournisseur: string;
  reference_facture: string;
  description: string | null;
  montant: number | string;
  date_emission: string;                  // ISO 8601
  date_echeance: string;                  // ISO 8601
  statut: "A_VENIR" | "IMPAYEE" | "PAYEE";
  payee_le: string | null;               // ISO 8601, null si non payée
  client_nom: string;                    // "Prénom Nom" enrichi
  client_email?: string;                 // Email fictif du client
  compte_paiement_numero?: string | null; // Numéro du compte utilisé pour le paiement
};

/**
 * Représente une carte de crédit bancaire.
 *
 * Statuts possibles :
 *  - ACTIVE   : carte utilisable
 *  - GELEE    : gelée temporairement par le titulaire
 *  - BLOQUEE  : bloquée administrativement (action admin uniquement)
 *  - EXPIREE  : carte arrivée à expiration
 *
 * Le CVV est sensible et masqué par défaut dans l'interface.
 */
export type Carte = {
  id: number;
  client_id: number;
  numero_compte: string;          // Numéro complet (16 chiffres, masqué par défaut)
  type_carte: "VISA" | "MASTERCARD";
  limite_credit: number | string; // Limite de crédit accordée
  solde_utilise: number | string; // Montant actuellement utilisé (0 = carte remboursée)
  statut: "ACTIVE" | "GELEE" | "BLOQUEE" | "EXPIREE";
  date_expiration: string;        // Format variable selon la saisie
  cvv?: string;                   // Optionnel : affiché uniquement si révélé
  cree_le?: string;               // Horodatage de création
  client_nom?: string;            // "Prénom Nom" enrichi pour l'affichage admin
  client_email?: string;          // Email fictif du client
};

/**
 * Représente un dépôt par chèque.
 *
 * Statuts possibles :
 *  - EN_ATTENTE : en attente d'approbation par un modérateur/admin
 *  - APPROUVE   : chèque validé, solde crédité
 *  - REJETE     : chèque refusé, aucun crédit
 */
export type Depot = {
  id: number;
  compte_id: number;
  client_id: number;
  montant: number | string;
  numero_cheque: string;
  banque_emettrice: string;
  fichier_chemin: string | null;   // Nom du fichier image du chèque uploadé
  statut: "EN_ATTENTE" | "APPROUVE" | "REJETE";
  notes: string | null;            // Motif de rejet éventuel
  depose_le: string;               // ISO 8601 — date de soumission
  traite_le: string | null;        // ISO 8601 — date d'approbation/rejet
  traite_par: number | null;       // Id de l'agent qui a traité
  client_nom?: string;             // "Prénom Nom" enrichi
  compte_numero?: string;
  compte_type?: string;
  traite_par_nom?: string | null;  // "Prénom Nom" de l'agent traitant
};

/**
 * Représente une demande de retrait en espèces.
 *
 * Statuts possibles :
 *  - EN_ATTENTE : en attente d'approbation
 *  - APPROUVE   : retrait approuvé, solde débité, argent remis au client
 *  - REJETE     : retrait refusé, aucun débit
 */
export type Retrait = {
  id: number;
  compte_id: number;
  client_id: number;
  montant: number | string;
  description: string | null;
  statut: "EN_ATTENTE" | "APPROUVE" | "REJETE";
  approuve_par: number | null;         // Id de l'agent qui a approuvé
  date_demande: string;                // ISO 8601
  date_approbation: string | null;     // ISO 8601, null si EN_ATTENTE
  client_nom?: string;
  compte_numero?: string;
  compte_type?: string;
  approuve_par_nom?: string | null;    // "Prénom Nom" de l'agent
};

/**
 * Représente un utilisateur dans le contexte de l'administration.
 *
 * Étend User avec des informations supplémentaires visibles dans l'admin :
 * flag d'auto-validation et date de création du compte.
 */
export type AdminUser = {
  id: number;
  email: string;
  role: "UTILISATEUR" | "MODERATEUR" | "ADMIN";
  prenom: string;
  nom: string;
  auto_validation?: number;  // 0 ou 1 — si 1, dépôts/retraits approuvés automatiquement
  cree_le?: string;          // Horodatage de création du compte
};

/**
 * Enregistrement auto-dépôt Interac d'un utilisateur.
 *
 * Permet à un utilisateur d'associer son adresse courriel Interac à un compte
 * de dépôt. La liaison est confirmée en deux étapes (token à 6 chiffres).
 * Statuts :
 *  - EN_ATTENTE : inscription demandée, en attente de confirmation du token
 *  - ACTIVE     : auto-dépôt actif, les virements reçus sont crédités automatiquement
 */
export type InteracAutoDeposit = {
  id: number;
  utilisateur_id: number;
  email_interac: string;
  compte_depot_id: number;
  statut: "EN_ATTENTE" | "ACTIVE";
  cree_le?: string;
  modifie_le?: string;
  numero_compte?: string;  // Enrichi pour l'affichage (retourné par le serveur)
  type_compte?: string;    // Enrichi pour l'affichage (retourné par le serveur)
};

/**
 * Représente un virement Interac par courriel.
 *
 * Statuts :
 *  - EN_ATTENTE : envoyé, en attente de réclamation par le destinataire
 *  - ACCEPTEE   : réclamé et crédité au destinataire
 *  - ANNULEE    : annulé par l'expéditeur avant réclamation (remboursé)
 *  - EXPIREE    : non réclamé dans les 30 jours (remboursé automatiquement)
 *
 * Le mot de passe n'est jamais retourné dans les réponses API.
 */
export type InteracTransfert = {
  id: number;
  expediteur_id: number;
  compte_source_id: number;
  email_destinataire: string;
  montant: number | string;
  description: string | null;
  statut: "EN_ATTENTE" | "ACCEPTEE" | "ANNULEE" | "EXPIREE";
  compte_destination_id: number | null;
  date_envoi: string;           // ISO 8601
  date_expiration: string;      // ISO 8601
  date_traitement: string | null;
  expediteur_nom?: string;      // "Prénom Nom" enrichi
  expediteur_email?: string;    // Email de l'expéditeur
  compte_source_numero?: string;
  compte_source_type?: string;
};

/**
 * Virement Interac en attente que l'utilisateur courant peut réclamer.
 *
 * Retourné par GET /api/interac/a-reclamer — contient uniquement les
 * informations nécessaires à l'affichage et à la réclamation.
 * Le hash du mot de passe n'est jamais exposé.
 */
export type InteracAReclamer = {
  id: number;
  expediteur_id: number;
  montant: number | string;
  description: string | null;
  date_envoi: string;
  date_expiration: string;
  expediteur_nom: string;
  expediteur_email: string;
  requiert_mot_de_passe: boolean; // true si mot de passe requis (pas d'auto-dépôt)
};

/**
 * Représente une transaction récurrente planifiée.
 *
 * Statuts possibles :
 *  - ACTIVE    : en cours — exécutée automatiquement selon la fréquence
 *  - SUSPENDUE : mise en pause (manuellement ou après 3 échecs consécutifs)
 *  - ANNULEE   : annulée définitivement par l'utilisateur ou l'admin
 *  - TERMINEE  : date_fin dépassée — le scheduler a détecté la fin du cycle
 *
 * Le champ `prochaines_executions` est calculé côté serveur (JS pur, pas de DB)
 * et contient les 5 prochaines dates planifiées à partir de `prochaine_execution`.
 */
export type TransactionRecurrente = {
  id: number;
  utilisateur_id: number;
  compte_source_id: number;
  compte_destination_id: number;
  montant: number | string;
  description: string | null;
  frequence: "HEBDOMADAIRE" | "MENSUEL" | "ANNUEL";
  prochaine_execution: string;        // ISO date YYYY-MM-DD
  derniere_execution: string | null;  // ISO date, null si jamais exécutée
  date_fin: string | null;            // ISO date, null = illimitée
  nb_echecs: number;                  // Compteur d'échecs consécutifs (solde insuffisant)
  statut: "ACTIVE" | "SUSPENDUE" | "ANNULEE" | "TERMINEE";
  cree_le: string;                    // ISO 8601
  compte_source_numero: string;
  compte_source_type: string;
  compte_destination_numero: string;
  compte_destination_type: string;
  client_nom: string;
  client_destination_nom?: string;    // Nom du client propriétaire du compte destination
  prochaines_executions: string[];    // 5 prochaines dates calculées côté serveur
};

/**
 * Représente un bénéficiaire Interac sauvegardé par l'utilisateur.
 *
 * Un bénéficiaire est un destinataire fréquent (alias + courriel) que l'utilisateur
 * enregistre pour ne pas ressaisir son adresse à chaque envoi Interac.
 * La sélection d'un bénéficiaire dans le formulaire d'envoi pré-remplit
 * automatiquement le champ courriel destinataire.
 */
export type InteracBeneficiaire = {
  id: number;
  utilisateur_id: number;
  alias: string;          // Surnom affiché (ex : "Maman", "Loyer Marc")
  email_interac: string;  // Courriel Interac du destinataire (normalisé en minuscules)
  cree_le: string;        // ISO 8601 — date d'ajout
};

/**
 * Représente un snapshot de l'état de la base de données (mode simulation).
 *
 * Un snapshot capture l'état de toutes les tables métier à un instant T.
 * L'admin peut restaurer la base vers n'importe quel snapshot.
 * Le snapshot initial (est_initial = 1) est protégé et non supprimable.
 */
export type SimulationSnapshot = {
  id: number;
  nom: string;
  description: string | null;
  est_initial: number;       // 1 = protégé (non supprimable), 0 = snapshot utilisateur
  cree_par: number;
  client_id: number;         // Client dont les données sont capturées
  cree_par_email: string;    // Email de l'admin créateur (JOIN utilisateurs)
  cree_le: string;           // ISO 8601
};

/**
 * Représente une entrée du journal d'audit.
 *
 * Chaque action sensible dans l'application génère une entrée d'audit.
 * Le journal est consultable uniquement par les ADMIN.
 */
export type AuditLog = {
  id: number;
  utilisateur_id: number;
  role_utilisateur: "UTILISATEUR" | "MODERATEUR" | "ADMIN";
  action: string;           // Code de l'action (ex: "CREATE_VIREMENT", "LOGIN")
  details: string | null;   // Description textuelle avec contexte
  cree_le: string;          // ISO 8601 — horodatage de l'événement
  email: string;            // Email de l'utilisateur (joint depuis utilisateurs)
  prenom: string;           // Prénom de l'utilisateur
  nom: string;              // Nom de l'utilisateur
};

/**
 * Représente une demande de produit financier soumise par un client.
 *
 * Un client peut demander une carte de crédit (VISA ou Mastercard) ou
 * un nouveau compte bancaire (CHEQUES ou EPARGNE). Un admin/modérateur
 * approuve la demande (le produit est alors automatiquement créé) ou la refuse.
 *
 * Flux : EN_ATTENTE → APPROUVEE (produit provisionné) ou REFUSEE.
 */
export type DemandeProduit = {
  id: number;
  client_id: number;
  type_produit: "CARTE_VISA" | "CARTE_MASTERCARD" | "COMPTE_CHEQUES" | "COMPTE_EPARGNE";
  statut: "EN_ATTENTE" | "APPROUVEE" | "REFUSEE";
  notes: string | null;
  limite_credit: number | null;
  traite_par: number | null;
  cree_le: string;
  traite_le: string | null;
  // Champs enrichis (vue admin — joints depuis clients/utilisateurs)
  client_nom?: string;
  client_prenom?: string;
  client_email?: string;
  traite_par_nom?: string;
};
