# Documentation API — Factures

Toutes les routes nécessitent une session active (`authMiddleware`).

---

## GET /api/factures

Liste les factures de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR : toutes les factures avec `?search=`.

**Accès :** Connecté  
**Réponse 200 :**
```json
{
  "data": [
    {
      "id": 1,
      "client_id": 1,
      "fournisseur": "Hydro-Québec",
      "montant": 95.50,
      "date_echeance": "2026-03-01T00:00:00.000Z",
      "statut": "EN_ATTENTE",
      "description": "Facture électricité"
    }
  ]
}
```
**Réponses :** `200` · `401` session manquante · `500` erreur serveur

---

## POST /api/factures/:id/payer

Paie une facture depuis un compte autorisé. Débite le compte et crée une transaction `PAIEMENT`.

**Accès :** UTILISATEUR, ADMIN  
**Body :** `{ "compte_id": 5 }`  
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Facture payée |
| 400  | Facture déjà payée / solde insuffisant |
| 403  | Compte non autorisé |
| 404  | Facture ou compte introuvable |
| 500  | Erreur serveur |

---

## POST /api/factures

Crée une nouvelle facture pour un client.

**Accès :** ADMIN  
**Body :**
```json
{
  "client_id": 1,
  "fournisseur": "Vidéotron",
  "montant": 75.00,
  "date_echeance": "2026-04-01",
  "description": "Facture internet"
}
```
**Réponses :** `201` créée · `400` champs manquants · `403` accès refusé · `404` client introuvable · `500` erreur
