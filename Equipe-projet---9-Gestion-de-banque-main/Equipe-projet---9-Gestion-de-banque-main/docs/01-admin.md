# Administration et modération

## Objectif

Décrire les rôles disponibles, leurs droits respectifs et les fonctionnalités du panneau d'administration (gestion des comptes, utilisateurs, Interac, audit et exports CSV).

## Rôles

| Rôle | Description | Création |
|------|-------------|---------|
| `UTILISATEUR` | Client bancaire — accès limité à ses propres données | Inscription libre |
| `MODERATEUR` | Superviseur — lecture globale, approbations, création clients/comptes | Via API admin |
| `ADMIN` | Administrateur système — accès total | Via `.env` + `db:init` ou API admin |

## Matrice des droits

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Ses propres comptes et transactions | ✓ | — | ✓ |
| Vue globale (tous clients/comptes) | — | ✓ | ✓ |
| Approuver/rejeter dépôts et retraits | — | ✓ | ✓ |
| Créer un profil client | — | ✓ | ✓ |
| Ouvrir un compte bancaire | — | ✓ | ✓ |
| Créer un modérateur | — | ✓ | ✓ |
| Modifier rôle (UTILISATEUR/MODERATEUR) | — | ✓ | ✓ |
| Export CSV (utilisateurs, clients, virements) | — | ✓ | ✓ |
| Créer un administrateur | — | — | ✓ |
| Supprimer un utilisateur | — | — | ✓ |
| Réinitialiser un mot de passe | — | — | ✓ |
| Changer tout rôle (y compris ADMIN) | — | — | ✓ |
| Ajuster le solde d'un compte | — | — | ✓ |
| Bloquer / débloquer un compte | — | — | ✓ |
| Changer le type d'un compte | — | — | ✓ |
| Insérer / supprimer une transaction | — | — | ✓ |
| Insérer / supprimer un virement | — | — | ✓ |
| Transfert forcé (sans vérification de solde) | — | — | ✓ |
| Configurer `auto_validation` d'un utilisateur | — | — | ✓ |
| Gérer les limites Interac par client | — | — | ✓ |
| Gérer l'auto-dépôt Interac d'un client | — | — | ✓ |
| Journal d'audit complet | — | — | ✓ |
| Export CSV (audit) | — | — | ✓ |

## Gestion des comptes bancaires (ADMIN)

### Ajustement de solde
`PATCH /api/admin/comptes/:id/balance` — Corps : `{ montant, description? }`
- Montant positif → crédit du compte
- Montant négatif → débit du compte
- Montant zéro → refusé (`400`)
- Une transaction est créée automatiquement

### Blocage / déblocage
`PATCH /api/admin/comptes/:id/status` — Toggle `est_actif` (0 ↔ 1)

### Changement de type
`PATCH /api/admin/comptes/:id/type` — Corps : `{ type_compte }` — Valeurs : `CHEQUES`, `EPARGNE`, `CREDIT`

## Gestion des transactions (ADMIN)

### Insertion manuelle
`POST /api/admin/comptes/:id/transactions` — Corps : `{ type_transaction, montant, description? }`
Le solde du compte est ajusté immédiatement.

### Suppression avec reversal
`DELETE /api/admin/transactions/:txId`
- Si la transaction est de type `VIREMENT` : suppression de la transaction jumelée + reversal des deux soldes
- Sinon : reversal du montant sur le compte concerné uniquement

## Gestion des virements (ADMIN)

| Route | Description |
|-------|-------------|
| `POST /api/admin/virements` | Insérer un virement avec ses deux transactions |
| `DELETE /api/admin/virements/:id` | Supprimer virement + transactions + reversal des soldes |
| `POST /api/admin/virements/force` | Transfert forcé sans vérification de solde |

## Gestion des utilisateurs (ADMIN + MODERATEUR)

| Route | Accès | Description |
|-------|-------|-------------|
| `GET /api/admin/utilisateurs` | Mod/Admin | Lister tous les utilisateurs |
| `POST /api/admin/utilisateurs/moderateur` | Mod/Admin | Créer un modérateur |
| `POST /api/admin/utilisateurs/admin` | Admin | Créer un administrateur |
| `DELETE /api/admin/utilisateurs/:id` | Admin | Supprimer un utilisateur |
| `PATCH /api/admin/utilisateurs/:id/role` | Mod/Admin | Changer le rôle |
| `PATCH /api/admin/utilisateurs/:id/password` | Admin | Réinitialiser le mot de passe |
| `PATCH /api/admin/utilisateurs/:id/auto-validation` | Admin | Activer/désactiver l'auto-validation |

## Administration Interac (ADMIN)

L'admin dispose d'un panneau Interac dédié par client (`/api/admin/interac/client/:clientId`) :

| Route | Description |
|-------|-------------|
| `GET .../historique` | Tous les transferts Interac du client avec filtres |
| `GET .../stats` | Cumuls 24h/7j/30j, nombre d'envois, montant total |
| `GET .../autodeposit` | Statut du profil auto-dépôt du client |
| `POST .../autodeposit` | Forcer l'activation de l'auto-dépôt sans code de confirmation |
| `DELETE .../autodeposit` | Désactiver l'auto-dépôt du client |
| `GET .../limites` | Limites personnalisées actuelles du client |
| `PATCH .../limites` | Modifier les limites — `null` = retour aux valeurs globales |

Voir `interac-etransfer.md` pour les valeurs des limites globales et le comportement des fenêtres glissantes.

## Export CSV

| Route | Accès | Contenu |
|-------|-------|---------|
| `GET /api/export/audit` | Admin | Journal d'audit complet |
| `GET /api/export/utilisateurs` | Mod/Admin | Liste de tous les utilisateurs |
| `GET /api/export/clients` | Mod/Admin | Liste de tous les clients |
| `GET /api/export/virements` | Connecté | Virements selon le rôle |
| `GET /api/export/transactions/:compteId` | Connecté | Transactions d'un compte autorisé |

Le CSV est encodé **UTF-8 avec BOM** pour la compatibilité Excel/LibreOffice. Le bouton `⬇ CSV` est disponible dans l'interface sur les pages : Journal d'audit, Utilisateurs, Virements et Transactions.

## Règles métier importantes

### Protection du premier administrateur
L'administrateur avec le plus petit `id` parmi les comptes `ADMIN` ne peut jamais être supprimé via l'API. Cette protection est basée sur l'`id` auto-incrémenté — la promotion d'un utilisateur à `ADMIN` n'invalide pas cette règle.

### Restrictions du modérateur sur les rôles
Un modérateur peut assigner uniquement `UTILISATEUR` ou `MODERATEUR`. Il ne peut pas modifier le rôle d'un utilisateur déjà `ADMIN`.

### Interdiction d'auto-modification de rôle
Un administrateur ne peut pas modifier son propre rôle (`403`).

### Création des comptes admin

| Type | Méthode |
|------|---------|
| Premier ADMIN | Variables `.env` + `npm run db:init` |
| ADMIN supplémentaire | `POST /api/admin/utilisateurs/admin` |
| MODERATEUR | `POST /api/admin/utilisateurs/moderateur` |

## Audit automatique

Toutes les actions d'administration créent une entrée dans `audit_logs` :

| Action | Déclencheur |
|--------|-------------|
| `ADMIN_ADJUST_BALANCE` | Ajustement de solde |
| `ADMIN_BLOCK_COMPTE` / `ADMIN_UNBLOCK_COMPTE` | Blocage / déblocage |
| `ADMIN_CHANGE_ACCOUNT_TYPE` | Changement de type |
| `ADMIN_INSERT_TRANSACTION` | Insertion de transaction |
| `ADMIN_DELETE_TRANSACTION` | Suppression de transaction |
| `ADMIN_INSERT_VIREMENT` | Insertion de virement |
| `ADMIN_DELETE_VIREMENT` | Suppression de virement |
| `ADMIN_FORCE_TRANSFER` | Transfert forcé |
| `ADMIN_DELETE_USER` | Suppression d'utilisateur |
| `ADMIN_CHANGE_USER_ROLE` | Changement de rôle |
| `ADMIN_RESET_PASSWORD` | Réinitialisation de mot de passe |
| `ADMIN_CREATE_ADMIN` | Création d'un administrateur |
| `CREATE_MODERATEUR` | Création d'un modérateur |
| `ADMIN_INTERAC_SET_LIMITES` | Modification des limites Interac d'un client |
| `ADMIN_INTERAC_FORCE_AUTODEPOSIT` | Activation forcée de l'auto-dépôt |
| `ADMIN_INTERAC_DISABLE_AUTODEPOSIT` | Désactivation de l'auto-dépôt |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/routes/admin.routes.js` | Déclaration des routes admin et middlewares |
| `server/controllers/admin.controller.js` | Logique métier admin |
| `server/data/admin.data.js` | Requêtes SQL admin |
| `server/controllers/interac.controller.js` | Routes admin Interac |
| `server/routes/export.routes.js` | Routes d'export CSV |
| `server/controllers/export.controller.js` | Génération et encodage des CSV |

## Référence API

Voir `documentation API/admin.md`.
