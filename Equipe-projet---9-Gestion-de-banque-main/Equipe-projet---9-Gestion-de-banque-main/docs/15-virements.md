# Virements

## Objectif

Permettre au client connecté de créer des virements entre ses comptes (interne) ou vers n'importe quel compte du réseau Leon Bank (externe par coordonnées bancaires). Les administrateurs peuvent insérer, supprimer et forcer des virements sans restriction de solde.

## Types de virements

### Virement interne
Transfert entre deux comptes du système Leon Bank. L'utilisateur sélectionne le compte source et le compte destination depuis ses comptes autorisés.

### Virement externe
Transfert vers un compte Leon Bank identifié par ses coordonnées bancaires :
- Numéro de compte (`XXXX XXXX XXXX`)
- Numéro d'institution (3 chiffres)
- Numéro de transit (5 chiffres)
- Code SWIFT/BIC (optionnel)

Si les coordonnées ne correspondent à aucun compte en base, l'opération retourne `404`.

## Workflow

```
Client soumet → Validation solde → Débit source → Crédit destination → statut ACCEPTE
                      ↓
              Solde insuffisant → 400 Solde insuffisant
```

Un virement génère **deux transactions** dans la table `transactions` :
- Une transaction de type `VIREMENT` avec montant **négatif** sur le compte source (débit)
- Une transaction de type `VIREMENT` avec montant **positif** sur le compte destination (crédit)

Le virement lui-même est enregistré dans la table `virements` avec statut `ACCEPTE` immédiatement — aucune approbation manuelle n'est requise.

## Règles métier

- Session active obligatoire
- Le compte source doit appartenir à l'utilisateur (via `utilisateurs_clients`)
- Le montant doit être strictement positif
- Le solde du compte source doit être suffisant avant l'opération
- Source et destination ne peuvent pas être le même compte
- Le statut est toujours `ACCEPTE` immédiatement (pas de file d'attente)

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Effectuer un virement depuis ses comptes | ✓ | — | ✓ |
| Consulter ses propres virements | ✓ | — | — |
| Voir tous les virements | — | ✓ | ✓ |
| Insérer un virement manuellement | — | — | ✓ |
| Supprimer un virement (avec reversal) | — | — | ✓ |
| Transfert forcé (sans vérification de solde) | — | — | ✓ |

## Transfert forcé (admin)

Permet à l'ADMIN de débiter un compte source et créditer un compte destination sans vérification de solde. Crée automatiquement le virement et les deux transactions correspondantes.

Corps : `{ compte_source_id, numero_compte_dest, institution_dest, transit_dest, montant, description? }`

## Suppression avec reversal (admin)

La suppression d'un virement via `DELETE /api/admin/virements/:id` :
1. Supprime les deux transactions associées (source et destination)
2. Reverse les soldes (recrédite la source, débite la destination)
3. Supprime l'enregistrement du virement

## Modèle de données

Voir `base-de-donnees.md` pour le schéma complet de la table `virements`. Les colonnes de coordonnées externes (`numero_compte_dest`, `numero_institution_dest`, `numero_transit_dest`, `swift_dest`) sont nullables et utilisées uniquement pour les virements externes.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `CREATE_VIREMENT` | Virement interne par le client |
| `CREATE_VIREMENT_EXTERNE` | Virement externe par le client |
| `VIEW_GLOBAL_VIREMENTS` | Consultation globale par ADMIN/MODERATEUR |
| `ADMIN_INSERT_VIREMENT` | Insertion manuelle admin |
| `ADMIN_DELETE_VIREMENT` | Suppression admin avec reversal |
| `ADMIN_FORCE_TRANSFER` | Transfert forcé par l'admin |

## Référence API

Voir `documentation API/virements.md`.
