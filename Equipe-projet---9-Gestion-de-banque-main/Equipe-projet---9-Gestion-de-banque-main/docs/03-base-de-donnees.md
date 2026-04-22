# Base de données — Leon Bank

## Vue d'ensemble

Base MySQL nommée `gestion_banque`. Gérée via les scripts dans le dossier `database/`.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `database/schema.sql` | Création de toutes les tables et contraintes |
| `database/seed.sql` | Données de démonstration (utilisateurs, comptes, transactions, etc.) |
| `database/init-db.js` | Script Node qui exécute schema + seed + création admin depuis `.env` |
| `database/migration_auto_validation.sql` | Ajout de la colonne `auto_validation` sur `utilisateurs` |
| `database/migration_interac.sql` | Tables `interac_transferts`, `interac_autodeposit` + colonnes de limites sur `utilisateurs` |

## Initialisation

```bash
npm run db:init
```

Variables de connexion dans `.env` :

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_banque
```

## Schéma détaillé des tables

### `utilisateurs`
Comptes de connexion. Un utilisateur peut être lié à plusieurs clients bancaires.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant auto-incrémenté |
| `email` | VARCHAR(190) UNIQUE | Identifiant de connexion |
| `mot_de_passe_hash` | VARCHAR(255) | Hash bcrypt (10 rounds) |
| `role` | ENUM | `UTILISATEUR`, `MODERATEUR`, `ADMIN` |
| `prenom` / `nom` | VARCHAR(80) | Nom affiché dans l'interface |
| `auto_validation` | TINYINT(1) | `1` = dépôts et retraits approuvés automatiquement |
| `interac_limite_24h` | DECIMAL(10,2) | Limite Interac personnalisée 24h (NULL = globale) |
| `interac_limite_7j` | DECIMAL(10,2) | Limite Interac personnalisée 7j (NULL = globale) |
| `interac_limite_30j` | DECIMAL(10,2) | Limite Interac personnalisée 30j (NULL = globale) |
| `cree_le` | TIMESTAMP | Date de création |

---

### `clients`
Profils bancaires. Un client peut avoir plusieurs comptes.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `prenom` / `nom` | VARCHAR(80) | Identité du client |
| `email_fictif` | VARCHAR(190) | Email de contact (peut différer du login) |
| `ville` | VARCHAR(100) | Ville de résidence |
| `cree_le` | TIMESTAMP | Date de création du profil |

---

### `utilisateurs_clients`
Table de liaison `utilisateurs` ↔ `clients`. Contrôle les droits d'accès aux comptes.

| Colonne | Type | Description |
|---------|------|-------------|
| `utilisateur_id` | INT FK | Lien vers `utilisateurs` |
| `client_id` | INT FK | Lien vers `clients` |

Clé primaire composite `(utilisateur_id, client_id)`.

---

### `comptes`
Comptes bancaires. Reliés à un seul client.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `client_id` | INT FK | Lien vers `clients` |
| `type_compte` | ENUM | `CHEQUES`, `EPARGNE`, `CREDIT` |
| `numero_compte` | VARCHAR(19) | Format `XXXX XXXX XXXX` |
| `numero_institution` | CHAR(3) | Numéro d'institution bancaire |
| `numero_transit` | CHAR(5) | Numéro de transit |
| `swift_bic` | VARCHAR(11) | Code SWIFT/BIC |
| `solde` | DECIMAL(12,2) | Solde courant en CAD |
| `devise` | CHAR(3) | Toujours `CAD` |
| `est_actif` | TINYINT(1) | `1` = actif, `0` = bloqué |
| `cree_le` | TIMESTAMP | Date d'ouverture |

---

### `transactions`
Toutes les opérations débit/crédit sur les comptes.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `compte_id` | INT FK | Compte concerné |
| `type_transaction` | ENUM | `DEPOT`, `RETRAIT`, `VIREMENT`, `PAIEMENT`, `REMBOURSEMENT` |
| `description` | VARCHAR(255) | Libellé affiché |
| `montant` | DECIMAL(12,2) | Positif = crédit, négatif = débit |
| `date_transaction` | DATETIME | Horodatage |
| `statut` | ENUM | `TERMINEE`, `EN_ATTENTE` |

---

### `virements`
Transferts entre comptes. Un virement génère deux transactions (une par compte).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `compte_source_id` | INT FK | Compte débité |
| `compte_destination_id` | INT FK | Compte crédité (nullable pour externe) |
| `montant` | DECIMAL(12,2) | Montant transféré |
| `description` | VARCHAR(255) | Libellé (nullable) |
| `date_virement` | DATETIME | Horodatage |
| `statut` | ENUM | `ACCEPTE`, `REFUSE`, `EN_ATTENTE` |
| `numero_compte_dest` | VARCHAR(19) | Coordonnées externe (nullable) |
| `numero_institution_dest` | CHAR(3) | Externe uniquement |
| `numero_transit_dest` | CHAR(5) | Externe uniquement |
| `swift_dest` | VARCHAR(11) | Externe uniquement |

---

### `factures`
Factures à payer par les clients.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `client_id` | INT FK | Client concerné |
| `fournisseur` | VARCHAR(100) | Nom du fournisseur |
| `montant` | DECIMAL(12,2) | Montant dû |
| `date_echeance` | DATE | Date d'échéance |
| `statut` | ENUM | `EN_ATTENTE`, `PAYEE` |
| `description` | VARCHAR(255) | Description (nullable) |
| `cree_le` | TIMESTAMP | Date de création |

---

### `cartes_credit`
Cartes associées à un client et un compte.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `client_id` | INT FK | Propriétaire |
| `compte_id` | INT FK | Compte associé |
| `numero_carte` | VARCHAR(19) | Numéro masqué (ex: `**** **** **** 4242`) |
| `limite_credit` | DECIMAL(12,2) | Limite autorisée |
| `solde_du` | DECIMAL(12,2) | Montant dû courant |
| `statut` | ENUM | `ACTIVE`, `BLOQUEE`, `EXPIREE`, `GELEE` |
| `date_expiration` | DATE | Date d'expiration |
| `cree_le` | TIMESTAMP | Date de création |

---

### `depots_cheques`
Chèques soumis par les clients pour dépôt.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `compte_id` | INT FK | Compte de destination |
| `utilisateur_id` | INT FK | Déposant |
| `montant` | DECIMAL(12,2) | Montant du chèque |
| `numero_cheque` | VARCHAR(50) | Référence du chèque |
| `banque_origine` | VARCHAR(100) | Banque émettrice |
| `statut` | ENUM | `EN_ATTENTE`, `APPROUVE`, `REJETE` |
| `motif_rejet` | VARCHAR(255) | Raison du rejet (nullable) |
| `photo_cheque` | VARCHAR(255) | Chemin vers le fichier uploadé |
| `cree_le` | DATETIME | Date de soumission |

---

### `retraits`
Demandes de retrait en espèces.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `compte_id` | INT FK | Compte source |
| `utilisateur_id` | INT FK | Demandeur |
| `montant` | DECIMAL(12,2) | Montant (max 1 000 $) |
| `description` | VARCHAR(255) | Motif (nullable) |
| `statut` | ENUM | `EN_ATTENTE`, `APPROUVE`, `REJETE` |
| `motif_rejet` | VARCHAR(255) | Raison du rejet (nullable) |
| `cree_le` | DATETIME | Date de soumission |

---

### `interac_transferts`
Virements Interac e-Transfer. Voir `interac-etransfer.md` pour la documentation complète.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `expediteur_id` | INT FK | Expéditeur (utilisateurs) |
| `compte_source_id` | INT FK | Compte débité |
| `email_destinataire` | VARCHAR(190) | Email du destinataire (normalisé lowercase) |
| `montant` | DECIMAL(12,2) | Montant en CAD |
| `description` | VARCHAR(255) | Libellé (nullable) |
| `mot_de_passe_hash` | VARCHAR(255) | Hash bcrypt (NULL si auto-dépôt actif) |
| `statut` | ENUM | `EN_ATTENTE`, `ACCEPTEE`, `ANNULEE`, `EXPIREE` |
| `compte_destination_id` | INT FK | Compte crédité (NULL si en attente) |
| `date_envoi` | DATETIME | Date d'envoi |
| `date_expiration` | DATETIME | `date_envoi + 30 jours` |
| `date_traitement` | DATETIME | Date d'acceptation ou d'annulation |

---

### `interac_autodeposit`
Profils d'auto-dépôt. Un seul profil actif par utilisateur.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `utilisateur_id` | INT FK UNIQUE | Un seul profil par utilisateur |
| `email_interac` | VARCHAR(190) UNIQUE | Email enregistré |
| `compte_depot_id` | INT FK | Compte de réception |
| `statut` | ENUM | `EN_ATTENTE`, `ACTIVE` |
| `token_verification` | CHAR(6) | Code de confirmation (nullable) |
| `token_expire_le` | DATETIME | Expiration du code (nullable) |
| `cree_le` | TIMESTAMP | Date de création |
| `modifie_le` | TIMESTAMP | Date de dernière modification |

---

### `audit_logs`
Journal de toutes les actions importantes, horodaté.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `utilisateur_id` | INT FK | Acteur (nullable si système) |
| `role` | VARCHAR(20) | Rôle au moment de l'action |
| `action` | VARCHAR(100) | Code action (ex: `LOGIN`, `CREATE_COMPTE`) |
| `details` | TEXT | Description textuelle de l'action |
| `cree_le` | TIMESTAMP | Horodatage |

---

### `sessions`
Sessions MySQL gérées automatiquement par `express-mysql-session`. **Ne pas modifier manuellement.**

---

### `transactions_recurrentes`
Virements planifiés répétés automatiquement par le scheduler.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `utilisateur_id` | INT FK → utilisateurs | Propriétaire de la récurrente |
| `compte_source_id` | INT FK → comptes | Compte débité à chaque exécution |
| `compte_destination_id` | INT FK → comptes | Compte crédité à chaque exécution |
| `montant` | DECIMAL(12,2) | Montant par exécution |
| `description` | VARCHAR(255) | Libellé optionnel des transactions générées |
| `frequence` | ENUM | `HEBDOMADAIRE` \| `MENSUEL` \| `ANNUEL` |
| `prochaine_execution` | DATE | Date de la prochaine exécution (mise à jour après chaque run) |
| `derniere_execution` | DATE | Date de la dernière exécution réussie ou échouée |
| `date_fin` | DATE | Date de fin optionnelle — null = illimitée |
| `nb_echecs` | TINYINT | Compteur d'échecs consécutifs (solde insuffisant) |
| `statut` | ENUM | `ACTIVE` \| `SUSPENDUE` \| `ANNULEE` \| `TERMINEE` |
| `cree_le` | TIMESTAMP | Date de création |

**Règle** : à 3 échecs (`nb_echecs >= 3`), le statut passe automatiquement à `SUSPENDUE`.

---

### `interac_beneficiaires`
Destinataires fréquents Interac sauvegardés par un utilisateur (alias + courriel).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `utilisateur_id` | INT FK → utilisateurs | Propriétaire du bénéficiaire |
| `alias` | VARCHAR(100) | Nom court affiché (ex : « Maman », « Loyer Marc ») |
| `email_interac` | VARCHAR(190) | Courriel Interac normalisé en minuscules |
| `cree_le` | TIMESTAMP | Date d'ajout |

Contrainte `UNIQUE(utilisateur_id, email_interac)` : un utilisateur ne peut pas enregistrer deux fois le même courriel.

## Relations principales

```
utilisateurs ──< utilisateurs_clients >── clients ──< comptes ──< transactions
                                                              ──< cartes_credit
                                                              ──< depots_cheques
                                                              ──< retraits
utilisateurs ──< interac_transferts (expediteur)
utilisateurs ──< interac_autodeposit (1:1)
utilisateurs ──< interac_beneficiaires
utilisateurs ──< audit_logs
utilisateurs ──< transactions_recurrentes ──► comptes (source)
                                          ──► comptes (destination)
```
