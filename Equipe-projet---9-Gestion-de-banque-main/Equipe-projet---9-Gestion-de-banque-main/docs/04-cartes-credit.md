# Cartes de crédit

## Objectif

Permettre aux clients de gérer leurs cartes de crédit, effectuer des remboursements et geler/dégeler une carte en cas de vol ou de perte — sans passer par un administrateur. Les admins ont un contrôle global (création, blocage administratif, modification de limite).

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Voir ses propres cartes | ✓ | — | ✓ |
| Voir toutes les cartes | — | ✓ lecture | ✓ |
| Rembourser sa propre carte | ✓ | — | ✓ |
| Geler / dégeler sa propre carte | ✓ | — | ✓ |
| Créer une carte | — | — | ✓ |
| Bloquer / réactiver (admin) | — | — | ✓ |
| Modifier la limite de crédit | — | — | ✓ |

## Statuts et transitions

| Statut | Qui peut y arriver | Description |
|--------|--------------------|-------------|
| `ACTIVE` | Création, dégel, réactivation admin | Carte utilisable normalement |
| `GELEE` | Client lui-même (`PATCH /geler`) | Bloquée temporairement — client peut la dégeler |
| `BLOQUEE` | Admin (`PATCH /bloquer`) | Bloquage administratif — seul l'admin peut réactiver |
| `EXPIREE` | Gestion admin | Carte expirée — aucune opération possible |

**Différence critique : GELEE vs BLOQUEE**
- `GELEE` : self-service — le client gèle sa carte en cas de perte/vol suspectée, peut la dégeler lui-même si retrouvée
- `BLOQUEE` : décision administrative — fraude confirmée ou motif légal, seul un ADMIN peut réactiver

Seule une carte `ACTIVE` peut être gelée. Seule une carte `ACTIVE` ou `GELEE` peut être bloquée par un admin.

## Workflow remboursement

```
Client saisit montant à rembourser
  → Vérification : montant ≤ solde_du courant
  → Vérification : solde du compte source suffisant
  → UPDATE comptes SET solde = solde - montant
  → UPDATE cartes_credit SET solde_du = solde_du - montant
  → INSERT transactions (type: REMBOURSEMENT, montant: -montant)
  → 201 Succès
```

Le compte associé à la carte (`compte_id`) est débité. Le `solde_du` de la carte est réduit d'autant. Il est impossible de rembourser plus que le `solde_du` actuel.

## Règles métier

- Un client ne peut gérer que ses propres cartes (vérification `client_id` via `utilisateurs_clients`)
- Une carte `GELEE` ou `BLOQUEE` ne peut pas être remboursée
- La limite de crédit ne peut pas être inférieure au `solde_du` actuel (modification refusée)
- Le MODÉRATEUR a uniquement un droit de lecture sur toutes les cartes

## Données de démonstration

Le seed crée plusieurs cartes de crédit associées aux clients de démo, avec des statuts et soldes variés (`ACTIVE`, `GELEE`), des limites entre 2 000 $ et 15 000 $, et des `solde_du` non nuls pour permettre de tester les remboursements.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `ADMIN_CREATE_CARTE` | Création d'une carte par l'admin |
| `ADMIN_BLOCK_CARTE` | Blocage administratif |
| `ADMIN_UNBLOCK_CARTE` | Réactivation administrative |
| `ADMIN_UPDATE_LIMITE` | Modification de la limite de crédit |
| `GELER_CARTE` | Gel self-service par le client |
| `DEGELER_CARTE` | Dégel self-service par le client |
| `REMBOURSEMENT_CARTE` | Remboursement effectué |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/controllers/cartes.controller.js` | Logique métier |
| `server/data/cartes.data.js` | Requêtes SQL |
| `server/routes/cartes.routes.js` | Déclaration des routes |
| `frontend/src/app/dashboard/cartes/page.tsx` | Interface client |

## Référence API

Voir `documentation API/cartes.md`.
