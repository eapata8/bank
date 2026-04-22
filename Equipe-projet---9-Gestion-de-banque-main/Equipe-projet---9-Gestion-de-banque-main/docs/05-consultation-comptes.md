# Consultation des comptes

## Objectif

Permettre au client connecté de consulter ses comptes bancaires autorisés, leurs soldes et leur historique de transactions. Les administrateurs et modérateurs disposent d'une vue globale sur tous les comptes.

## Types de comptes

| Type | Description |
|------|-------------|
| `CHEQUES` | Compte courant — virements, dépôts, retraits, paiements de factures |
| `EPARGNE` | Compte épargne — dépôts et retraits uniquement |
| `CREDIT` | Compte de carte de crédit — remboursements associés |

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Voir ses propres comptes | ✓ | — | — |
| Voir tous les comptes | — | ✓ | ✓ |
| Recherche multi-critères | — | ✓ | ✓ |
| Consulter le détail d'un compte | ✓ (le sien) | ✓ | ✓ |
| Voir les transactions d'un compte | ✓ (le sien) | ✓ | ✓ |
| Bloquer / débloquer un compte | — | — | ✓ |
| Ajuster le solde | — | — | ✓ |
| Changer le type de compte | — | — | ✓ |

## Règles d'accès

- Un `UTILISATEUR` ne voit que les comptes liés à ses clients via la table `utilisateurs_clients`
- L'accès à un compte d'un autre utilisateur retourne `403 Forbidden`
- `ADMIN` et `MODERATEUR` voient tous les comptes avec filtres de recherche (nom, numéro, type, statut)

## Informations affichées par compte

| Champ | Description |
|-------|-------------|
| Numéro de compte | Format `XXXX XXXX XXXX` |
| Type | `CHEQUES`, `EPARGNE` ou `CREDIT` |
| Solde | Montant en CAD, arrondi à 2 décimales |
| Statut | Actif (`est_actif = 1`) ou Bloqué (`est_actif = 0`) |
| Devise | Toujours `CAD` |
| Coordonnées bancaires | Numéro d'institution, transit, SWIFT/BIC (pour virements externes) |

## Modèle de données

Voir `base-de-donnees.md` pour le schéma complet des tables `comptes` et `utilisateurs_clients`. La table de liaison `utilisateurs_clients` (clé composite `utilisateur_id` + `client_id`) est ce qui détermine quels comptes sont visibles pour chaque utilisateur.

## Ouverture d'un compte

Seuls `MODERATEUR` et `ADMIN` peuvent ouvrir un compte. Le numéro de compte est généré automatiquement (format aléatoire `XXXX XXXX XXXX`) et les 4 derniers chiffres (`last_four`) peuvent être spécifiés pour simuler une carte.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `CREATE_COMPTE` | Ouverture d'un nouveau compte |
| `ADMIN_BLOCK_COMPTE` | Blocage administratif |
| `ADMIN_UNBLOCK_COMPTE` | Déblocage administratif |
| `ADMIN_CHANGE_ACCOUNT_TYPE` | Changement de type |
| `ADMIN_ADJUST_BALANCE` | Ajustement de solde |

## Référence API

Voir `documentation API/comptes.md`.
