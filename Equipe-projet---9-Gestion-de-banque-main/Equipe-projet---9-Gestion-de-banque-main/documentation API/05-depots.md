# Documentation API — Dépôts de chèques

Toutes les routes nécessitent une session active (`authMiddleware`).

---

## GET /api/depots

Liste les dépôts de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR : tous les dépôts avec `?search=`.

**Accès :** Connecté  
**Réponses :** `200` liste · `401` session manquante · `500` erreur serveur

---

## GET /api/depots/:id

Détail d'un dépôt autorisé.

**Accès :** Connecté  
**Réponses :** `200` · `400` ID invalide · `403` accès refusé · `404` introuvable · `500` erreur

---

## POST /api/depots

Soumet un chèque pour dépôt.

**Accès :** UTILISATEUR, ADMIN  
**Body :**
```json
{
  "compte_id": 5,
  "montant": 500.00,
  "numero_cheque": "CHQ-001",
  "banque_origine": "RBC"
}
```
**Réponse 201 :**
```json
{ "message": "Depot soumis", "id": 12 }
```
**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Dépôt soumis |
| 400  | Champs manquants ou montant invalide |
| 403  | Compte non autorisé |
| 404  | Compte introuvable |
| 500  | Erreur serveur |

---

## PATCH /api/depots/:id/approuver

Approuve un dépôt en attente. Crédite immédiatement le compte et crée une transaction `DEPOT`.

**Accès :** MODERATEUR, ADMIN  
**Réponses :** `200` · `400` dépôt déjà traité · `403` accès refusé · `404` introuvable · `500` erreur

---

## PATCH /api/depots/:id/rejeter

Rejette un dépôt en attente.

**Accès :** MODERATEUR, ADMIN  
**Body :** `{ "motif": "Chèque sans provision" }` (optionnel)  
**Réponses :** `200` · `400` dépôt déjà traité · `403` accès refusé · `404` introuvable · `500` erreur
