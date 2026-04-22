# Dossier Conception — LEON BANK

Ce dossier contient les documents de **conception** (design) pour chaque fonctionnalité du système. 

Les diagrammes sont au format **Mermaid** (rendu automatiquement sur GitHub et dans la plupart des IDE).

---

## Index des fichiers

| Fichier | Fonctionnalité |
|---------|---------------|
| [00-architecture-globale.md](00-architecture-globale.md) | Architecture complète, ERD, stack technique |
| [01-authentification.md](01-authentification.md) | Auth, sessions, RBAC, audit |
| [02-clients.md](02-clients.md) | Gestion des profils clients |
| [03-comptes.md](03-comptes.md) | Comptes bancaires et transactions |
| [04-virements.md](04-virements.md) | Virements internes et externes |
| [05-factures.md](05-factures.md) | Factures et paiements |
| [06-cartes-credit.md](06-cartes-credit.md) | Cartes de crédit (cycle de vie) |
| [07-depots-cheques.md](07-depots-cheques.md) | Dépôts de chèques avec approbation |
| [08-retraits.md](08-retraits.md) | Retraits en espèces avec approbation |
| [09-administration.md](09-administration.md) | Panel admin, modération, RBAC complet |
| [10-export-audit.md](10-export-audit.md) | Export CSV et audit logs |
| [11-interac-etransfer.md](11-interac-etransfer.md) | Interac e-Transfer (virements par courriel) |
| [12-simulation.md](12-simulation.md) | Simulation et snapshots financiers |
| [13-transactions-recurrentes.md](13-transactions-recurrentes.md) | Transactions récurrentes planifiées |

---

## Structure de chaque fichier de conception

Chaque fichier suit cette structure :

1. **Description** — Vue d'ensemble de la fonctionnalité
2. **Diagramme de cas d'utilisation** — Qui fait quoi
3. **Diagramme de classes** — Entités et relations
4. **Diagramme de séquence** — Flux principal (et secondaires)
5. **Flowchart** — Logique de décision / cycle de vie
6. **Schéma de table** — Structure SQL exacte
7. **Règles métier** — Contraintes et validations
