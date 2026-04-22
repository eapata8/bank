# Documentation API — Interac e-Transfert

Toutes les routes nécessitent une session active (`authMiddleware`).  
Limites globales : 3 000 $ / 24h · 10 000 $ / 7 jours · 20 000 $ / 30 jours (fenêtre glissante).

---

## Routes utilisateur

### GET /api/interac

Historique des transferts de l'utilisateur connecté.  
Pour ADMIN/MODERATEUR : tous les transferts avec `?q=` pour filtrer.

**Accès :** Connecté  
**Réponses :** `200` liste · `500` erreur serveur

---

### POST /api/interac/envoyer

Envoie un virement Interac par courriel.

**Accès :** UTILISATEUR  
**Body :**
```json
{
  "compte_source_id": 5,
  "email_destinataire": "destinataire@example.com",
  "montant": 150.00,
  "mot_de_passe": "Secret123",
  "description": "Remboursement"
}
```
Si le destinataire a l'auto-dépôt actif, `mot_de_passe` n'est pas requis et le transfert est `ACCEPTEE` immédiatement.

**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Transfert créé |
| 400  | Champs manquants / montant invalide / envoi à soi-même / limite atteinte / mot de passe invalide |
| 403  | Compte source non autorisé |
| 500  | Erreur serveur |

---

### GET /api/interac/a-reclamer

Transferts en attente de réclamation destinés à l'email de l'utilisateur.

**Accès :** UTILISATEUR  
**Réponses :** `200` liste · `500` erreur serveur

---

### POST /api/interac/:id/reclamer

Réclame un transfert en attente.

**Accès :** UTILISATEUR  
**Body :**
```json
{
  "compte_destination_id": 7,
  "mot_de_passe": "Secret123"
}
```
`mot_de_passe` n'est pas requis si le transfert n'a pas de mot de passe (auto-dépôt).

**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Transfert réclamé |
| 400  | Mot de passe incorrect / transfert expiré / déjà traité |
| 403  | Email non autorisé / compte non autorisé |
| 404  | Transfert introuvable |
| 500  | Erreur serveur |

---

### DELETE /api/interac/:id

Annule un transfert `EN_ATTENTE` (expéditeur uniquement). Rembourse le compte source.

**Accès :** UTILISATEUR  
**Réponses :** `200` · `400` transfert non annulable · `403` non autorisé · `404` introuvable · `500` erreur

---

### GET /api/interac/autodeposit

Profil d'auto-dépôt de l'utilisateur connecté.

**Accès :** UTILISATEUR  
**Réponses :** `200` profil ou `null` · `500` erreur

---

### POST /api/interac/autodeposit

Active l'auto-dépôt directement en une seule étape. Le profil est immédiatement mis à l'état `ACTIVE`.

**Accès :** UTILISATEUR  
**Body :** `{ "email_interac": "mon@email.com", "compte_depot_id": 5 }`  
**Réponse 200 :**
```json
{
  "message": "Auto-depot active avec succes",
  "data": { "id": 1, "email_interac": "mon@email.com", "statut": "ACTIVE" }
}
```
**Réponses :** `200` activé · `400` email déjà utilisé · `403` compte non autorisé · `500` erreur

---

### DELETE /api/interac/autodeposit

Désactive l'auto-dépôt de l'utilisateur.

**Accès :** UTILISATEUR  
**Réponses :** `200` désactivé · `404` aucun profil · `500` erreur

---

### GET /api/interac/limites

Retourne les limites Interac effectives de l'utilisateur (globales ou personnalisées).

**Accès :** UTILISATEUR  
**Réponse 200 :**
```json
{
  "data": {
    "limite_24h": 3000,
    "limite_7j": 10000,
    "limite_30j": 20000,
    "perso_24h": false,
    "perso_7j": false,
    "perso_30j": false
  }
}
```
`perso_*` = `true` si la limite est personnalisée par l'admin (sinon, valeur globale appliquée).

---

## Routes administration

Voir `admin.md` pour les routes `/api/interac/admin/clients/:clientId/...`

---

# Documentation API — Bénéficiaires Interac

Routes sous `/api/beneficiaires`. Requièrent une session active et le rôle `UTILISATEUR` ou `ADMIN` (MODERATEUR bloqué).

---

### GET /api/beneficiaires

Retourne la liste des bénéficiaires sauvegardés de l'utilisateur connecté, triés par alias.

**Accès :** UTILISATEUR, ADMIN  
**Réponse 200 :**
```json
{
  "data": [
    {
      "id": 1,
      "utilisateur_id": 5,
      "alias": "Maman",
      "email_interac": "maman@exemple.com",
      "cree_le": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST /api/beneficiaires

Ajoute un nouveau bénéficiaire pour l'utilisateur connecté.

**Accès :** UTILISATEUR, ADMIN  
**Body :**
```json
{
  "alias": "Maman",
  "email_interac": "maman@exemple.com"
}
```

**Réponses :**
- `201` — `{ "message": "Bénéficiaire ajouté avec succès", "id": 12 }`
- `400` — Alias manquant / dépasse 100 chars / courriel invalide
- `409` — Ce courriel est déjà dans vos bénéficiaires

**Validations :**
- `alias` : obligatoire, max 100 caractères
- `email_interac` : format email valide (regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Le courriel est normalisé en minuscules avant insertion

---

### DELETE /api/beneficiaires/:id

Supprime un bénéficiaire appartenant à l'utilisateur connecté.

**Accès :** UTILISATEUR, ADMIN  
**Réponses :**
- `200` — `{ "message": "Bénéficiaire supprimé" }`
- `403` — Le bénéficiaire appartient à un autre utilisateur
- `404` — Bénéficiaire introuvable
