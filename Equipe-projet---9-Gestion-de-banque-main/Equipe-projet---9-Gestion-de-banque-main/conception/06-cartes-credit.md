# Conception — Cartes de Crédit

## Description

Les cartes de crédit sont liées à un compte bancaire. Deux types : `VISA` et `MASTERCARD`. Quatre statuts possibles : `ACTIVE`, `GELEE`, `BLOQUEE`, `EXPIREE`. L'ADMIN gère le cycle de vie complet (créer, bloquer, activer, modifier les limites). L'utilisateur peut seulement geler/dégeler sa propre carte.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Cartes de Crédit
        UC1[Lister ses cartes]
        UC2[Voir une carte]
        UC3[Geler sa carte]
        UC4[Dégeler sa carte]
        UC5[Créer une carte]
        UC6[Bloquer une carte]
        UC7[Activer une carte]
        UC8[Modifier la limite de crédit]
        UC9[Modifier le solde utilisé]
        UC10[Rembourser une carte]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    U --> UC4
    U --> UC10
    MOD[Modérateur] --> UC1
    MOD --> UC2
    ADM[Admin] --> UC1
    ADM --> UC2
    ADM --> UC5
    ADM --> UC6
    ADM --> UC7
    ADM --> UC8
    ADM --> UC9
    ADM --> UC10
```

---

## Diagramme de classes

```mermaid
classDiagram
    class CarteCredit {
        -int id
        -String numeroCarte
        -String nomTitulaire
        -Date dateExpiration
        -String cvv
        -TypeCarte typeCarte
        -StatutCarte statut
        -double limiteCredit
        -double soldeUtilise
        -Date creeLe
        +geler() void
        +degeler() void
        +bloquer() void
        +activer() void
        +rembourser(compte: Compte, montant: double) void
    }

    class Compte {
        -int id
        -String numeroCompte
        -double solde
    }

    class TypeCarte {
        <<enumeration>>
        VISA
        MASTERCARD
    }

    class StatutCarte {
        <<enumeration>>
        ACTIVE
        GELEE
        BLOQUEE
        EXPIREE
    }

    CarteCredit --> TypeCarte
    CarteCredit --> StatutCarte
    CarteCredit "0..*" --> "1" Compte : associée à
```

---

## Diagramme d'états — Carte de crédit

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : Créer (ADMIN)
    ACTIVE --> GELEE : Geler (USER ou ADMIN)
    GELEE --> ACTIVE : Dégeler (USER ou ADMIN)
    ACTIVE --> BLOQUEE : Bloquer (ADMIN)
    GELEE --> BLOQUEE : Bloquer (ADMIN)
    BLOQUEE --> ACTIVE : Activer (ADMIN)
    ACTIVE --> EXPIREE : Date expiration dépassée
    EXPIREE --> [*]
```

---

## Diagramme de séquence — Créer une carte

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/cartes { compte_id, type_carte, limite_credit, nom_titulaire }
    API->>API: requireAdmin
    API->>DB: SELECT compte WHERE id = compte_id
    alt Compte inexistant
        API-->>C: 404
    else
        API->>API: Générer numéro_carte (16 chiffres)
        API->>API: Générer CVV (3 chiffres)
        API->>API: Générer date_expiration (3 ans)
        API->>DB: INSERT INTO cartes_credit (...)
        API-->>C: 201 { carte }
    end
```

---

## Diagramme de séquence — Geler une carte (utilisateur)

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: PATCH /api/cartes/:id/geler
    API->>API: requireAuth
    API->>DB: SELECT carte WHERE id = ?
    alt Carte introuvable
        API-->>C: 404
    else Rôle UTILISATEUR et carte non liée à ses comptes
        API-->>C: 403 Forbidden
    else Carte déjà gelée ou bloquée
        API-->>C: 400 { error }
    else
        API->>DB: UPDATE cartes_credit SET statut = 'GELEE'
        API-->>C: 200 { carte }
    end
```

---

## Diagramme de séquence — Rembourser une carte

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/cartes/:id/rembourser { compte_id, montant }
    API->>API: requireAuth
    API->>DB: SELECT carte, compte
    alt Solde insuffisant dans compte
        API-->>C: 400 { error: "Solde insuffisant" }
    else Montant > solde_utilise de la carte
        API-->>C: 400 { error: "Montant dépasse le solde utilisé" }
    else
        API->>DB: UPDATE cartes_credit SET solde_utilise = solde_utilise - montant
        API->>DB: UPDATE comptes SET solde = solde - montant
        API->>DB: INSERT INTO transactions (type: REMBOURSEMENT)
        API-->>C: 200 { carte }
    end
```

---

## Schéma de la table `cartes_credit`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| client_id | INT | FK → clients.id |
| numero_compte | VARCHAR(22) | NOT NULL (numéro de carte 16 chiffres format `XXXX XXXX XXXX XXXX`) |
| type_carte | ENUM('VISA','MASTERCARD') | DEFAULT 'VISA' |
| limite_credit | DECIMAL(12,2) | DEFAULT 5000.00 |
| solde_utilise | DECIMAL(12,2) | DEFAULT 0.00 |
| statut | ENUM('ACTIVE','GELEE','BLOQUEE','EXPIREE') | DEFAULT 'ACTIVE' |
| date_expiration | DATE | NOT NULL |
| cvv | CHAR(3) | NOT NULL |
| cree_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Note :** La carte est liée à un `client_id` (pas à un `compte_id`). Le remboursement utilise un compte CHEQUES/EPARGNE appartenant au même client.

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-CARTE-01 | Seul l'ADMIN peut créer une carte de crédit |
| RB-CARTE-02 | Seul l'ADMIN peut bloquer/activer une carte |
| RB-CARTE-03 | Un UTILISATEUR peut geler/dégeler uniquement sa propre carte |
| RB-CARTE-04 | Une carte `BLOQUEE` ne peut pas être gelée (seulement activée) |
| RB-CARTE-05 | Le numéro de carte (16 chiffres), CVV (3 chiffres) et date d'expiration sont générés automatiquement |
| RB-CARTE-06 | L'expiration est fixée à 3 ans après la création |
| RB-CARTE-07 | Le remboursement débite le compte associé et réduit le `solde_utilise` |
| RB-CARTE-08 | On ne peut pas rembourser plus que le `solde_utilise` |
| RB-CARTE-09 | L'ADMIN peut modifier directement `limite_credit` et `solde_utilise` |
