# Dépôts de chèques

## Objectif

Permettre aux clients de soumettre un chèque pour dépôt sur un compte actif. Les modérateurs et administrateurs vérifient et approuvent ou rejettent les demandes. L'approbation crédite immédiatement le compte.

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Soumettre un dépôt | ✓ | — | ✓ |
| Voir ses propres dépôts | ✓ | — | ✓ |
| Voir tous les dépôts | — | ✓ | ✓ |
| Approuver un dépôt | — | ✓ | ✓ |
| Rejeter un dépôt | — | ✓ | ✓ |

## Workflow

```
Client soumet (multipart/form-data) → EN_ATTENTE
  → Modérateur/Admin approuve → APPROUVE + compte crédité + transaction DEPOT
  → Modérateur/Admin rejette  → REJETE + motif enregistré
```

Si `auto_validation = 1` sur le compte de l'utilisateur, le dépôt passe directement en `APPROUVE` à la soumission — aucune intervention manuelle.

## Upload de photo

La soumission se fait en `multipart/form-data`. Le champ `photo` est obligatoire — il s'agit d'une image du chèque (JPG, PNG). Le fichier est stocké dans le dossier `uploads/` côté serveur via **Multer**. Le chemin est enregistré dans la colonne `photo_cheque`.

Champs du formulaire de soumission :
- `compte_id` — compte de destination (doit appartenir au client)
- `montant` — montant du chèque (positif, obligatoire)
- `numero_cheque` — référence du chèque
- `banque_origine` — banque émettrice
- `photo` — fichier image du chèque

## Règles métier

- Le montant doit être strictement positif
- Le compte de destination doit être actif et appartenir à l'utilisateur connecté
- Un dépôt ne peut être traité qu'une seule fois (le statut `EN_ATTENTE` est requis pour approuver ou rejeter)
- L'approbation : crédite le `solde` du compte + crée une transaction `DEPOT`
- Le rejet : enregistre le `motif_rejet` fourni, aucun débit/crédit
- Un dépôt rejeté ou approuvé ne peut plus être modifié

## Données de démonstration

Le seed insère plusieurs dépôts de chèques en différents statuts (`EN_ATTENTE`, `APPROUVE`, `REJETE`) pour permettre de tester l'interface de validation sans devoir en soumettre manuellement.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `DEPOT_CHEQUE_SOUMIS` | Soumission par le client |
| `DEPOT_CHEQUE_APPROUVE` | Approbation par mod/admin |
| `DEPOT_CHEQUE_REJETE` | Rejet par mod/admin |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/controllers/depots.controller.js` | Logique métier |
| `server/data/depots.data.js` | Requêtes SQL |
| `server/routes/depots.routes.js` | Déclaration des routes |
| `server/middlewares/upload.middleware.js` | Multer — gestion de l'upload |
| `frontend/src/app/dashboard/depots/page.tsx` | Interface client |

## Référence API

Voir `documentation API/depots.md`.
