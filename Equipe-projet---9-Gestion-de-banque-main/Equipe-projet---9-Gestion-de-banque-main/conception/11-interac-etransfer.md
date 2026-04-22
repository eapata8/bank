# Conception — Interac e-Transfer

## Description

Le module Interac e-Transfer permet aux clients d'envoyer et de recevoir de l'argent par courriel. La fonctionnalité reproduit les règles d'Interac Canada : limites glissantes 24h/7j/30j, mot de passe partagé hors-canal, auto-dépôt en une seule étape, expiration automatique des transferts non réclamés, et gestion administrative des limites personnalisées par client.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Interac e-Transfer
        UC1[Envoyer un virement Interac]
        UC2[Réclamer un virement reçu]
        UC3[Annuler un virement envoyé]
        UC4[Consulter l'historique]
        UC5[Activer l'auto-dépôt]
        UC7[Désactiver l'auto-dépôt]
        UC8[Consulter ses limites effectives]
        UC9[Voir historique client - admin]
        UC10[Voir stats Interac client - admin]
        UC11[Gérer auto-dépôt client - admin]
        UC12[Modifier limites client - admin]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    U --> UC4
    U --> UC5
    U --> UC7
    U --> UC8
    ADM[Admin] --> UC9
    ADM --> UC10
    ADM --> UC11
    ADM --> UC12
```

---

## Diagramme de classes

```mermaid
classDiagram
    class InteracTransfert {
        -int id
        -int expediteurId
        -int compteSourceId
        -String emailDestinataire
        -double montant
        -String description
        -String motDePasseHash
        -StatutTransfert statut
        -int compteDestinationId
        -Date dateEnvoi
        -Date dateExpiration
        -Date dateTraitement
    }

    class InteracAutodeposit {
        -int id
        -int utilisateurId
        -String emailInterac
        -int compteDepotId
        -StatutAutodeposit statut
    }

    class Utilisateur {
        -int id
        -String email
        -double interacLimite24h
        -double interacLimite7j
        -double interacLimite30j
    }

    class Compte {
        -int id
        -double solde
        -StatutCompte statut
    }

    class StatutTransfert {
        <<enumeration>>
        EN_ATTENTE
        ACCEPTEE
        ANNULEE
        EXPIREE
    }

    class StatutAutodeposit {
        <<enumeration>>
        EN_ATTENTE
        ACTIVE
    }

    InteracTransfert --> StatutTransfert
    InteracTransfert "0..*" --> "1" Utilisateur : expéditeur
    InteracTransfert "0..*" --> "1" Compte : source
    InteracTransfert "0..*" --> "0..1" Compte : destination
    InteracAutodeposit --> StatutAutodeposit
    InteracAutodeposit "1" --> "1" Utilisateur : appartient à
    InteracAutodeposit "1" --> "1" Compte : compte de dépôt
    Utilisateur --> InteracAutodeposit
```

---

## Diagramme de séquence — Envoi d'un virement

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/interac { compteSourceId, emailDestinataire, montant, motDePasse?, description? }
    API->>API: requireAuth
    API->>DB: SELECT limites personnalisées utilisateur
    API->>DB: SELECT cumul 24h / 7j / 30j (fenêtre glissante)

    alt Limite dépassée
        API-->>C: 400 { error: "Limite Interac dépassée" }
    else Solde insuffisant
        API-->>C: 400 { error: "Solde insuffisant" }
    else Email = expéditeur
        API-->>C: 400 { error: "Impossible de s'envoyer à soi-même" }
    else Valide
        API->>DB: SELECT auto-dépôt actif pour emailDestinataire
        alt Auto-dépôt actif
            API->>DB: UPDATE comptes SET solde = solde - montant (source)
            API->>DB: UPDATE comptes SET solde = solde + montant (destination)
            API->>DB: INSERT interac_transferts (statut: ACCEPTEE)
            API->>DB: INSERT transactions x2
        else Pas d'auto-dépôt
            API->>DB: UPDATE comptes SET solde = solde - montant (source)
            API->>DB: INSERT interac_transferts (statut: EN_ATTENTE, motDePasseHash)
        end
        API->>DB: INSERT audit_log
        API-->>C: 201 { transfert }
    end
```

---

## Diagramme de séquence — Réclamation d'un virement

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/interac/:id/reclamer { compteDestinationId, motDePasse }
    API->>API: requireAuth
    API->>DB: SELECT transfert WHERE id = ?

    alt Transfert introuvable ou pas EN_ATTENTE
        API-->>C: 404 / 400 { error }
    else Email session != emailDestinataire
        API-->>C: 403 { error: "Non autorisé à réclamer" }
    else Expiré (> 30 jours)
        API->>DB: UPDATE statut = EXPIREE, rembourser source
        API-->>C: 400 { error: "Transfert expiré" }
    else Mot de passe incorrect
        API-->>C: 401 { error: "Mot de passe incorrect" }
    else Valide
        API->>DB: UPDATE comptes SET solde = solde + montant (destination)
        API->>DB: UPDATE interac_transferts SET statut = ACCEPTEE
        API->>DB: INSERT transactions x2
        API->>DB: INSERT audit_log
        API-->>C: 200 { message: "Virement réclamé avec succès" }
    end
```

---

## Diagramme de séquence — Activation auto-dépôt (1 étape)

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/interac/autodeposit { emailInterac, compteDepotId }
    API->>DB: Vérifier email non déjà actif pour un autre utilisateur
    alt Email pris
        API-->>C: 400 { error: "Email déjà utilisé" }
    else Compte non autorisé
        API-->>C: 403 { error: "Compte non autorisé" }
    else Valide
        API->>DB: INSERT / UPDATE interac_autodeposit (statut: ACTIVE)
        API->>DB: INSERT audit_log
        API-->>C: 200 { message: "Auto-dépôt activé", data: profil }
    end
```

---

## Flowchart — Validation d'un envoi Interac

```mermaid
flowchart TD
    START([Demande d'envoi]) --> AUTH{Authentifié ?}
    AUTH -- Non --> E401[401 Non autorisé]
    AUTH -- Oui --> SELF{Email = expéditeur ?}
    SELF -- Oui --> E400A[400 Envoi à soi-même interdit]
    SELF -- Non --> LIMITS{Limites 24h / 7j / 30j respectées ?}
    LIMITS -- Non --> E400B[400 Limite dépassée]
    LIMITS -- Oui --> SOLDE{Solde suffisant ?}
    SOLDE -- Non --> E400C[400 Solde insuffisant]
    SOLDE -- Oui --> AUTOD{Auto-dépôt actif pour le destinataire ?}
    AUTOD -- Oui --> INSTANT[Crédit immédiat → statut ACCEPTEE]
    AUTOD -- Non --> MDP{Mot de passe fourni et valide ?}
    MDP -- Non --> E400D[400 Mot de passe requis / invalide]
    MDP -- Oui --> ATTENTE[Débit source → statut EN_ATTENTE]
    INSTANT --> SUCCESS([201 Succès])
    ATTENTE --> SUCCESS
```

---

## Schéma des tables

### Table `interac_transferts`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| expediteur_id | INT | FK → utilisateurs.id, NOT NULL |
| compte_source_id | INT | FK → comptes.id, NOT NULL |
| email_destinataire | VARCHAR(190) | NOT NULL |
| montant | DECIMAL(12,2) | NOT NULL |
| description | VARCHAR(255) | nullable |
| mot_de_passe_hash | VARCHAR(255) | nullable (NULL si auto-dépôt) |
| statut | ENUM('EN_ATTENTE','ACCEPTEE','ANNULEE','EXPIREE') | DEFAULT 'EN_ATTENTE' |
| compte_destination_id | INT | FK → comptes.id, nullable |
| date_envoi | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| date_expiration | DATETIME | date_envoi + 30 jours |
| date_traitement | DATETIME | nullable |

### Table `interac_autodeposit`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| utilisateur_id | INT | FK → utilisateurs.id, UNIQUE |
| email_interac | VARCHAR(190) | UNIQUE, NOT NULL |
| compte_depot_id | INT | FK → comptes.id, NOT NULL |
| statut | ENUM('EN_ATTENTE','ACTIVE') | DEFAULT 'EN_ATTENTE' |
| token_verification | CHAR(6) | nullable |
| token_expire_le | DATETIME | nullable |
| cree_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| modifie_le | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

### Colonnes ajoutées à `utilisateurs` (limites personnalisées)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| interac_limite_24h | DECIMAL(10,2) | nullable — NULL = limite globale (3 000 $) |
| interac_limite_7j | DECIMAL(10,2) | nullable — NULL = limite globale (10 000 $) |
| interac_limite_30j | DECIMAL(10,2) | nullable — NULL = limite globale (20 000 $) |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-INT-01 | Montant minimum : 0,50 $ CAD |
| RB-INT-02 | Limites globales d'envoi : 3 000 $ / 24h · 10 000 $ / 7j · 20 000 $ / 30j (fenêtres glissantes) |
| RB-INT-03 | Un administrateur peut personnaliser les limites par client ; `null` rétablit la limite globale |
| RB-INT-04 | Les transferts ANNULEE et EXPIREE ne comptent pas dans le cumul des limites |
| RB-INT-05 | Un utilisateur ne peut pas s'envoyer un virement à lui-même |
| RB-INT-06 | Le compte source est débité immédiatement à l'envoi (fonds en transit) |
| RB-INT-07 | Un transfert expire après 30 jours ; l'expiration est déclenchée à la prochaine lecture (lazy) |
| RB-INT-08 | L'expiration d'un transfert rembourse automatiquement le compte source |
| RB-INT-09 | Le mot de passe Interac doit comporter entre 3 et 25 caractères, ne pas être l'email du destinataire ni le montant |
| RB-INT-10 | Le mot de passe est stocké en hash bcrypt (10 rounds) — jamais retourné dans les réponses |
| RB-INT-11 | L'activation auto-dépôt est immédiate (1 étape) ; l'unicité de l'email est vérifiée avant toute écriture |
| RB-INT-12 | Si l'auto-dépôt est actif pour l'email destinataire, le transfert est accepté immédiatement sans mot de passe |
| RB-INT-13 | Seul l'expéditeur peut annuler un transfert EN_ATTENTE |
| RB-INT-14 | Seul le destinataire (email correspondant) peut réclamer un transfert |
