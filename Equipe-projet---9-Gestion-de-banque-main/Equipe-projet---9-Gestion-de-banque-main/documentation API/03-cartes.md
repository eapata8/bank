# Documentation API — Cartes de crédit

Toutes les routes nécessitent une session active (`authMiddleware`).

---

## GET /api/cartes

Retourne les cartes de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR : toutes les cartes avec `?search=`.

**Accès :** Connecté  
**Réponses :** `200` liste · `401` session manquante · `500` erreur serveur

---

## GET /api/cartes/:id

Détail d'une carte autorisée.

**Accès :** Connecté  
**Réponses :** `200` · `400` ID invalide · `403` accès refusé · `404` introuvable · `500` erreur

---

## POST /api/cartes/:id/rembourser

Effectue un remboursement sur une carte de crédit depuis un compte éligible.

**Accès :** UTILISATEUR, ADMIN  
**Body :** `{ "compte_source_id": 5, "montant": 200 }`  
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Remboursement effectué |
| 400  | Montant invalide / solde insuffisant |
| 403  | Compte non autorisé |
| 404  | Carte ou compte introuvable |
| 500  | Erreur serveur |

---

## PATCH /api/cartes/:id/geler

Gèle ou dégèle la carte (client uniquement — sa propre carte).

**Accès :** UTILISATEUR, ADMIN  
**Body :** `{ "geler": true }`  
**Réponses :** `200` · `403` accès refusé · `404` introuvable · `500` erreur

---

## POST /api/cartes

Crée une nouvelle carte de crédit pour un client.

**Accès :** ADMIN  
**Body :** `{ "client_id": 1, "compte_id": 5, "limite_credit": 5000 }`  
**Réponses :** `201` créée · `400` champs manquants · `403` accès refusé · `404` client/compte introuvable · `500` erreur

---

## PATCH /api/cartes/:id/statut

Bloque ou active une carte (administratif).

**Accès :** ADMIN  
**Body :** `{ "statut": "BLOQUEE" }` — valeurs : `ACTIVE`, `BLOQUEE`, `EXPIREE`  
**Réponses :** `200` · `400` statut invalide · `403` accès refusé · `404` introuvable · `500` erreur

---

## PATCH /api/cartes/:id/limite

Modifie la limite de crédit d'une carte.

**Accès :** ADMIN  
**Body :** `{ "limite_credit": 8000 }`  
**Réponses :** `200` · `400` montant invalide · `403` accès refusé · `404` introuvable · `500` erreur
