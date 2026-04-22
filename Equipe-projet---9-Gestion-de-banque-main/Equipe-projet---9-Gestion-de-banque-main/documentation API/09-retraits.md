# Documentation API — Retraits en espèces

Toutes les routes nécessitent une session active (`authMiddleware`).  
Montant maximum par retrait : **1 000 $ CAD**.

---

## GET /api/retraits

Liste les demandes de retrait de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR : tous les retraits avec `?search=`.

**Accès :** Connecté  
**Réponses :** `200` liste · `401` session manquante · `500` erreur serveur

---

## GET /api/retraits/:id

Détail d'un retrait autorisé.

**Accès :** Connecté  
**Réponses :** `200` · `400` ID invalide · `403` accès refusé · `404` introuvable · `500` erreur

---

## POST /api/retraits

Soumet une demande de retrait en espèces.

**Accès :** UTILISATEUR, ADMIN  
**Body :**
```json
{
  "compte_id": 5,
  "montant": 200.00,
  "description": "Dépenses personnelles"
}
```
**Réponse 201 :**
```json
{ "message": "Demande de retrait soumise", "id": 8 }
```
**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Demande soumise |
| 400  | Montant invalide (max 1 000 $) / solde insuffisant |
| 403  | Compte non autorisé |
| 404  | Compte introuvable |
| 500  | Erreur serveur |

---

## PATCH /api/retraits/:id/approuver

Approuve un retrait en attente. Débite immédiatement le compte et crée une transaction `RETRAIT`.

**Accès :** MODERATEUR, ADMIN  
**Réponses :** `200` · `400` retrait déjà traité · `403` accès refusé · `404` introuvable · `500` erreur

---

## PATCH /api/retraits/:id/rejeter

Rejette une demande de retrait.

**Accès :** MODERATEUR, ADMIN  
**Body :** `{ "motif": "Compte insuffisamment approvisionné" }` (optionnel)  
**Réponses :** `200` · `400` retrait déjà traité · `403` accès refusé · `404` introuvable · `500` erreur
