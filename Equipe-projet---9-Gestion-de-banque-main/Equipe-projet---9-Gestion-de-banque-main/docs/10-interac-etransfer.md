# Interac e-Transfert

## Vue d'ensemble

Implémente les virements Interac par courriel dans Leon Bank. Reproduit les règles d'Interac Canada : limites glissantes 24h/7j/30j, mot de passe partagé hors-canal, auto-dépôt en une seule étape, expiration automatique, et gestion des limites personnalisées par client.

## Limites réglementaires

| Période | Limite globale |
|---------|----------------|
| 24 heures | 3 000 $ CAD |
| 7 jours | 10 000 $ CAD |
| 30 jours | 20 000 $ CAD |

Les limites sont calculées sur une **fenêtre glissante** (pas la journée ou le mois calendaire). Un admin peut fixer des limites inférieures pour un client spécifique. `null` sur une limite = retour à la valeur globale.

Seuls les transferts avec statut `ACCEPTEE` comptent dans les cumuls. Les transferts `ANNULEE` et `EXPIREE` ne sont pas comptabilisés.

## Machine d'états — Transfert

```
Envoi sans auto-dépôt → EN_ATTENTE → ACCEPTEE  (destinataire réclame avec bon mot de passe)
                                   → ANNULEE   (expéditeur annule)
                                   → EXPIREE   (30 jours dépassés — lazy)

Envoi avec auto-dépôt actif → ACCEPTEE immédiatement (sans mot de passe)
```

## Expiration (comportement lazy)

Il n'y a pas de tâche planifiée (cron) pour expirer les transferts. L'expiration est **déclenchée à la lecture** : quand quelqu'un consulte un transfert EN_ATTENTE dont la `date_expiration` est dépassée, le système le passe à `EXPIREE` et rembourse le compte source au même moment. Ce comportement évite toute complexité d'infrastructure.

## Annulation

L'expéditeur peut annuler un transfert tant qu'il est `EN_ATTENTE`. L'annulation :
1. Passe le statut à `ANNULEE`
2. Recrédite immédiatement le compte source du montant transféré
3. Crée une transaction de type `INTERAC_CREDIT` sur le compte source

## Flux auto-dépôt (1 étape)

L'activation de l'auto-dépôt se fait en une seule requête. L'utilisateur fournit son email Interac et son compte de réception ; le profil est immédiatement activé (`statut = ACTIVE`).

- L'utilisateur soumet son email et sélectionne un compte de réception
- Le profil est directement activé en base de données
- Tout virement envoyé à cet email est désormais accepté immédiatement, sans mot de passe

**Règle de sécurité :** un email Interac ne peut appartenir qu'à un seul utilisateur actif. La vérification est effectuée avant toute écriture.

## Règles mot de passe

| Règle | Détail |
|-------|--------|
| Longueur | Entre 3 et 25 caractères |
| Contenu | Ne peut pas être l'email du destinataire |
| Contenu | Ne peut pas être le montant (ex: "150" si montant = 150 $) |
| Stockage | Hash bcrypt 10 rounds — jamais retourné dans les réponses |
| Obligatoire si | L'auto-dépôt du destinataire n'est pas actif |

## Sécurité

| Risque | Mitigation |
|--------|-----------|
| Envoi à soi-même | Email destinataire vérifié ≠ email de session |
| Interception d'email auto-dépôt | Vérification unicité avant activation |
| Brute-force mot de passe | bcrypt 10 rounds |
| Dépassement de limite | Cumul 24h/7j/30j calculé en DB avant débit |
| Réclamer le transfert d'autrui | Email de session doit correspondre à `email_destinataire` |
| Fuite hash | Hash non inclus dans aucune réponse API |

## Données de démonstration

Le seed insère :
- Plusieurs transferts `EN_ATTENTE` (réclamables par les utilisateurs de démo)
- Des transferts `ACCEPTEE` (historique)
- Des transferts `ANNULEE` (historique)
- Un profil auto-dépôt actif sur un compte de démo

## Audit

| Action | Déclencheur |
|--------|-------------|
| `INTERAC_ENVOI` | Envoi d'un virement |
| `INTERAC_RECLAMATION` | Réclamation réussie |
| `INTERAC_ANNULATION` | Annulation par l'expéditeur |
| `INTERAC_EXPIRATION` | Expiration détectée à la lecture |
| `INTERAC_AUTODEPOSIT_ACTIVE` | Activation auto-dépôt |
| `INTERAC_AUTODEPOSIT_DESACTIVE` | Désactivation par le client |
| `ADMIN_INTERAC_LIMITES_MODIFIEES` | Limites modifiées par un admin |
| `ADMIN_INTERAC_AUTODEPOSIT_FORCE` | Activation forcée par un admin |
| `ADMIN_INTERAC_AUTODEPOSIT_DESACTIVE` | Désactivation par un admin |

## Bénéficiaires sauvegardés

Un bénéficiaire est un destinataire fréquent (alias + courriel) qu'un utilisateur enregistre pour ne pas ressaisir son adresse à chaque envoi Interac.

### Comportement
- Dans l'onglet **Envoyer**, si des bénéficiaires existent, un sélecteur apparaît au-dessus du champ courriel. Sélectionner un bénéficiaire pré-remplit le courriel automatiquement.
- Le champ courriel reste toujours éditable (la sélection est un raccourci, pas une obligation).
- L'onglet **Bénéficiaires** liste, ajoute et supprime les bénéficiaires.
- Contrainte : un même courriel ne peut être enregistré qu'une seule fois par utilisateur → `409` si doublon.

### Validations
- `alias` : obligatoire, maximum 100 caractères
- `email_interac` : obligatoire, format email valide

### Table SQL : `interac_beneficiaires`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT PK | Identifiant |
| `utilisateur_id` | INT FK → utilisateurs | Propriétaire du bénéficiaire |
| `alias` | VARCHAR(100) | Nom court (ex : « Maman », « Loyer Marc ») |
| `email_interac` | VARCHAR(190) | Courriel Interac normalisé en minuscules |
| `cree_le` | TIMESTAMP | Date d'ajout |

Contrainte `UNIQUE(utilisateur_id, email_interac)` : doublon → erreur MySQL 1062 → HTTP 409.

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `server/controllers/interac.controller.js` | Logique métier complète (transferts, autodeposit, limites) |
| `server/controllers/beneficiaires.controller.js` | Logique métier bénéficiaires |
| `server/data/interac.data.js` | Requêtes SQL (transferts, autodeposit, limites, cumuls) |
| `server/data/beneficiaires.data.js` | Requêtes SQL bénéficiaires |
| `server/routes/interac.routes.js` | Routes utilisateur + routes admin |
| `server/routes/beneficiaires.routes.js` | Routes bénéficiaires (`/api/beneficiaires`) |
| `database/migration_interac.sql` | Migration : tables Interac + colonnes limites sur `utilisateurs` |
| `database/migration_beneficiaires.sql` | Migration : table `interac_beneficiaires` |
| `frontend/src/app/dashboard/interac/page.tsx` | Interface (onglets Envoyer / À réclamer / Auto-dépôt / Bénéficiaires) |

## Référence API

Voir `documentation API/07-interac.md`.
