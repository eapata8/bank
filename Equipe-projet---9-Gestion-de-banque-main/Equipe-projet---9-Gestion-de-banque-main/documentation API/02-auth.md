# Documentation API — Authentification

Toutes les routes d'authentification sont publiques sauf `/me` et `/logout`.  
Les sessions sont stockées en MySQL via `express-mysql-session`. Durée : 2 heures.

---

## POST /api/auth/register

Création d'un compte client.

**Accès :** Public  
**Body :**
```json
{
  "email": "nouvel@utilisateur.local",
  "motDePasse": "MonMotDePasse1!",
  "prenom": "Jean",
  "nom": "Tremblay"
}
```
**Réponses :**
| Code | Description |
|------|-------------|
| 201  | Compte créé |
| 400  | Champs manquants |
| 409  | Email déjà utilisé |

---

## POST /api/auth/login

Connexion et création de session.

**Accès :** Public  
**Body :**
```json
{ "email": "user@Leon.local", "motDePasse": "Demo123!" }
```
**Réponse 200 :**
```json
{
  "message": "Connecte",
  "user": { "id": 1, "email": "...", "role": "UTILISATEUR", "prenom": "...", "nom": "..." }
}
```
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Connexion réussie |
| 400  | Champs manquants |
| 401  | Identifiants invalides |

---

## GET /api/auth/me

Retourne l'utilisateur de la session courante.

**Accès :** Session active  
**Réponse 200 :**
```json
{ "user": { "id": 1, "email": "...", "role": "UTILISATEUR", "prenom": "...", "nom": "..." } }
```
**Réponses :**
| Code | Description |
|------|-------------|
| 200  | Utilisateur retourné |
| 401  | Aucune session active |

---

## POST /api/auth/logout

Détruit la session et efface le cookie `sid`.

**Accès :** Session active  
**Réponse 200 :**
```json
{ "message": "Deconnecte" }
```
