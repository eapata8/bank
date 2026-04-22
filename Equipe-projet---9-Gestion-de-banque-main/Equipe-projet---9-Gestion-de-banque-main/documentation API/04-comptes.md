# Documentation API — Comptes et transactions

Toutes les routes nécessitent une session active (`authMiddleware`).

---

## GET /api/comptes

Liste les comptes autorisés de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR, accepte `?search=` pour filtrer par client ou numéro de compte.

**Accès :** Connecté  
**Réponse 200 :**
```json
{
  "data": [
    {
      "id": 1,
      "client_id": 1,
      "type_compte": "CHEQUES",
      "numero_compte": "4821 3390 4521",
      "solde": 24562.8,
      "devise": "CAD",
      "est_actif": 1
    }
  ]
}
```
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Liste retournée |
| 401  | Aucune session |
| 500  | Erreur serveur |

---

## GET /api/comptes/:id

Détail d'un compte autorisé.

**Accès :** Connecté  
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Compte retourné |
| 400  | ID invalide |
| 401  | Aucune session |
| 403  | Accès refusé |
| 404  | Compte introuvable |
| 500  | Erreur serveur |

---

## GET /api/comptes/types

Retourne les types de comptes disponibles.

**Accès :** Connecté  
**Réponse 200 :**
```json
{ "data": ["CHEQUES", "EPARGNE", "CREDIT"] }
```

---

## GET /api/comptes/:id/transactions

Historique des transactions d'un compte, trié du plus récent au plus ancien.

**Accès :** Connecté (propriétaire du compte)  
**Réponse 200 :**
```json
{
  "data": [
    {
      "id": 1,
      "compte_id": 1,
      "type_transaction": "DEPOT",
      "description": "Chèque déposé",
      "montant": 500.00,
      "date_transaction": "2026-02-25T15:20:00.000Z",
      "statut": "TERMINEE"
    }
  ]
}
```
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Historique retourné |
| 400  | ID invalide |
| 401  | Aucune session |
| 403  | Compte non autorisé |
| 404  | Compte introuvable |
| 500  | Erreur serveur |

---

## POST /api/comptes

Ouvre un nouveau compte pour un client existant.

**Accès :** MODERATEUR, ADMIN  
**Body :**
```json
{ "client_id": 1, "type_compte": "EPARGNE" }
```
**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Compte créé |
| 400  | Champs manquants ou type invalide |
| 401  | Aucune session |
| 403  | Accès refusé |
| 404  | Client introuvable |
| 500  | Erreur serveur |
