# API — Mode Simulation (Snapshots)

Base URL : `/api/simulation`

Toutes les routes nécessitent une session active (`requireAuth`) **et** le rôle
**ADMIN** (`requireAdmin`). Les UTILISATEURS et MODÉRATEURS reçoivent `403`.

Un snapshot capture l'état des données financières d'un **client donné**
(comptes, transactions, virements, factures, cartes, dépôts, retraits,
récurrentes, Interac). Les comptes utilisateurs, les sessions et les logs
d'audit ne sont jamais capturés ni restaurés.

---

## GET `/api/simulation/snapshots?clientId=:id`

Liste tous les snapshots d'un client, du plus récent au plus ancien.
Le snapshot initial (`est_initial = 1`) apparaît toujours en premier.

**Accès** : ADMIN

**Query**

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `clientId` | number | ✓ | Id du client à interroger |

**Réponse 200**
```json
{
  "data": [
    {
      "id": 1,
      "nom": "État initial (seed)",
      "description": null,
      "est_initial": 1,
      "cree_par": 1,
      "client_id": 3,
      "cree_le": "2026-04-15T10:00:00.000Z",
      "cree_par_email": "admin@Leon.local"
    },
    {
      "id": 5,
      "nom": "Avant démo virements",
      "description": "Snapshot avant test scénario X",
      "est_initial": 0,
      "cree_par": 1,
      "client_id": 3,
      "cree_le": "2026-04-16T14:32:00.000Z",
      "cree_par_email": "admin@Leon.local"
    }
  ]
}
```

**Réponses**

| Code | Description |
|------|-------------|
| `200` | `{ data: [...] }` |
| `400` | `clientId` manquant ou invalide |
| `401` | Non authentifié |
| `403` | Pas ADMIN |
| `500` | Erreur serveur |

---

## POST `/api/simulation/snapshots`

Crée un nouveau snapshot capturant l'état actuel des données du client.

**Accès** : ADMIN

**Corps**
```json
{
  "clientId": 3,
  "nom": "Avant démo virements",
  "description": "Snapshot avant test scénario X"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `clientId` | number | ✓ | Id du client à capturer |
| `nom` | string | ✓ | Nom du snapshot (1 à 100 caractères) |
| `description` | string | — | Description libre |

**Réponses**

| Code | Description |
|------|-------------|
| `201` | `{ message, id }` — snapshot créé |
| `400` | `clientId` manquant, `nom` vide ou > 100 caractères |
| `401` | Non authentifié |
| `403` | Pas ADMIN |
| `500` | Erreur serveur |

**Audit** : `SIMULATION_SNAPSHOT_CREE`

---

## POST `/api/simulation/snapshots/:id/restaurer`

Restaure les données du client à l'état du snapshot. Opération **destructive** :
toutes les données actuelles du client (comptes, transactions, etc.) sont
effacées et remplacées par celles du snapshot.

S'exécute dans une transaction unique avec `SET FOREIGN_KEY_CHECKS = 0`. En cas
d'erreur, ROLLBACK et les données originales restent intactes.

**Accès** : ADMIN

**Réponses**

| Code | Description |
|------|-------------|
| `200` | `{ message: "Données restaurées vers \"<nom>\"" }` |
| `400` | `id` invalide |
| `401` | Non authentifié |
| `403` | Pas ADMIN |
| `404` | Snapshot introuvable |
| `500` | Erreur serveur (rollback effectué) |

**Audit** : `SIMULATION_RESTAURATION`

> Le snapshot initial (`est_initial = 1`) peut être restauré comme n'importe
> quel autre snapshot — c'est le retour à l'état seed.

---

## DELETE `/api/simulation/snapshots/:id`

Supprime définitivement un snapshot. Le snapshot initial (`est_initial = 1`)
est protégé et ne peut jamais être supprimé.

La suppression cascade automatiquement sur `simulation_snapshot_data`
(FK `ON DELETE CASCADE`).

**Accès** : ADMIN

**Réponses**

| Code | Description |
|------|-------------|
| `200` | `{ message: "Snapshot supprimé" }` |
| `400` | `id` invalide |
| `401` | Non authentifié |
| `403` | Pas ADMIN ou snapshot initial protégé |
| `404` | Snapshot introuvable |
| `500` | Erreur serveur |

**Audit** : `SIMULATION_SNAPSHOT_SUPPRIME`

---

## Modèle de données

### Table `simulation_snapshots`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | INT | PK, AUTO_INCREMENT |
| `nom` | VARCHAR(100) | NOT NULL |
| `description` | VARCHAR(255) | nullable |
| `est_initial` | TINYINT(1) | DEFAULT 0 — `1` = protégé, non supprimable |
| `cree_par` | INT | FK → `utilisateurs.id` |
| `client_id` | INT | FK → `clients.id` |
| `cree_le` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table `simulation_snapshot_data`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | INT | PK, AUTO_INCREMENT |
| `snapshot_id` | INT | FK → `simulation_snapshots.id` **ON DELETE CASCADE** |
| `table_name` | VARCHAR(64) | NOT NULL |
| `data_json` | LONGTEXT | NOT NULL — JSON array des lignes capturées |

---

## Périmètre des tables

### Capturées (par client)

`clients`, `comptes`, `transactions`, `virements`, `factures`, `cartes_credit`,
`depots_cheques`, `retraits`, `transactions_recurrentes`,
`interac_beneficiaires`, `interac_autodeposit`.

### Exclues (jamais touchées par capture/restauration)

`utilisateurs`, `audit_logs`, `sessions`, `utilisateurs_clients`,
`simulation_snapshots`, `simulation_snapshot_data`.

---

## Codes d'erreur courants

| Code | Cas |
|------|-----|
| `400` | `clientId` manquant en query, `nom` vide, `nom` > 100 char, `id` non numérique |
| `401` | Aucune session active |
| `403` | Rôle non-ADMIN, ou tentative de suppression du snapshot initial |
| `404` | Snapshot introuvable |
| `500` | Erreur serveur (transaction rollback en cas d'échec de restauration) |

---

## Référence

- Documentation fonctionnelle : `docs/simulation.md`
- Conception (diagrammes UML) : `conception/simulation.md`
