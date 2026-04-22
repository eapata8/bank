# Gestion de Banque — LEON BANK

Application bancaire full stack avec backend `Node.js/Express`, frontend `Next.js`, base `MySQL`, authentification par session, gestion de roles, virements, factures, cartes de credit, depots de cheques, journal d'audit et interface premium style private banking.

## Vue d'ensemble

Le projet contient :

- un backend API dans [server](server)
- un frontend Next.js dans [frontend](frontend)
- une base de donnees dans [database](database)
- des tests centralises dans [tests](tests)
- la documentation dans [docs](docs)
- une collection API dans [Postman_Collection.json](Postman_Collection.json)

## Fonctionnalites principales

- inscription (signup) et authentification par session avec `express-session`
- mots de passe haches avec `bcryptjs`
- separation stricte `routes -> controllers -> repositories`
- role `ADMIN` cree uniquement via la configuration `.env` serveur
- role `MODERATEUR` cree uniquement par un admin
- role `UTILISATEUR` pour les clients standards (inscription libre)
- moderateur et admin peuvent creer un profil client et ouvrir des comptes bancaires
- consultation clients, comptes et transactions
- virements entre comptes avec historique
- factures avec statuts `A_VENIR`, `IMPAYEE`, `PAYEE`
- paiement de facture par identifiant depuis un compte autorise
- cartes de credit : creation, blocage administratif, gel/degele self-service (vol/perte), modification de limite, remboursement
- depots de cheques avec photo : soumission, approbation, rejet
- retraits en especes : soumission (max 1000 CAD), approbation, rejet, debit automatique du compte
- recherche globale pour `ADMIN` et `MODERATEUR`
- journal d'audit pour les actions sensibles (`CREATE_CLIENT`, `CREATE_COMPTE`, `CREATE_MODERATEUR`, etc.)
- export CSV des donnees : audit, utilisateurs, clients, virements, transactions (selon le role)
- suppression d'une transaction VIREMENT reverting les deux comptes impliques (source et destination)
- virements Interac e-Transfer : envoi par courriel, reclamation avec mot de passe, auto-depot en une etape, limites 24h/7j/30j (fenetres glissantes), bénéficiaires sauvegardes (alias + courriel) pour pre-remplir le formulaire d'envoi
- transactions recurrentes planifiees (hebdomadaire, mensuel, annuel) : scheduler horaire, gestion des echecs (suspension automatique apres 3 echecs), annulation et reprise
- demandes de produits financiers : catalogue 3D avec rendu WebGL (Carte VISA, Carte Mastercard, Compte CHEQUES, Compte EPARGNE), soumission par le client, approbation/refus par admin/modérateur avec auto-provisionnement du produit, auto-validation (produit créé immédiatement si `utilisateurs.auto_validation = 1`), annulation par le client
- interface frontend redesign haut de gamme style private banking

## Architecture

### Backend

```
server/
├── index.js            → point d'entree Express
├── routes/             → declaration des routes HTTP
├── controllers/        → logique metier et orchestration
├── data/               → toutes les requetes SQL (fichiers *.data.js)
└── middlewares/        → auth, controle des roles, upload
```

### Frontend

```
frontend/src/
├── app/
│   ├── login/          → page connexion + inscription
│   └── dashboard/
│       ├── page.tsx        → accueil tableau de bord
│       ├── clients/        → gestion clients (creation mod/admin)
│       ├── comptes/        → liste et detail des comptes
│       ├── virements/      → effectuer et consulter les virements
│       ├── factures/       → consulter et payer les factures
│       ├── cartes/         → cartes de credit
│       ├── depots/         → depots de cheques
│       ├── retraits/       → retraits en especes
│       └── admin/          → panneau d'administration
├── components/         → shell applicatif et composants UI
├── context/            → contexte d'authentification
└── lib/                → client API et types TypeScript
```

### Base de donnees

- [database/schema.sql](database/schema.sql) : schema complet
- [database/seed.sql](database/seed.sql) : donnees de demonstration
- [database/init-db.js](database/init-db.js) : reinitialisation complete

## Roles et droits

### UTILISATEUR

- inscription libre via la page login (aucun compte bancaire cree automatiquement)
- consulte ses clients lies
- consulte ses comptes autorises
- consulte ses transactions
- consulte et paie ses factures autorisees
- effectue des virements depuis ses comptes
- soumet des depots de cheques
- consulte et gere ses cartes de credit
- **gele et degele ses propres cartes** en cas de vol ou de perte (`PATCH /api/cartes/:id/geler` et `/degeler`)

### MODERATEUR

- dispose de tous les droits de consultation globale
- cree des profils clients (`POST /api/clients`)
- ouvre des comptes bancaires (`POST /api/comptes`)
- approuve ou rejette les depots de cheques
- **cree des moderateurs** (`POST /api/admin/utilisateurs/moderateur`)
- **modifie le role d'un utilisateur vers UTILISATEUR ou MODERATEUR** (`PATCH /api/admin/utilisateurs/:id/role`)
- ne peut pas creer un admin ni assigner le role ADMIN
- ne peut pas supprimer un utilisateur ni reinitialiser son mot de passe

### ADMIN

- dispose de tous les droits du moderateur
- **cree d'autres administrateurs** (`POST /api/admin/utilisateurs/admin`)
- **controle integral des comptes** : ajustement de solde, blocage/deblocage, changement de type
- **gestion des transactions** : insertion et suppression manuelles avec reversal de solde
- **gestion des virements** : insertion, suppression, transfert force sans restriction de solde
- **gestion des utilisateurs** : changer les roles (y compris ADMIN), reinitialiser les mots de passe, supprimer des utilisateurs
- **protection premier admin** : l'admin avec le plus petit `id` auto-increment ne peut pas etre supprime (critere id, pas date — la promotion d'un utilisateur ne peut pas invalider cette protection)
- cree des factures
- consulte et gere les cartes de credit globalement
- consulte le journal d'audit complet
- est initialise via les variables `.env`

## Prerequis

- Node.js 18 ou plus
- npm
- MySQL ou MariaDB

## Installation

Depuis la racine du projet :

```bash
npm install
npm --prefix frontend install
```

## Configuration `.env`

Creer un fichier [.env](.env) a la racine :

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=gestion_banque
SESSION_SECRET=change_me_session_secret
ADMIN_EMAIL=admin@leon.local
ADMIN_PASSWORD=Demo123!
ADMIN_PRENOM=Admin
ADMIN_NOM=Config
```

## Initialiser la base

```bash
npm run db:init
```

Le script :

- recree le schema
- recharge les donnees de demo
- recree ou met a jour le compte admin depuis `.env`

## Lancer le projet

### Backend + frontend ensemble

```bash
npm run dev
```

Applications disponibles :

- frontend : `http://localhost:3000`
- backend : `http://localhost:5000`

### Lancer seulement le backend

```bash
npm run dev:back
```

### Lancer seulement le frontend

```bash
npm run dev:front
```

Le frontend utilise par defaut :

- `next dev --webpack`
- une limite memoire via `NODE_OPTIONS=--max-old-space-size=768`

## Scripts utiles

| Commande | Description |
|---|---|
| `npm run dev` | Lance backend + frontend |
| `npm run dev:back` | Lance seulement le backend |
| `npm run dev:front` | Lance seulement le frontend |
| `npm run db:init` | Reinitialise la base de donnees |
| `npm test` | Tous les tests Jest |
| `npm run test:watch` | Tests en mode watch |
| `npm run test:coverage` | Coverage Jest |
| `npm run frontend:build` | Build de production frontend |
| `npm run frontend:start` | Serveur de production frontend |

## Tests

Tous les tests sont centralises dans [tests](tests) et couvrent :

- `tests/controller/` : tests unitaires des controllers (repositories moques)
- `tests/repository/` : tests unitaires des repositories (db moque)
- `tests/middlewares/` : tests des middlewares d'authentification
- `tests/frontend/` : tests des pages React (admin, comptes, virements, etc.)
- `tests/controller/admin.controller.test.js` : controle integral comptes et utilisateurs
- `tests/controller/retraits.controller.test.js` : retraits en especes
- `tests/repository/admin.data.test.js` : acces aux donnees admin
- `tests/repository/retraits.data.test.js` : acces aux donnees retraits

### Lancer tous les tests

```bash
npm test
```

### Coverage Jest

```bash
npm run test:coverage
```

Le dossier `coverage/` est genere a la racine.

> 35 suites — controller, repository, middleware, frontend.

## API principale

### Auth

| Methode | Route | Acces | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Inscription (role UTILISATEUR) |
| `POST` | `/api/auth/login` | Public | Connexion |
| `POST` | `/api/auth/logout` | Connecte | Deconnexion |
| `GET` | `/api/auth/me` | Connecte | Utilisateur courant |
| `GET` | `/api/auth/logs` | Admin | Journal d'audit |

### Clients

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/clients` | Connecte | Liste des clients (filtre par role) |
| `POST` | `/api/clients` | Mod/Admin | Creer un profil client |
| `GET` | `/api/clients/:clientId/comptes` | Connecte | Comptes d'un client |

Corps `POST /api/clients` :
```json
{
  "prenom": "Jean",
  "nom": "Tremblay",
  "email_fictif": "jean.tremblay@nexus.local",
  "ville": "Montreal",
  "utilisateur_id": 5
}
```

### Comptes

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/comptes` | Connecte | Liste des comptes (filtre par role) |
| `POST` | `/api/comptes` | Mod/Admin | Ouvrir un compte bancaire |
| `GET` | `/api/comptes/types` | Connecte | Types disponibles |
| `GET` | `/api/comptes/:id` | Connecte | Detail d'un compte |
| `GET` | `/api/comptes/:id/transactions` | Connecte | Transactions d'un compte |

Corps `POST /api/comptes` :
```json
{
  "client_id": 3,
  "type_compte": "CHEQUES",
  "last_four": "4242"
}
```
Types valides : `CHEQUES`, `EPARGNE`, `CREDIT`

### Virements

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/virements` | Connecte | Historique des virements |
| `POST` | `/api/virements` | Connecte | Effectuer un virement |

### Factures

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/factures` | Connecte | Liste des factures |
| `GET` | `/api/factures/:id` | Connecte | Detail d'une facture |
| `POST` | `/api/factures` | Connecte | Creer une facture |
| `POST` | `/api/factures/:id/payer` | Connecte | Payer une facture |

### Cartes de credit

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/cartes` | Connecte | Liste des cartes |
| `GET` | `/api/cartes/:id` | Connecte | Detail d'une carte |
| `POST` | `/api/cartes` | Connecte | Creer une carte |
| `PATCH` | `/api/cartes/:id/bloquer` | Admin | Blocage administratif d'une carte |
| `PATCH` | `/api/cartes/:id/activer` | Admin | Reactivation administrative d'une carte |
| `PATCH` | `/api/cartes/:id/geler` | Connecte | Gel self-service (vol/perte) par l'utilisateur |
| `PATCH` | `/api/cartes/:id/degeler` | Connecte | Degeler sa propre carte |
| `PATCH` | `/api/cartes/:id/limite` | Admin | Modifier la limite |
| `POST` | `/api/cartes/:id/rembourser` | Connecte | Rembourser le solde |

### Depots de cheques

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/depots` | Connecte | Liste des depots |
| `GET` | `/api/depots/:id` | Connecte | Detail d'un depot |
| `POST` | `/api/depots` | Connecte | Soumettre un depot (multipart/form-data) |
| `PATCH` | `/api/depots/:id/approuver` | Mod/Admin | Approuver un depot |
| `PATCH` | `/api/depots/:id/rejeter` | Mod/Admin | Rejeter un depot |

### Retraits en especes

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/retraits` | Connecte | Liste des retraits |
| `GET` | `/api/retraits/:id` | Connecte | Detail d'un retrait |
| `POST` | `/api/retraits` | Util/Admin | Soumettre un retrait (max 1000 CAD) |
| `PATCH` | `/api/retraits/:id/approuver` | Mod/Admin | Approuver un retrait |
| `PATCH` | `/api/retraits/:id/rejeter` | Mod/Admin | Rejeter un retrait |

### Demandes de produits financiers

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/demandes-produits` | Connecte | Liste des demandes (filtre par role) |
| `GET` | `/api/demandes-produits/:id` | Connecte | Detail d'une demande |
| `POST` | `/api/demandes-produits` | Util/Admin | Soumettre une demande (CARTE_VISA, CARTE_MASTERCARD, COMPTE_CHEQUES, COMPTE_EPARGNE). Si `auto_validation = 1` sur l'utilisateur, la demande est approuvée immédiatement et la réponse inclut `auto_valide: true` |
| `PATCH` | `/api/demandes-produits/:id/approuver` | Mod/Admin | Approuver (provisionnement automatique du produit) |
| `PATCH` | `/api/demandes-produits/:id/refuser` | Mod/Admin | Refuser avec motif optionnel |
| `DELETE` | `/api/demandes-produits/:id` | Connecte | Annuler une demande EN_ATTENTE (proprietaire ou admin) |

### Administration — Controle integral (ADMIN uniquement)

| Methode | Route | Description |
|---|---|---|
| `PATCH` | `/api/admin/comptes/:id/balance` | Ajuster le solde (+ credit / - debit) |
| `PATCH` | `/api/admin/comptes/:id/status` | Bloquer / debloquer un compte (toggle) |
| `PATCH` | `/api/admin/comptes/:id/type` | Changer le type de compte |
| `POST` | `/api/admin/comptes/:id/transactions` | Inserer une transaction manuelle |
| `DELETE` | `/api/admin/transactions/:txId` | Supprimer une transaction — reversal des deux comptes si VIREMENT |
| `POST` | `/api/admin/virements` | Inserer un virement |
| `DELETE` | `/api/admin/virements/:virementId` | Supprimer un virement (avec reversal) |
| `POST` | `/api/admin/virements/force` | Transfert force entre deux comptes |
| `GET` | `/api/admin/utilisateurs` | Lister tous les utilisateurs (ADMIN + MODERATEUR) |
| `POST` | `/api/admin/utilisateurs/moderateur` | Creer un moderateur (ADMIN + MODERATEUR) |
| `POST` | `/api/admin/utilisateurs/admin` | Creer un administrateur (ADMIN uniquement) |
| `DELETE` | `/api/admin/utilisateurs/:id` | Supprimer un utilisateur — premier admin protege (ADMIN uniquement) |
| `PATCH` | `/api/admin/utilisateurs/:id/role` | Changer le role — MODERATEUR limite a UTILISATEUR/MODERATEUR (ADMIN + MODERATEUR) |
| `PATCH` | `/api/admin/utilisateurs/:id/password` | Reinitialiser le mot de passe (ADMIN uniquement) |

Documentation complete : [documentation/admin-comptes.md](documentation/admin-comptes.md)

### Export CSV

| Methode | Route | Acces | Description |
|---|---|---|---|
| `GET` | `/api/export/audit` | Admin | Journal d'audit complet (CSV) |
| `GET` | `/api/export/utilisateurs` | Mod/Admin | Liste de tous les utilisateurs (CSV) |
| `GET` | `/api/export/clients` | Mod/Admin | Liste de tous les clients (CSV) |
| `GET` | `/api/export/virements` | Connecte | Virements accessibles selon le role (CSV) |
| `GET` | `/api/export/transactions/:compteId` | Connecte | Transactions d'un compte autorise (CSV) |

Le CSV est encode UTF-8 avec BOM pour compatibilite Excel. Le bouton `⬇ CSV` est disponible sur les pages : Journal d'audit, Utilisateurs, Virements et Transactions d'un compte (panneau admin).

## Donnees de demo

La base de demonstration contient :

- plusieurs utilisateurs clients avec emails differents
- deux moderateurs de demo
- un admin issu de la configuration
- **22 profils clients bancaires** (20 liés à un compte utilisateur + 2 créés par un modérateur sans accès self-service)
- **~55 comptes** répartis sur 5 profils financiers (étudiant, jeune actif, famille, professionnel, senior)
- **Soldes mathématiquement cohérents** : pour chaque compte, `solde = Σ transactions TERMINEE` (invariant vérifiable par SQL)
- Historique de **~200 transactions** sur 3-4 mois (salaires, loyers, factures, achats carte, retraits guichet)
- **~25 virements internes** avec double-écriture miroir (sortant + entrant)
- **~35 factures** (mix `A_VENIR`, `IMPAYEE`, `PAYEE`)
- **~15 cartes de crédit** (VISA et Mastercard) avec `solde_utilise` reflétant les achats réels
- **~12 dépôts de chèques** (`EN_ATTENTE`, `APPROUVE`, `REJETE`)
- **~8 retraits**, **~6 demandes de produits**, **~6 e-Transferts Interac**

Mot de passe commun pour tous les comptes de demo :

```
Demo123!
```

Comptes administratifs :

| Email | Role |
|---|---|
| `admin@Leon.local` | ADMIN |
| `mod1@Leon.local` | MODERATEUR |
| `mod2@Leon.local` | MODERATEUR |

Comptes utilisateurs nommés (profils enrichis pour la démo) :

| Email | Profil financier |
|---|---|
| `user@Leon.local` | Famille — chèques + épargne bien garnis |
| `sarah.clark@Leon.local` | Jeune active — salaire mensuel, loyer |
| `marc.roy@Leon.local` | Professionnel — revenus freelance |
| `lina.nguyen@Leon.local` | Professionnelle haut de gamme — placements |
| `adam.fournier@Leon.local` | Jeune actif — activité carte soutenue |

15 autres utilisateurs couvrent tous les profils (étudiant à senior) :

`olivier.tremblay` · `sophie.bergeron` · `thomas.girard` · `isabelle.morin` · `julien.cote` · `camille.lefebvre` · `alexandre.gagne` · `jade.bouchard` · `raphael.pelletier` · `lea.caron` · `noah.dubois` · `rosalie.desjardins` · `samuel.leblanc` · `chloe.pepin` · `vincent.lapointe`

> Tous sous le domaine `@Leon.local` avec le même mot de passe `Demo123!`.

## Documentation

### Conception (architecture & diagrammes)

| # | Fichier | Contenu |
|---|---------|---------|
| 00 | [conception/00-architecture-globale.md](conception/00-architecture-globale.md) | Architecture, ERD, stack technique |
| 01 | [conception/01-authentification.md](conception/01-authentification.md) | Auth, sessions, RBAC |
| 02 | [conception/02-clients.md](conception/02-clients.md) | Profils clients |
| 03 | [conception/03-comptes.md](conception/03-comptes.md) | Comptes bancaires |
| 04 | [conception/04-virements.md](conception/04-virements.md) | Virements internes |
| 05 | [conception/05-factures.md](conception/05-factures.md) | Factures et paiements |
| 06 | [conception/06-cartes-credit.md](conception/06-cartes-credit.md) | Cartes de crédit |
| 07 | [conception/07-depots-cheques.md](conception/07-depots-cheques.md) | Dépôts de chèques |
| 08 | [conception/08-retraits.md](conception/08-retraits.md) | Retraits en espèces |
| 09 | [conception/09-administration.md](conception/09-administration.md) | Panneau admin |
| 10 | [conception/10-export-audit.md](conception/10-export-audit.md) | Export CSV et audit |
| 11 | [conception/11-interac-etransfer.md](conception/11-interac-etransfer.md) | Interac e-Transfer |
| 12 | [conception/12-simulation.md](conception/12-simulation.md) | Simulation financière |
| 13 | [conception/13-transactions-recurrentes.md](conception/13-transactions-recurrentes.md) | Transactions récurrentes |
| 14 | [conception/14-demandes-produits.md](conception/14-demandes-produits.md) | Demandes de produits financiers |

### Documentation technique (docs/)

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [docs/01-admin.md](docs/01-admin.md) | Administration et modération |
| 02 | [docs/02-auth-session.md](docs/02-auth-session.md) | Authentification et sessions |
| 03 | [docs/03-base-de-donnees.md](docs/03-base-de-donnees.md) | Base de données MySQL |
| 04 | [docs/04-cartes-credit.md](docs/04-cartes-credit.md) | Cartes de crédit |
| 05 | [docs/05-consultation-comptes.md](docs/05-consultation-comptes.md) | Consultation des comptes |
| 06 | [docs/06-depots-cheques.md](docs/06-depots-cheques.md) | Dépôts de chèques |
| 07 | [docs/07-factures.md](docs/07-factures.md) | Factures |
| 08 | [docs/08-frontend.md](docs/08-frontend.md) | Frontend Next.js |
| 09 | [docs/09-historique-transactions.md](docs/09-historique-transactions.md) | Historique des transactions |
| 10 | [docs/10-interac-etransfer.md](docs/10-interac-etransfer.md) | Interac e-Transfer |
| 11 | [docs/11-retraits.md](docs/11-retraits.md) | Retraits en espèces |
| 12 | [docs/12-simulation.md](docs/12-simulation.md) | Simulation financière |
| 13 | [docs/13-tests.md](docs/13-tests.md) | Tests Jest |
| 14 | [docs/14-transactions-recurrentes.md](docs/14-transactions-recurrentes.md) | Transactions récurrentes |
| 15 | [docs/15-virements.md](docs/15-virements.md) | Virements |
| 16 | [docs/16-demandes-produits.md](docs/16-demandes-produits.md) | Demandes de produits financiers |

### Documentation API (documentation API/)

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [documentation API/01-admin.md](documentation%20API/01-admin.md) | Routes administration |
| 02 | [documentation API/02-auth.md](documentation%20API/02-auth.md) | Routes authentification |
| 03 | [documentation API/03-cartes.md](documentation%20API/03-cartes.md) | Routes cartes |
| 04 | [documentation API/04-comptes.md](documentation%20API/04-comptes.md) | Routes comptes |
| 05 | [documentation API/05-depots.md](documentation%20API/05-depots.md) | Routes dépôts |
| 06 | [documentation API/06-factures.md](documentation%20API/06-factures.md) | Routes factures |
| 07 | [documentation API/07-interac.md](documentation%20API/07-interac.md) | Routes Interac e-Transfer |
| 08 | [documentation API/08-recurrentes.md](documentation%20API/08-recurrentes.md) | Routes transactions récurrentes |
| 09 | [documentation API/09-retraits.md](documentation%20API/09-retraits.md) | Routes retraits |
| 10 | [documentation API/10-simulation.md](documentation%20API/10-simulation.md) | Routes simulation |
| 11 | [documentation API/11-virements.md](documentation%20API/11-virements.md) | Routes virements |
| 12 | [documentation API/12-demandes-produits.md](documentation%20API/12-demandes-produits.md) | Routes demandes de produits financiers |
