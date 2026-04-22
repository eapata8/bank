# Documentation API — Demandes de produits financiers

Catalogue de quatre produits que le client peut demander : `CARTE_VISA`, `CARTE_MASTERCARD`, `COMPTE_CHEQUES`, `COMPTE_EPARGNE`. Lors de l'approbation par un admin/modérateur, le produit correspondant (carte de crédit ou compte bancaire) est automatiquement créé.

Toutes les routes exigent `requireAuth`. L'approbation / refus nécessite `requireElevated` (ADMIN ou MODERATEUR).

Préfixe : `/api/demandes-produits`

---

## GET /api/demandes-produits
Liste les demandes visibles par l'utilisateur courant.
- **UTILISATEUR** : uniquement les demandes de ses propres clients (JOIN `utilisateurs_clients`).
- **ADMIN / MODERATEUR** : toutes les demandes, enrichies avec les infos client et le nom du traitant.

**Réponse 200** : `{ data: DemandeProduit[] }`

---

## GET /api/demandes-produits/:id
Retourne une demande spécifique (infos client + traitant via LEFT JOIN).

**Réponses** : `200 { data }` · `400` id invalide · `404` introuvable · `500`

---

## POST /api/demandes-produits
Soumet une nouvelle demande pour le client lié à l'utilisateur connecté.

**Accès** : `requireNotModerator` — utilisateurs standards et admins ayant un profil client associé.

**Body** :
```json
{
  "type_produit": "CARTE_VISA",
  "notes": "Optionnel — précisions client",
  "limite_credit": 5000
}
```

**Validation** (`validateCreateDemandeProduit`) :
- `type_produit` : obligatoire, un de `CARTE_VISA | CARTE_MASTERCARD | COMPTE_CHEQUES | COMPTE_EPARGNE`
- `limite_credit` : optionnel, nombre positif si fourni

**Règles métier** :
- L'utilisateur doit avoir un profil client associé (sinon `403`)
- Une seule demande `EN_ATTENTE` par `(client_id, type_produit)` à la fois (sinon `409`)

**Auto-validation** : si `utilisateurs.auto_validation = 1` pour l'utilisateur connecté, la demande est immédiatement approuvée (même transaction de provisionnement que `PATCH /:id/approuver`) et la réponse inclut `auto_valide: true`. Deux entrées d'audit sont écrites : `CREATE_DEMANDE_PRODUIT` puis `APPROUVER_DEMANDE_PRODUIT` (détails : « auto-approuvée (auto_validation) »).

**Réponses** :
- `201 { message, id }` — soumission normale (en attente de modération)
- `201 { message, id, auto_valide: true }` — auto-approuvée, produit déjà créé
- `400` validation · `403` aucun client lié · `409` doublon · `500`

---

## PATCH /api/demandes-produits/:id/approuver
Approuve une demande `EN_ATTENTE` et provisionne automatiquement le produit.

**Accès** : `requireElevated`

**Provisionnement** (transaction atomique) :
- `CARTE_VISA` → INSERT dans `cartes_credit` avec préfixe `4`, limite par défaut 5 000 $, statut `ACTIVE`, expiration à 3 ans
- `CARTE_MASTERCARD` → INSERT dans `cartes_credit` avec préfixe `5`
- `COMPTE_CHEQUES` → INSERT dans `comptes` avec `type_compte=CHEQUES`, solde 0, devise CAD, institution 621
- `COMPTE_EPARGNE` → INSERT dans `comptes` avec `type_compte=EPARGNE`

Si l'INSERT échoue → ROLLBACK de la transaction, la demande reste `EN_ATTENTE`.

**Réponses** : `200 { message, id }` · `400` id invalide ou statut ≠ EN_ATTENTE · `404` · `500`

---

## PATCH /api/demandes-produits/:id/refuser
Refuse une demande `EN_ATTENTE`. Aucun produit n'est créé.

**Accès** : `requireElevated`

**Body** :
```json
{ "notes": "Motif optionnel du refus" }
```

**Réponses** : `200 { message, id }` · `400` · `404` · `500`

---

## DELETE /api/demandes-produits/:id
Annule (supprime) une demande `EN_ATTENTE`.

**Accès** : `requireAuth` — le propriétaire de la demande, ou un ADMIN/MODERATEUR.

**Règles d'autorisation** :
- ADMIN / MODERATEUR : peut annuler n'importe quelle demande `EN_ATTENTE`
- UTILISATEUR : seulement ses propres demandes (vérification via `isDemandeOwner` sur `utilisateurs_clients`)

**Effet** : `DELETE FROM demandes_produits WHERE id = ? AND statut = 'EN_ATTENTE'`. La ligne est supprimée définitivement ; le client peut soumettre une nouvelle demande immédiatement.

**Réponses** : `200 { message, id }` · `400` statut ≠ EN_ATTENTE ou déjà supprimée · `403` non-propriétaire · `404` · `500`

---

## Audit

Chaque action est tracée dans `audit_log` :

| Action | Déclencheur |
|--------|-------------|
| `CREATE_DEMANDE_PRODUIT` | Soumission par un client |
| `APPROUVER_DEMANDE_PRODUIT` | Approbation + provisionnement |
| `REFUSER_DEMANDE_PRODUIT` | Refus administratif |
| `ANNULER_DEMANDE_PRODUIT` | Annulation (client ou admin) |
