# Demandes de produits financiers

## Objectif

Offrir aux clients un catalogue visuel des produits bancaires disponibles (cartes de crédit, comptes bancaires) depuis lequel ils peuvent soumettre une demande d'ouverture sans intervention humaine à la saisie. Un admin/modérateur examine la demande et l'approuve ou la refuse ; l'approbation crée automatiquement le produit correspondant sur le compte du client.

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Voir le catalogue et ses propres demandes | ✓ | — | ✓ |
| Soumettre une demande | ✓ | — | ✓ (si profil client lié) |
| Annuler sa propre demande EN_ATTENTE | ✓ | ✓ | ✓ |
| Voir toutes les demandes | — | ✓ | ✓ |
| Approuver une demande | — | ✓ | ✓ |
| Refuser une demande | — | ✓ | ✓ |

Le modérateur est explicitement bloqué en soumission (middleware `requireNotModerator`).

## Produits proposés

| Type | Produit créé à l'approbation | Détails auto |
|------|------------------------------|--------------|
| `CARTE_VISA` | `cartes_credit` | Préfixe 4, limite 5 000 $ par défaut, expiration à 3 ans |
| `CARTE_MASTERCARD` | `cartes_credit` | Préfixe 5, limite 5 000 $ par défaut, expiration à 3 ans |
| `COMPTE_CHEQUES` | `comptes` | Devise CAD, solde 0, institution 621 |
| `COMPTE_EPARGNE` | `comptes` | Devise CAD, solde 0, institution 621 |

## Statuts et transitions

| Statut | Description |
|--------|-------------|
| `EN_ATTENTE` | Demande soumise, en attente de traitement |
| `APPROUVEE` | Produit créé sur le compte du client (immuable) |
| `REFUSEE` | Demande rejetée par l'admin, motif optionnel (immuable) |

L'**annulation** par le client supprime physiquement la ligne — le client peut ensuite soumettre une nouvelle demande du même type immédiatement.

## Règles métier

- Un client ne peut avoir qu'**une seule demande EN_ATTENTE** par type de produit à la fois (réponse `409` en cas de doublon).
- L'approbation et la création du produit sont **atomiques** (transaction SQL avec ROLLBACK si l'INSERT échoue).
- Le statut d'une demande ne peut passer à `APPROUVEE`/`REFUSEE` qu'à partir de `EN_ATTENTE`.
- L'annulation n'est possible que sur une demande `EN_ATTENTE` — un utilisateur ne peut pas annuler la demande d'un autre client (vérification via `utilisateurs_clients`).

## Auto-validation

Si l'utilisateur connecté a `utilisateurs.auto_validation = 1`, sa demande est **approuvée automatiquement** à la soumission — exactement comme pour les dépôts et retraits. Le produit (carte ou compte) est créé immédiatement dans la même transaction et la réponse API inclut `auto_valide: true`. Deux entrées d'audit sont tracées : `CREATE_DEMANDE_PRODUIT` puis `APPROUVER_DEMANDE_PRODUIT` (avec la mention « auto-approuvée (auto_validation) »).

## Parcours client

1. Le client ouvre `/dashboard/produits` — il voit les 4 produits avec, pour les cartes, un rendu 3D WebGL affichant son nom.
2. Il clique « Demander » sur un produit → `POST /api/demandes-produits`.
3. Le statut `EN_ATTENTE` s'affiche dans la tuile et dans l'historique « Mes demandes ».
4. Le client peut cliquer « Annuler » → modal de confirmation → `DELETE /api/demandes-produits/:id`.
5. Lorsqu'un admin approuve → le produit est visible dans `/dashboard/cartes` ou `/dashboard/comptes`.

## Parcours admin

1. L'admin ouvre `/dashboard/admin/demandes` — tableau filtrable par statut et type.
2. Pour chaque demande `EN_ATTENTE` : boutons **Approuver** (vert) et **Refuser** (avec motif optionnel).
3. L'approbation provisionne automatiquement le produit dans la bonne table.
4. Toutes les actions sont tracées dans le journal d'audit.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `CREATE_DEMANDE_PRODUIT` | Soumission par un client |
| `APPROUVER_DEMANDE_PRODUIT` | Approbation + création du produit |
| `REFUSER_DEMANDE_PRODUIT` | Refus administratif |
| `ANNULER_DEMANDE_PRODUIT` | Annulation par le client ou admin |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/controllers/demandes_produits.controller.js` | Logique métier |
| `server/data/demandes_produits.data.js` | Requêtes SQL |
| `server/routes/demandes_produits.routes.js` | Déclaration des routes |
| `server/middlewares/validation.middleware.js` | `validateCreateDemandeProduit` |
| `database/schema.sql` | Table `demandes_produits` |
| `frontend/src/app/dashboard/produits/page.tsx` | Catalogue client |
| `frontend/src/app/dashboard/admin/demandes/page.tsx` | Gestion admin |
| `frontend/src/components/CreditCard3D.tsx` | Rendu 3D (VISA / Mastercard) |
| `tests/repository/demandes_produits.data.test.js` | Tests data (100 %) |
| `tests/controller/demandes_produits.controller.test.js` | Tests controller (100 %) |

## Référence API

Voir `documentation API/07-demandes-produits.md`.
