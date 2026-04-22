-- ============================================================
-- SCHÉMA - Leon Bank (Projet scolaire)
-- BD MySQL (utf8mb4) + clés étrangères
-- ============================================================

DROP DATABASE IF EXISTS gestion_banque;
CREATE DATABASE gestion_banque CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestion_banque;

-- ------------------------------------------------------------
-- UTILISATEURS (auth)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  role ENUM('UTILISATEUR','MODERATEUR','ADMIN') NOT NULL DEFAULT 'UTILISATEUR',
  prenom VARCHAR(80) NOT NULL,
  nom VARCHAR(80) NOT NULL,
  auto_validation TINYINT(1) NOT NULL DEFAULT 0,
  interac_limite_24h DECIMAL(10,2) NULL COMMENT 'Plafond Interac 24 h personnalisé (NULL = valeur globale)',
  interac_limite_7j  DECIMAL(10,2) NULL COMMENT 'Plafond Interac 7 j personnalisé (NULL = valeur globale)',
  interac_limite_30j DECIMAL(10,2) NULL COMMENT 'Plafond Interac 30 j personnalisé (NULL = valeur globale)',
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CLIENTS (profils fictifs)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prenom VARCHAR(80) NOT NULL,
  nom VARCHAR(80) NOT NULL,
  email_fictif VARCHAR(190) NOT NULL UNIQUE,
  ville VARCHAR(120) NULL,
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- LIAISON utilisateurs <-> clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs_clients (
  utilisateur_id INT NOT NULL,
  client_id INT NOT NULL,
  PRIMARY KEY (utilisateur_id, client_id),
  CONSTRAINT fk_uc_user 
    FOREIGN KEY (utilisateur_id) 
    REFERENCES utilisateurs(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_uc_client 
    FOREIGN KEY (client_id) 
    REFERENCES clients(id) 
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- COMPTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comptes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  type_compte ENUM('CHEQUES','EPARGNE','CREDIT') NOT NULL,
  numero_compte VARCHAR(20) NOT NULL,
  numero_institution CHAR(3) NOT NULL DEFAULT '621',
  numero_transit CHAR(5) NOT NULL DEFAULT '00000',
  swift_bic VARCHAR(11) NOT NULL DEFAULT 'NXBKCA2TXXX',
  solde DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  devise CHAR(3) NOT NULL DEFAULT 'CAD',
  est_actif TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_comptes_client
    FOREIGN KEY (client_id)
    REFERENCES clients(id)
    ON DELETE CASCADE,
  INDEX idx_comptes_client (client_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TRANSACTIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compte_id INT NOT NULL,
  type_transaction ENUM('DEPOT','RETRAIT','VIREMENT','PAIEMENT','REMBOURSEMENT') NOT NULL,
  description VARCHAR(255) NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  date_transaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  statut ENUM('TERMINEE','EN_ATTENTE') NOT NULL DEFAULT 'TERMINEE',
  CONSTRAINT fk_transactions_compte 
    FOREIGN KEY (compte_id) 
    REFERENCES comptes(id) 
    ON DELETE CASCADE,
  INDEX idx_tx_compte (compte_id),
  INDEX idx_tx_date (date_transaction)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- FACTURES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  compte_paiement_id INT NULL,
  fournisseur VARCHAR(120) NOT NULL,
  reference_facture VARCHAR(60) NOT NULL,
  description VARCHAR(255) NULL,
  montant DECIMAL(12,2) NOT NULL,
  date_emission DATE NOT NULL,
  date_echeance DATE NOT NULL,
  statut ENUM('A_VENIR','IMPAYEE','PAYEE') NOT NULL DEFAULT 'A_VENIR',
  payee_le DATETIME NULL,
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_factures_client
    FOREIGN KEY (client_id)
    REFERENCES clients(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_factures_compte_paiement
    FOREIGN KEY (compte_paiement_id)
    REFERENCES comptes(id)
    ON DELETE SET NULL,
  INDEX idx_factures_client (client_id),
  INDEX idx_factures_statut (statut),
  INDEX idx_factures_echeance (date_echeance)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  role_utilisateur ENUM('UTILISATEUR','MODERATEUR','ADMIN') NOT NULL,
  action VARCHAR(80) NOT NULL,
  details VARCHAR(255) NULL,
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id)
    ON DELETE CASCADE,
  INDEX idx_audit_logs_user (utilisateur_id),
  INDEX idx_audit_logs_role (role_utilisateur),
  INDEX idx_audit_logs_date (cree_le)
) ENGINE=InnoDB;
-- ------------------------------------------------------------
-- VIREMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS virements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compte_source_id INT NOT NULL,
  compte_destination_id INT NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  date_virement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  statut ENUM('ACCEPTE','REFUSE','EN_ATTENTE') NOT NULL DEFAULT 'ACCEPTE',
  CONSTRAINT fk_virements_source
    FOREIGN KEY (compte_source_id)
    REFERENCES comptes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_virements_destination
    FOREIGN KEY (compte_destination_id)
    REFERENCES comptes(id)
    ON DELETE CASCADE,
  INDEX idx_virements_source (compte_source_id),
  INDEX idx_virements_destination (compte_destination_id),
  INDEX idx_virements_date (date_virement)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CARTES CREDIT
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartes_credit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  numero_compte VARCHAR(22) NOT NULL,
  type_carte ENUM('VISA','MASTERCARD') NOT NULL DEFAULT 'VISA',
  limite_credit DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
  solde_utilise DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  statut ENUM('ACTIVE','GELEE','BLOQUEE','EXPIREE') NOT NULL DEFAULT 'ACTIVE',
  date_expiration DATE NOT NULL,
  cvv CHAR(3) NOT NULL,
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cartes_client
    FOREIGN KEY (client_id)
    REFERENCES clients(id)
    ON DELETE CASCADE,
  INDEX idx_cartes_client (client_id),
  INDEX idx_cartes_statut (statut)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- DÉPÔTS DE CHÈQUES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS depots_cheques (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compte_id INT NOT NULL,
  client_id INT NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  numero_cheque VARCHAR(50) NOT NULL,
  banque_emettrice VARCHAR(120) NOT NULL,
  fichier_chemin VARCHAR(500) NULL,
  statut ENUM('EN_ATTENTE','APPROUVE','REJETE') NOT NULL DEFAULT 'EN_ATTENTE',
  notes VARCHAR(255) NULL,
  depose_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  traite_le TIMESTAMP NULL,
  traite_par INT NULL,
  CONSTRAINT fk_depots_compte
    FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE,
  CONSTRAINT fk_depots_client
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_depots_traite_par
    FOREIGN KEY (traite_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_depots_compte (compte_id),
  INDEX idx_depots_client (client_id),
  INDEX idx_depots_statut (statut)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS retraits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compte_id INT NOT NULL,
  client_id INT NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  statut ENUM('EN_ATTENTE','APPROUVE','REJETE') NOT NULL DEFAULT 'EN_ATTENTE',
  approuve_par INT NULL,
  date_demande TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_approbation TIMESTAMP NULL,
  CONSTRAINT fk_retraits_compte
    FOREIGN KEY (compte_id) REFERENCES comptes(id) ON DELETE CASCADE,
  CONSTRAINT fk_retraits_client
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_retraits_approuve_par
    FOREIGN KEY (approuve_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_retraits_compte (compte_id),
  INDEX idx_retraits_client (client_id),
  INDEX idx_retraits_statut (statut)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- INTERAC AUTO-DÉPÔT
-- Enregistrement de l'adresse courriel Interac d'un utilisateur
-- avec confirmation en deux étapes (token 6 chiffres, 15 min).
-- Un seul enregistrement par utilisateur (UNIQUE sur utilisateur_id).
-- Un email Interac ne peut être actif que pour un seul utilisateur (UNIQUE sur email_interac).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interac_autodeposit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL UNIQUE,
  email_interac VARCHAR(190) NOT NULL UNIQUE,
  compte_depot_id INT NOT NULL,
  statut ENUM('EN_ATTENTE','ACTIVE') NOT NULL DEFAULT 'EN_ATTENTE',
  token_verification CHAR(6) NULL,
  token_expire_le DATETIME NULL,
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_autodeposit_utilisateur
    FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_autodeposit_compte
    FOREIGN KEY (compte_depot_id)
    REFERENCES comptes(id)
    ON DELETE CASCADE,
  INDEX idx_autodeposit_email (email_interac),
  INDEX idx_autodeposit_statut (statut)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- INTERAC TRANSFERTS (virements par courriel)
-- Fonds réservés immédiatement (source débitée à l'envoi).
-- Destinataire réclame avec mot de passe (sauf si auto-dépôt actif).
-- Expiration automatique après 30 jours (lazy — vérifiée à la lecture).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interac_transferts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expediteur_id INT NOT NULL,
  compte_source_id INT NOT NULL,
  email_destinataire VARCHAR(190) NOT NULL,
  montant DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  mot_de_passe_hash VARCHAR(255) NULL,
  statut ENUM('EN_ATTENTE','ACCEPTEE','ANNULEE','EXPIREE') NOT NULL DEFAULT 'EN_ATTENTE',
  compte_destination_id INT NULL,
  date_envoi DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_expiration DATETIME NOT NULL,
  date_traitement DATETIME NULL,
  CONSTRAINT fk_transfert_expediteur
    FOREIGN KEY (expediteur_id)
    REFERENCES utilisateurs(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transfert_source
    FOREIGN KEY (compte_source_id)
    REFERENCES comptes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transfert_destination
    FOREIGN KEY (compte_destination_id)
    REFERENCES comptes(id)
    ON DELETE SET NULL,
  INDEX idx_transfert_expediteur (expediteur_id),
  INDEX idx_transfert_email_dest (email_destinataire),
  INDEX idx_transfert_statut (statut),
  INDEX idx_transfert_expiration (date_expiration)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TRANSACTIONS RÉCURRENTES (virements planifiés)
-- Virement automatique répété à une fréquence définie.
-- Le scheduler vérifie toutes les heures et exécute les virements échus.
-- Après 3 échecs consécutifs (solde insuffisant) : statut SUSPENDUE.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions_recurrentes (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id        INT NOT NULL,
  compte_source_id      INT NOT NULL,
  compte_destination_id INT NOT NULL,
  montant               DECIMAL(12,2) NOT NULL,
  description           VARCHAR(255) NULL,
  frequence             ENUM('HEBDOMADAIRE','MENSUEL','ANNUEL') NOT NULL,
  prochaine_execution   DATE NOT NULL,
  derniere_execution    DATE NULL,
  date_fin              DATE NULL,
  nb_echecs             TINYINT NOT NULL DEFAULT 0,
  statut                ENUM('ACTIVE','SUSPENDUE','ANNULEE','TERMINEE') NOT NULL DEFAULT 'ACTIVE',
  cree_le               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rec_user   FOREIGN KEY (utilisateur_id)        REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_source FOREIGN KEY (compte_source_id)      REFERENCES comptes(id)      ON DELETE CASCADE,
  CONSTRAINT fk_rec_dest   FOREIGN KEY (compte_destination_id) REFERENCES comptes(id)      ON DELETE CASCADE,

  INDEX idx_rec_user        (utilisateur_id),
  INDEX idx_rec_statut_date (statut, prochaine_execution)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- BÉNÉFICIAIRES INTERAC (destinataires fréquents)
-- Un utilisateur peut sauvegarder des contacts Interac (alias + courriel)
-- pour pré-remplir le formulaire d'envoi sans ressaisir l'adresse.
-- Contrainte UNIQUE(utilisateur_id, email_interac) : un seul alias par courriel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interac_beneficiaires (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id INT NOT NULL,
  alias          VARCHAR(100) NOT NULL,
  email_interac  VARCHAR(190) NOT NULL,
  cree_le        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_benef_user FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE CASCADE,

  UNIQUE KEY uq_benef_user_email (utilisateur_id, email_interac),
  INDEX idx_benef_user (utilisateur_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MODE SIMULATION — Snapshots / Restauration
-- Permet à un admin de capturer l'état complet de la base
-- et de restaurer à tout moment vers un snapshot sauvegardé.
-- Exclusions : utilisateurs, audit_logs, sessions (tables système).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulation_snapshots (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  est_initial TINYINT(1)  NOT NULL DEFAULT 0,  -- 1 = protégé, non supprimable
  cree_par    INT NOT NULL,
  client_id   INT NOT NULL,
  cree_le     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_snap_user   FOREIGN KEY (cree_par)  REFERENCES utilisateurs(id),
  CONSTRAINT fk_snap_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_snap_client (client_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS simulation_snapshot_data (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_id INT NOT NULL,
  table_name  VARCHAR(64) NOT NULL,
  data_json   LONGTEXT    NOT NULL,  -- JSON array des lignes capturées

  CONSTRAINT fk_snapdata_snap FOREIGN KEY (snapshot_id)
    REFERENCES simulation_snapshots(id) ON DELETE CASCADE,

  INDEX idx_snapdata_snap (snapshot_id)
) ENGINE=InnoDB;




-- ------------------------------------------------------------
-- DEMANDES DE PRODUITS FINANCIERS
-- Permet aux clients de soumettre des demandes pour de nouveaux
-- produits (cartes ou comptes). Un admin/modérateur approuve
-- (auto-crée le produit) ou refuse la demande.
-- Flux : EN_ATTENTE → APPROUVEE (produit créé) / REFUSEE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demandes_produits (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT NOT NULL,
  type_produit    ENUM('CARTE_VISA','CARTE_MASTERCARD','COMPTE_CHEQUES','COMPTE_EPARGNE') NOT NULL,
  statut          ENUM('EN_ATTENTE','APPROUVEE','REFUSEE') NOT NULL DEFAULT 'EN_ATTENTE',
  notes           VARCHAR(255) NULL,
  limite_credit   DECIMAL(12,2) NULL,
  traite_par      INT NULL,
  cree_le         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  traite_le       TIMESTAMP NULL,
  CONSTRAINT fk_dp_client     FOREIGN KEY (client_id)  REFERENCES clients(id)       ON DELETE CASCADE,
  CONSTRAINT fk_dp_traite_par FOREIGN KEY (traite_par) REFERENCES utilisateurs(id)  ON DELETE SET NULL,
  INDEX idx_dp_client  (client_id),
  INDEX idx_dp_statut  (statut),
  INDEX idx_dp_type    (type_produit)
) ENGINE=InnoDB;
