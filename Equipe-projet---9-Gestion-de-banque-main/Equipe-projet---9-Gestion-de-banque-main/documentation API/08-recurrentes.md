# API — Transactions récurrentes

Base URL : `/api/recurrentes`

Toutes les routes nécessitent une session active (`requireAuth`).
Les MODÉRATEURS n'ont pas accès (`requireNotModerator` sur les routes de modification).

---

## GET `/api/recurrentes`

Retourne les transactions récurrentes de l'utilisateur connecté.
Un ADMIN reçoit toutes les récurrentes du système.

**Accès** : UTILISATEUR, ADMIN

**Réponse 200**
```json
{
  "data": [
    {
      "id": 1,
      "utilisateur_id": 3,
      "compte_source_id": 5,
      "compte_destination_id": 6,
      "montant": "500.00",
      "description": "Epargne mensuelle automatique",
      "frequence": "MENSUEL",
      "prochaine_execution": "2026-05-15",
      "derniere_execution": "2026-04-15",
      "date_fin": null,
      "nb_echecs": 0,
      "statut": "ACTIVE",
      "cree_le": "2026-03-01T10:00:00.000Z",
      "compte_source_numero": "4821 3390 4521",
      "compte_source_type": "CHEQUES",
      "compte_destination_numero": "4821 3390 8834",
      "compte_destination_type": "EPARGNE",
      "client_nom": "Jean Demo",
      "prochaines_executions": [
        "2026-05-15",
        "2026-06-15",
        "2026-07-15",
        "2026-08-15",
        "2026-09-15"
      ]
    }
  ]
}
```

---

## POST `/api/recurrentes`

Crée une nouvelle transaction récurrente.

**Accès** : UTILISATEUR, ADMIN (pas MODÉRATEUR)

**Corps**
```json
{
  "compte_source_id": 5,
  "compte_destination_id": 6,
  "montant": 500,
  "frequence": "MENSUEL",
  "description": "Epargne mensuelle",
  "date_debut": "2026-06-01",
  "date_fin": "2028-06-01"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `compte_source_id` | number | ✓ | Compte source (doit appartenir à l'utilisateur) |
| `compte_destination_id` | number | ✓ | Compte destination (doit exister) |
| `montant` | number | ✓ | Montant par exécution (> 0) |
| `frequence` | string | ✓ | `HEBDOMADAIRE` \| `MENSUEL` \| `ANNUEL` |
| `description` | string | — | Libellé des transactions générées |
| `date_debut` | string (YYYY-MM-DD) | — | Date de la première exécution (défaut : today + 1 période) |
| `date_fin` | string (YYYY-MM-DD) | — | Date de fin (null = pas de fin) |

**Réponses**

| Code | Description |
|------|-------------|
| `201` | `{ message, id }` — récurrente créée |
| `400` | Champs manquants, fréquence invalide, montant ≤ 0, ou comptes identiques |
| `403` | Compte source non autorisé (n'appartient pas à l'utilisateur) |
| `404` | Compte destination introuvable |
| `500` | Erreur serveur |

---

## PATCH `/api/recurrentes/:id/suspendre`

Suspend une transaction récurrente ACTIVE. Les exécutions automatiques s'arrêtent jusqu'à la reprise.

**Accès** : propriétaire de la récurrente ou ADMIN

**Réponses**

| Code | Description |
|------|-------------|
| `200` | `{ message }` — suspendue avec succès |
| `400` | La récurrente n'est pas au statut ACTIVE |
| `403` | Non autorisé (pas propriétaire ni ADMIN) |
| `404` | Récurrente introuvable |
| `500` | Erreur serveur |

---

## PATCH `/api/recurrentes/:id/reprendre`

Reprend une transaction récurrente SUSPENDUE. Elle redevient ACTIVE et sera exécutée à la prochaine date planifiée.

**Accès** : propriétaire de la récurrente ou ADMIN

**Réponses**

| Code | Description |
|------|-------------|
| `200` | `{ message }` — reprise avec succès |
| `400` | La récurrente n'est pas au statut SUSPENDUE |
| `403` | Non autorisé |
| `404` | Récurrente introuvable |
| `500` | Erreur serveur |

---

## DELETE `/api/recurrentes/:id`

Annule définitivement une transaction récurrente (statut → ANNULEE). Irréversible.

**Accès** : propriétaire de la récurrente ou ADMIN

**Réponses**

| Code | Description |
|------|-------------|
| `200` | `{ message }` — annulée avec succès |
| `400` | Déjà ANNULEE ou TERMINEE |
| `403` | Non autorisé |
| `404` | Récurrente introuvable |
| `500` | Erreur serveur |

---

## GET `/api/recurrentes/admin/all`

Vue globale de toutes les transactions récurrentes du système.

**Accès** : ADMIN uniquement

**Réponse 200** : même structure que `GET /api/recurrentes` mais sans filtrage par utilisateur.

| Code | Description |
|------|-------------|
| `200` | `{ data: [...] }` |
| `401` | Non authentifié |
| `403` | Pas ADMIN |
| `500` | Erreur serveur |
