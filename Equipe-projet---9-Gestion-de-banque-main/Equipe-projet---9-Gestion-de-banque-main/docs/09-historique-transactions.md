# Historique des transactions

## Objectif

Permettre au client connecté de consulter l'historique des transactions d'un compte autorisé, trié du plus récent au plus ancien. Les administrateurs peuvent insérer et supprimer des transactions manuellement.

## Types de transactions

| Type | Sens | Description |
|------|------|-------------|
| `DEPOT` | Crédit (+) | Dépôt de chèque approuvé |
| `RETRAIT` | Débit (−) | Retrait en espèces approuvé |
| `VIREMENT` | Crédit ou Débit | Virement interne ou externe (une transaction par compte impliqué) |
| `PAIEMENT` | Débit (−) | Paiement d'une facture |
| `REMBOURSEMENT` | Crédit (+) | Remboursement d'une carte de crédit |
| `INTERAC_DEBIT` | Débit (−) | Envoi Interac e-Transfer (débit compte source) |
| `INTERAC_CREDIT` | Crédit (+) | Réception Interac e-Transfer (crédit compte destination) |

## Règles d'accès

- Session active obligatoire
- Un `UTILISATEUR` ne peut consulter que les transactions des comptes liés à ses clients
- L'accès à un compte d'un autre utilisateur retourne `403 Forbidden`
- `ADMIN` et `MODERATEUR` peuvent consulter les transactions de n'importe quel compte

## Règles de suppression (ADMIN uniquement)

- La suppression d'une transaction de type `VIREMENT` déclenche automatiquement la suppression de la transaction jumelée (source ↔ destination) et le reversal des deux soldes
- Pour les autres types, seul le montant de la transaction supprimée est reversé sur le compte concerné

## Modèle de données

Voir `base-de-donnees.md` pour le schéma complet de la table `transactions`.

## Libellés automatiques

| Opération | Libellé généré |
|-----------|----------------|
| Virement interne (source) | `Virement vers XXXX XXXX XXXX` |
| Virement interne (destination) | `Virement depuis XXXX XXXX XXXX` |
| Virement externe | `Virement externe vers [institution]` |
| Dépôt de chèque | `Dépôt chèque #[id] — [banque source]` |
| Retrait espèces | Description saisie par le client |
| Paiement facture | `Paiement facture — [fournisseur]` |
| Interac envoi | `Interac envoyé à [email]` |
| Interac réception | `Interac reçu de [email] — [description]` |

## Tri et pagination

Les transactions sont retournées triées par `date_transaction DESC` (la plus récente en premier). La pagination est gérée côté frontend.

## Audit

| Action | Déclencheur |
|--------|-------------|
| `ADMIN_INSERT_TRANSACTION` | Insertion manuelle par un admin |
| `ADMIN_DELETE_TRANSACTION` | Suppression manuelle par un admin (avec reversal) |

## Référence API

Voir `documentation API/comptes.md` (route `GET /api/comptes/:id/transactions`).
