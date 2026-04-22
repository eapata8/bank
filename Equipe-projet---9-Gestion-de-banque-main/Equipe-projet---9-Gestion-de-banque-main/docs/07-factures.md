# Factures

## Objectif

Permettre aux clients de consulter et payer leurs factures depuis un compte autorisé. Les administrateurs peuvent créer des factures pour n'importe quel client.

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Voir ses propres factures | ✓ | — | ✓ |
| Voir toutes les factures | — | ✓ | ✓ |
| Payer une facture | ✓ | — | ✓ |
| Créer une facture | — | — | ✓ |

## Workflow paiement

```
Client sélectionne une facture EN_ATTENTE + un compte source
  → Vérification : compte appartient au client de la facture
  → Vérification : solde suffisant
  → UPDATE comptes SET solde = solde - montant
  → UPDATE factures SET statut = 'PAYEE'
  → INSERT transactions (type: PAIEMENT, montant: -montant)
  → 200 Succès
```

## Statuts

| Statut | Description |
|--------|-------------|
| `EN_ATTENTE` | Facture non payée — peut être payée |
| `PAYEE` | Facture réglée — aucune action possible |

Une facture `PAYEE` ne peut plus être payée une deuxième fois (retourne `400`).

## Règles métier

- Le compte de paiement doit appartenir au **même client** que la facture — un utilisateur avec plusieurs clients ne peut pas payer la facture du client A avec le compte du client B
- Le solde du compte doit être suffisant au moment du paiement
- Le paiement est irréversible côté client (seul un admin peut supprimer une transaction manuellement)
- La création de facture est réservée aux admins : ils peuvent créer une facture pour n'importe quel client, avec n'importe quel montant et date d'échéance

## Données de démonstration

Le seed insère des factures pour chaque client de démonstration :

| Fournisseur | Statut typique |
|-------------|----------------|
| Hydro-Québec | `EN_ATTENTE` |
| Vidéotron | `EN_ATTENTE` |
| Bell | `PAYEE` |
| Desjardins Assurances | `EN_ATTENTE` |
| Ville de Montréal | `PAYEE` |

Montants entre 45 $ et 320 $, dates d'échéance variées.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `PAIEMENT_FACTURE` | Paiement effectué par le client |
| `ADMIN_CREATE_FACTURE` | Création de facture par l'admin |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/controllers/factures.controller.js` | Logique métier |
| `server/data/factures.data.js` | Requêtes SQL |
| `server/routes/factures.routes.js` | Déclaration des routes |
| `frontend/src/app/dashboard/factures/page.tsx` | Interface client |

## Référence API

Voir `documentation API/factures.md`.
