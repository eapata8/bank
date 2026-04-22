# Mode Simulation — Snapshots & Restauration

## Objectif

Permettre à un administrateur de **sauvegarder l'état des données financières d'un client** (comptes, transactions, virements, factures, cartes, dépôts, retraits, transferts Interac, transactions récurrentes) dans un **snapshot nommé**, puis de **restaurer** cet état à n'importe quel moment.

Cas d'usage typiques :
- Démonstration : créer un snapshot avant la démo, jouer librement, restaurer à la fin
- Test destructif : essayer un scénario qui modifie beaucoup de données puis revenir en arrière
- Préparation pédagogique : avoir plusieurs jeux de données prêts à charger

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Voir les snapshots d'un client | — | — | ✓ |
| Créer un snapshot | — | — | ✓ |
| Restaurer un snapshot | — | — | ✓ |
| Supprimer un snapshot | — | — | ✓ (sauf snapshot initial) |

Toutes les routes sont protégées par `requireAdmin`.

## Tables capturées par snapshot

| Table | Filtre appliqué |
|-------|----------------|
| `clients` | `id = clientId` |
| `comptes` | `client_id = clientId` |
| `transactions` | comptes du client |
| `virements` | comptes du client (source ou destination) |
| `factures` | `client_id = clientId` |
| `cartes_credit` | `client_id = clientId` |
| `depots_cheques` | `client_id = clientId` |
| `retraits` | `client_id = clientId` |
| `transactions_recurrentes` | comptes du client |
| `interac_beneficiaires` | utilisateurs liés au client |
| `interac_autodeposit` | utilisateurs liés au client |

### Tables jamais touchées

`utilisateurs`, `audit_logs`, `sessions`, `utilisateurs_clients`, `simulation_snapshots`, `simulation_snapshot_data`.

> La liaison `utilisateurs_clients` est volontairement préservée : restaurer un snapshot n'arrache jamais l'accès d'un utilisateur à son client.

## Workflow

### Créer un snapshot

```
POST /api/simulation/snapshots { clientId, nom, description? }
  → Validation middleware (clientId, nom, longueur ≤ 100)
  → INSERT simulation_snapshots (est_initial = 0, cree_par, client_id)
  → Pour chaque table du périmètre :
      SELECT toutes les lignes du client
      INSERT simulation_snapshot_data (snapshot_id, table_name, JSON)
  → Audit SIMULATION_SNAPSHOT_CREE
  → 201 { id, message }
```

### Restaurer un snapshot

```
POST /api/simulation/snapshots/:id/restaurer
  → findSnapshotById → 404 si absent
  → BEGIN TRANSACTION + SET FOREIGN_KEY_CHECKS = 0
  → DELETE des données actuelles du client (ordre inverse des FK)
  → INSERT des lignes restaurées (parents → enfants)
  → COMMIT + SET FOREIGN_KEY_CHECKS = 1
  → Audit SIMULATION_RESTAURATION
  → 200 { message }
```

### Supprimer un snapshot

```
DELETE /api/simulation/snapshots/:id
  → findSnapshotById → 404 si absent
  → si est_initial = 1 → 403 (snapshot protégé)
  → DELETE simulation_snapshots WHERE id = ? AND est_initial = 0
    (CASCADE supprime les data_json associées)
  → Audit SIMULATION_SNAPSHOT_SUPPRIME
  → 200 { message }
```

## Snapshot initial (seed)

Au démarrage de `npm run db:migrate` :
- Pour chaque client existant, si aucun snapshot `est_initial = 1` n'existe
- Le système capture automatiquement son état actuel sous le nom **« État initial (seed) »**
- Ce snapshot est **non supprimable** (HTTP 403 sur DELETE)
- Il reste **restaurable** comme n'importe quel autre snapshot

C'est le **point de retour permanent** : peu importe les manipulations effectuées en mode simulation, un admin peut toujours revenir à l'état initial du seed.

## Règles métier

- Toutes les routes nécessitent le rôle ADMIN
- Un snapshot est associé à **un seul client** (isolation totale entre clients)
- Le `nom` est obligatoire (≤ 100 caractères)
- La restauration est une opération **destructive** : les données actuelles du client sont effacées avant l'insertion des données restaurées
- La transaction utilise `SET FOREIGN_KEY_CHECKS = 0` pour permettre l'ordre arbitraire des DELETE — le tout dans une transaction unique avec ROLLBACK en cas d'erreur
- Un snapshot avec `est_initial = 1` ne peut **jamais** être supprimé
- La suppression d'un snapshot cascade automatiquement sur `simulation_snapshot_data` (FK `ON DELETE CASCADE`)

## Sécurité

| Risque | Mitigation |
|--------|-----------|
| Restauration non autorisée | `requireAdmin` sur toutes les routes |
| Perte du snapshot seed | `est_initial = 1` bloque la suppression au niveau SQL et contrôleur |
| Corruption FK pendant la restauration | Transaction unique, `SET FOREIGN_KEY_CHECKS` rétabli en `finally` |
| Fuite de données entre clients | Toutes les requêtes filtrent par `client_id` |
| Touche aux comptes utilisateurs | Tables exclues du périmètre par design |
| Logs d'audit effacés | `audit_logs` exclu du périmètre |

## Audit

| Action | Déclencheur |
|--------|-------------|
| `SIMULATION_SNAPSHOT_CREE` | Création d'un snapshot |
| `SIMULATION_RESTAURATION` | Restauration vers un snapshot |
| `SIMULATION_SNAPSHOT_SUPPRIME` | Suppression d'un snapshot non protégé |

## Page frontend

`/dashboard/admin/simulation` (ADMIN uniquement) :

1. **Sélecteur de client** — choisit le client à gérer
2. **Carte snapshot initial** (badge `Initial`) avec bouton **Restaurer** + modale d'avertissement
3. **Liste des snapshots utilisateur** — chaque carte affiche nom, description, créateur, date, et boutons **Restaurer** / **Supprimer**
4. **Formulaire de création** — champs *Nom* (obligatoire) et *Description* (optionnel) + bouton **Sauvegarder l'état actuel**

Lien dans `AppShell.tsx` sous la section ADMIN : `Simulation`.

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `database/migration_simulation.sql` | Migration SQL — 2 nouvelles tables |
| `database/schema.sql` | Schéma complet (snapshots + snapshot_data) |
| `database/migrate.js` | Création automatique du snapshot initial par client |
| `server/data/simulation.data.js` | Repository : capture, restauration, listing |
| `server/controllers/simulation.controller.js` | Logique métier des 4 endpoints |
| `server/routes/simulation.routes.js` | Routes Express + middlewares de validation |
| `server/middlewares/validation.middleware.js` | `validateClientIdQuery`, `validateCreateSnapshot` |
| `server/index.js` | Montage `/api/simulation` |
| `frontend/src/app/dashboard/admin/simulation/page.tsx` | Page admin |
| `frontend/src/components/AppShell.tsx` | Lien de navigation ADMIN |
| `frontend/src/lib/types.ts` | Type `SimulationSnapshot` |

## Référence API

Voir `documentation API/simulation.md`.
