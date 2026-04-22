# Retraits en espèces

## Objectif

Permettre aux clients de soumettre une demande de retrait en espèces depuis un compte actif. Les modérateurs et administrateurs examinent et approuvent ou rejettent les demandes. L'approbation débite immédiatement le compte.

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Soumettre un retrait | ✓ | — | ✓ |
| Voir ses propres retraits | ✓ | — | ✓ |
| Voir tous les retraits | — | ✓ | ✓ |
| Approuver un retrait | — | ✓ | ✓ |
| Rejeter un retrait | — | ✓ | ✓ |

## Workflow

```
Client soumet → EN_ATTENTE (solde vérifié mais pas encore débité)
  → Modérateur/Admin approuve → APPROUVE + compte débité + transaction RETRAIT
  → Modérateur/Admin rejette  → REJETE + motif enregistré
```

Si `auto_validation = 1` sur le compte de l'utilisateur, le retrait passe directement en `APPROUVE` à la soumission — le compte est débité immédiatement.

## Règles métier

- Montant maximum : **1 000 $ CAD** par retrait
- Le montant doit être strictement positif
- Le solde du compte doit être suffisant au moment de la **soumission** (vérification préventive)
- Le compte doit être actif et appartenir à l'utilisateur
- Un retrait ne peut être traité qu'une seule fois (statut `EN_ATTENTE` requis)
- L'approbation : débite le `solde` du compte + crée une transaction `RETRAIT`
- Le rejet : enregistre le `motif_rejet`, aucun débit

## Données de démonstration

Le seed insère des retraits en différents statuts (`EN_ATTENTE`, `APPROUVE`, `REJETE`) pour chaque utilisateur de démo, avec des montants entre 50 $ et 1 000 $.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `RETRAIT_SOUMIS` | Soumission par le client |
| `RETRAIT_APPROUVE` | Approbation par mod/admin |
| `RETRAIT_REJETE` | Rejet par mod/admin |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/controllers/retraits.controller.js` | Logique métier |
| `server/data/retraits.data.js` | Requêtes SQL |
| `server/routes/retraits.routes.js` | Déclaration des routes |
| `frontend/src/app/dashboard/retraits/page.tsx` | Interface client |

## Référence API

Voir `documentation API/retraits.md`.
