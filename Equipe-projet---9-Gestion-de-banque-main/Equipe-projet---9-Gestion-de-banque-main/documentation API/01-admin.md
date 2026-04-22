# Documentation API — Administration

Toutes les routes nécessitent `authMiddleware` + `requireAdmin` ou `requireElevated` selon l'action.

---

## Gestion des utilisateurs

### GET /api/admin/utilisateurs
Liste tous les utilisateurs du système.  
**Accès :** ADMIN, MODERATEUR

### POST /api/admin/utilisateurs/moderateur
Crée un nouveau compte modérateur.  
**Accès :** ADMIN, MODERATEUR  
**Body :** `{ "email", "motDePasse", "prenom", "nom" }`

### POST /api/admin/utilisateurs/admin
Crée un compte administrateur.  
**Accès :** ADMIN  
**Body :** `{ "email", "motDePasse", "prenom", "nom" }`

### PATCH /api/admin/utilisateurs/:id/role
Modifie le rôle d'un utilisateur.  
**Accès :** ADMIN (tous rôles) · MODERATEUR (UTILISATEUR/MODERATEUR uniquement)  
**Body :** `{ "role": "MODERATEUR" }`  
**Réponses :** `200` succès · `400` rôle invalide · `403` auto-modification ou permission insuffisante · `404` utilisateur introuvable

### DELETE /api/admin/utilisateurs/:id
Supprime un utilisateur. Le premier ADMIN (plus petit id) est protégé.  
**Accès :** ADMIN  
**Réponses :** `200` supprimé · `403` admin protégé · `404` introuvable

### PATCH /api/admin/utilisateurs/:id/password
Réinitialise le mot de passe d'un utilisateur.  
**Accès :** ADMIN  
**Body :** `{ "nouveauMotDePasse": "..." }`

### PATCH /api/admin/utilisateurs/:id/auto-validation
Active ou désactive l'auto-validation des dépôts/retraits.  
**Accès :** ADMIN  
**Body :** `{ "auto_validation": 1 }`

---

## Gestion des comptes

### PATCH /api/admin/comptes/:id/solde
Ajuste le solde d'un compte (montant positif = crédit, négatif = débit).  
**Accès :** ADMIN  
**Body :** `{ "montant": 500, "type": "DEPOT", "motif": "Correction" }`  
**Réponses :** `200` · `400` montant nul · `404` compte introuvable

### PATCH /api/admin/comptes/:id/statut
Bloque ou débloque un compte.  
**Accès :** ADMIN  
**Body :** `{ "est_actif": 0 }`

### PATCH /api/admin/comptes/:id/type
Change le type d'un compte (CHEQUES / EPARGNE / CREDIT).  
**Accès :** ADMIN  
**Body :** `{ "type_compte": "EPARGNE" }`

---

## Gestion des transactions

### POST /api/admin/transactions
Insère une transaction manuelle sur un compte.  
**Accès :** ADMIN  
**Body :** `{ "compte_id", "montant", "type_transaction", "description", "ajuster_solde" }`

### DELETE /api/admin/transactions/:txId
Supprime une transaction. Si c'est un virement, la transaction jumelée et les deux soldes sont reversés automatiquement.  
**Accès :** ADMIN

---

## Gestion des virements

### POST /api/admin/virements
Insère un virement entre deux comptes identifiés par coordonnées bancaires.  
**Accès :** ADMIN  
**Body :**
```json
{
  "numero_compte_source": "...", "numero_institution_source": "621", "numero_transit_source": "10482",
  "numero_compte_dest": "...", "numero_institution_dest": "621", "numero_transit_dest": "23815",
  "montant": 200, "statut": "ACCEPTE", "description": "...", "ajuster_soldes": true
}
```

### POST /api/admin/virements/force
Transfert forcé depuis un compte (par ID) vers un compte (par coordonnées), sans vérification de solde.  
**Accès :** ADMIN  
**Body :** `{ "compte_source_id", "numero_compte_dest", "numero_institution_dest", "numero_transit_dest", "montant", "description" }`

### DELETE /api/admin/virements/:id
Supprime un virement avec reversal optionnel des soldes.  
**Accès :** ADMIN

---

## Clients

### GET /api/clients
Liste les clients. ADMIN/MODERATEUR voient tous les clients avec `?search=`.  
**Accès :** Connecté

### POST /api/clients
Crée un profil client et le lie à l'utilisateur connecté.  
**Accès :** MODERATEUR, ADMIN  
**Body :** `{ "prenom", "nom", "email_fictif", "telephone", "adresse", "ville", "province", "code_postal" }`

---

## Gestion Interac (admin)

### GET /api/interac/admin/clients/:clientId/transferts
Liste tous les transferts Interac d'un client.  
**Accès :** ADMIN, MODERATEUR

### GET /api/interac/admin/clients/:clientId/stats
Statistiques Interac (total envoyé 24h/7j/30j).  
**Accès :** ADMIN, MODERATEUR

### GET /api/interac/admin/clients/:clientId/autodeposit
Profil d'auto-dépôt d'un client.  
**Accès :** ADMIN, MODERATEUR

### POST /api/interac/admin/clients/:clientId/autodeposit/forcer
Force l'activation de l'auto-dépôt pour un client.  
**Accès :** ADMIN  
**Body :** `{ "email_interac", "compte_depot_id" }`

### DELETE /api/interac/admin/clients/:clientId/autodeposit
Désactive l'auto-dépôt d'un client.  
**Accès :** ADMIN

### GET /api/interac/admin/clients/:clientId/limites
Limites Interac personnalisées d'un client.  
**Accès :** ADMIN, MODERATEUR

### PATCH /api/interac/admin/clients/:clientId/limites
Modifie les limites Interac d'un client. `null` = revenir aux limites globales.  
**Accès :** ADMIN  
**Body :** `{ "limite_24h": 2000, "limite_7j": null, "limite_30j": null }`

---

## Export CSV

Encodé UTF-8 avec BOM (compatible Excel).

| Route | Accès | Description |
|-------|-------|-------------|
| `GET /api/export/audit` | ADMIN | Journal d'audit (5 000 lignes max) |
| `GET /api/export/utilisateurs` | ADMIN, MODERATEUR | Liste des utilisateurs |
| `GET /api/export/clients` | ADMIN, MODERATEUR | Liste des clients |
| `GET /api/export/virements` | Connecté | Virements filtrés selon le rôle |
| `GET /api/export/transactions/:compteId` | Connecté | Transactions d'un compte autorisé |
