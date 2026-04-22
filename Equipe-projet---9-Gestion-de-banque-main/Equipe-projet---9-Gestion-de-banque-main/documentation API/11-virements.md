# Documentation API — Virements

Toutes les routes nécessitent une session active (`authMiddleware`).

---

## GET /api/virements

Liste les virements de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR : tous les virements avec filtre `?search=`.

**Accès :** Connecté  
**Réponse 200 :**
```json
{
  "data": [
    {
      "id": 15,
      "compte_source_id": 10,
      "compte_destination_id": 22,
      "montant": 250.0,
      "description": "Loyer",
      "date_virement": "2026-02-25T15:20:00.000Z",
      "statut": "ACCEPTE",
      "compte_source_numero": "4821 3390 4521",
      "compte_destination_numero": "6214 8820 1104",
      "compte_source_type": "CHEQUES",
      "compte_destination_type": "CHEQUES",
      "client_source_nom": "Jean Demo",
      "client_destination_nom": "Sarah Clark"
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

## POST /api/virements

Crée un virement interne entre deux comptes connus de l'utilisateur.

**Accès :** Connecté  
**Body :**
```json
{
  "compte_source_id": 10,
  "compte_destination_id": 22,
  "montant": 250.0,
  "description": "Loyer"
}
```
**Réponse 201 :**
```json
{ "message": "Virement cree avec succes", "id": 16 }
```
**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Virement créé |
| 400  | Champs manquants / montant invalide / comptes identiques / solde insuffisant |
| 401  | Aucune session |
| 403  | Compte non autorisé |
| 404  | Compte destination inexistant |
| 500  | Erreur serveur |

---

## POST /api/virements/externe

Crée un virement vers un compte identifié par ses coordonnées bancaires.

**Accès :** Connecté  
**Body :**
```json
{
  "compte_source_id": 10,
  "numero_compte_dest": "6214 8820 1104",
  "numero_institution_dest": "621",
  "numero_transit_dest": "23815",
  "swift_bic_dest": "NXBKCA2TXXX",
  "montant": 150.0,
  "description": "Remboursement loyer"
}
```
Champs obligatoires : `compte_source_id`, `numero_compte_dest`, `numero_institution_dest`, `numero_transit_dest`, `montant`.

**Réponse 201 :**
```json
{ "message": "Virement externe effectue avec succes", "id": 17 }
```
**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Virement créé |
| 400  | Champs manquants / montant invalide / comptes identiques / solde insuffisant |
| 401  | Aucune session |
| 403  | Compte source non autorisé |
| 404  | Coordonnées bancaires introuvables |
| 500  | Erreur serveur |
