# Authentification et gestion de session

## Objectif

Permettre l'authentification sécurisée des utilisateurs (`UTILISATEUR`, `MODERATEUR`, `ADMIN`) via une session serveur persistée en base MySQL. Contrôler l'accès aux routes API selon le rôle.

## Stack technique

| Composant | Technologie | Détail |
|-----------|-------------|--------|
| Sessions | `express-session` + `express-mysql-session` | Store MySQL, expiration 2 heures |
| Mots de passe | `bcryptjs` | 10 rounds de salt |
| Cookie | `sid` | `httpOnly: true`, `sameSite: lax` |
| Table sessions | `sessions` (auto-gérée) | Ne pas modifier manuellement |

## Rôles

Trois rôles existent : `UTILISATEUR`, `MODERATEUR`, `ADMIN`. Voir `admin.md` pour la matrice complète des droits par fonctionnalité.

## Flow d'inscription

```
POST /api/auth/register { email, password, prenom, nom }
  → Vérification email unique
  → bcrypt.hash(password, 10)
  → INSERT utilisateurs (role: UTILISATEUR)
  → 201 { id, email, role }
```

## Flow de connexion

```
POST /api/auth/login { email, password }
  → SELECT utilisateur WHERE email = ?
  → bcrypt.compare(password, hash)
  → req.session.userId = id
  → req.session.userRole = role
  → INSERT audit_logs (action: LOGIN)
  → 200 { id, email, role, prenom, nom, auto_validation }
```

## Flow de déconnexion

```
POST /api/auth/logout
  → req.session.destroy()
  → Suppression du cookie sid
  → INSERT audit_logs (action: LOGOUT)
  → 200 { message }
```

## Middlewares d'authentification

### `requireAuth`
Vérifie que `req.session.userId` est défini. Retourne `401` sinon. Appliqué sur toutes les routes protégées.

### `requireElevated`
Vérifie que le rôle est `MODERATEUR` ou `ADMIN`. Retourne `403` sinon. Appliqué sur les routes de création et d'approbation.

### `requireAdmin`
Vérifie que le rôle est `ADMIN`. Retourne `403` sinon. Appliqué sur les routes d'administration critique (suppression, ajustement de solde, etc.).

```
Requête → requireAuth → requireElevated → Controller
                      ↓ non MODERATEUR/ADMIN
                     403 Forbidden

Requête → requireAuth → requireAdmin → Controller
                     ↓ non ADMIN
                    403 Forbidden
```

## Flag `auto_validation`

| Valeur | Comportement |
|--------|-------------|
| `0` (défaut) | Dépôts et retraits passent en `EN_ATTENTE` — approbation manuelle requise |
| `1` | Approbation immédiate — compte crédité/débité sans intervention humaine |

Géré exclusivement par l'ADMIN via `PATCH /api/admin/utilisateurs/:id/auto-validation`.

## Modèle de données

Voir `base-de-donnees.md` pour le schéma complet de la table `utilisateurs`.

## Sécurité

- L'inscription publique est limitée au rôle `UTILISATEUR` — impossible de s'auto-assigner `ADMIN` ou `MODERATEUR`
- Le hash bcrypt n'est jamais retourné dans les réponses API
- Un `ADMIN` ne peut pas modifier son propre rôle (`403`)
- Le premier admin (id le plus bas parmi les `ADMIN`) est protégé contre la suppression
- Les sessions expirent après 2 heures (`maxAge: 7200000 ms`)

## Audit

| Action | Déclencheur |
|--------|-------------|
| `LOGIN` | Connexion réussie |
| `LOGOUT` | Déconnexion |
| `CREATE_MODERATEUR` | Création d'un modérateur |
| `ADMIN_CREATE_ADMIN` | Création d'un administrateur |
| `ADMIN_DELETE_USER` | Suppression d'un utilisateur |
| `ADMIN_CHANGE_USER_ROLE` | Changement de rôle |
| `ADMIN_RESET_PASSWORD` | Réinitialisation de mot de passe |

## Comptes de démonstration

Disponibles après `npm run db:init` :

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| ADMIN | admin@Leon.local | Demo123! |
| MODERATEUR | mod1@Leon.local | Demo123! |
| MODERATEUR | mod2@Leon.local | Demo123! |
| UTILISATEUR | user@Leon.local | Demo123! |
| UTILISATEUR | sarah.clark@Leon.local | Demo123! |
| UTILISATEUR | marc.roy@Leon.local | Demo123! |
| UTILISATEUR | lina.nguyen@Leon.local | Demo123! |
| UTILISATEUR | adam.fournier@Leon.local | Demo123! |
| UTILISATEUR | olivier.tremblay@Leon.local | Demo123! |
| UTILISATEUR | sophie.bergeron@Leon.local | Demo123! |
| UTILISATEUR | thomas.girard@Leon.local | Demo123! |
| UTILISATEUR | isabelle.morin@Leon.local | Demo123! |
| UTILISATEUR | julien.cote@Leon.local | Demo123! |
| UTILISATEUR | camille.lefebvre@Leon.local | Demo123! |
| UTILISATEUR | alexandre.gagne@Leon.local | Demo123! |
| UTILISATEUR | jade.bouchard@Leon.local | Demo123! |
| UTILISATEUR | raphael.pelletier@Leon.local | Demo123! |
| UTILISATEUR | lea.caron@Leon.local | Demo123! |
| UTILISATEUR | noah.dubois@Leon.local | Demo123! |
| UTILISATEUR | rosalie.desjardins@Leon.local | Demo123! |
| UTILISATEUR | samuel.leblanc@Leon.local | Demo123! |
| UTILISATEUR | chloe.pepin@Leon.local | Demo123! |
| UTILISATEUR | vincent.lapointe@Leon.local | Demo123! |

> 20 utilisateurs standards au total. Les soldes des comptes sont cohérents avec l'historique des transactions (invariant vérifié : `comptes.solde = Σ transactions.montant WHERE statut = 'TERMINEE'`).

## Référence API

Voir `documentation API/auth.md`.
