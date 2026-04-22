# Conception — Retraits

## Description

Les utilisateurs peuvent soumettre des demandes de retrait d'argent liquide. Le montant maximum par retrait est de **1000 CAD**. Les demandes passent par approbation sauf si `auto_validation` est activé. Les statuts sont `EN_ATTENTE`, `APPROUVE`, `REJETE`.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Retraits
        UC1[Lister ses retraits]
        UC2[Voir un retrait]
        UC3[Soumettre une demande de retrait]
        UC4[Approuver un retrait]
        UC5[Rejeter un retrait]
        UC6[Voir tous les retraits]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    MOD[Modérateur] --> UC1
    MOD --> UC2
    MOD --> UC4
    MOD --> UC5
    MOD --> UC6
    ADM[Admin] --> UC6
    ADM --> UC4
    ADM --> UC5
```

---

## Diagramme de classes

```mermaid
classDiagram
    class Retrait {
        -int id
        -double montant
        -String notes
        -StatutRetrait statut
        -Date dateCreation
        +approuver() void
        +rejeter() void
    }

    class Compte {
        -int id
        -double solde
    }

    class Utilisateur {
        -int id
        -boolean autoValidation
    }

    class StatutRetrait {
        <<enumeration>>
        EN_ATTENTE
        APPROUVE
        REJETE
    }

    Retrait --> StatutRetrait
    Retrait "0..*" --> "1" Compte : débite
    Retrait "0..*" --> "1" Utilisateur : soumis par
```

---

## Diagramme de séquence — Soumettre un retrait

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/retraits { compte_id, montant, notes? }
    API->>API: requireAuth

    alt montant > 1000
        API-->>C: 400 { error: "Maximum 1000 CAD par retrait" }
    else
        API->>DB: SELECT compte WHERE id = compte_id
        alt Solde insuffisant
            API-->>C: 400 { error: "Solde insuffisant" }
        else
            API->>DB: SELECT utilisateur WHERE id = session.userId
            API->>DB: INSERT INTO retraits (statut: EN_ATTENTE)

            alt auto_validation = true
                API->>DB: UPDATE retraits SET statut = 'APPROUVE'
                API->>DB: UPDATE comptes SET solde = solde - montant
                API->>DB: INSERT INTO transactions (type: RETRAIT, montant)
                API-->>C: 201 { retrait, statut: 'APPROUVE' }
            else
                API-->>C: 201 { retrait, statut: 'EN_ATTENTE' }
            end
        end
    end
```

---

## Diagramme de séquence — Approuver un retrait

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: PATCH /api/retraits/:id/approuver
    API->>API: requireElevated
    API->>DB: SELECT retrait WHERE id = ?

    alt Retrait introuvable
        API-->>C: 404
    else Statut != EN_ATTENTE
        API-->>C: 400 { error: "Retrait non en attente" }
    else
        API->>DB: SELECT compte
        alt Solde insuffisant au moment de l'approbation
            API-->>C: 400 { error: "Solde insuffisant" }
        else
            API->>DB: UPDATE retraits SET statut = 'APPROUVE'
            API->>DB: UPDATE comptes SET solde = solde - montant
            API->>DB: INSERT INTO transactions (type: RETRAIT, montant)
            API-->>C: 200 { retrait }
        end
    end
```

---

## Flowchart — Cycle de vie d'un retrait

```mermaid
flowchart TD
    SUBMIT([Soumettre retrait]) --> MAX{montant <= 1000 CAD ?}
    MAX -- Non --> E400[400 Montant trop élevé]
    MAX -- Oui --> BAL{Solde suffisant ?}
    BAL -- Non --> E400B[400 Solde insuffisant]
    BAL -- Oui --> AUTO{auto_validation ?}
    AUTO -- Oui --> APPROVED([APPROUVE - Compte débité])
    AUTO -- Non --> PENDING([EN_ATTENTE])
    PENDING --> REVIEW{Décision mod/admin}
    REVIEW -- Approuver --> CHECK2{Solde encore suffisant ?}
    CHECK2 -- Non --> E400C[400 Solde insuffisant]
    CHECK2 -- Oui --> APPROVED
    REVIEW -- Rejeter --> REJECTED([REJETE])
```

---

## Comparaison avec les Dépôts de Chèques

| Aspect | Dépôt de Chèque | Retrait |
|--------|----------------|---------|
| Direction | Crédit compte | Débit compte |
| Montant max | Aucune limite | 1000 CAD |
| Fichier requis | Oui (image chèque) | Non |
| auto_validation | Oui | Oui |
| Approbation | ADMIN / MOD | ADMIN / MOD |

---

## Schéma de la table `retraits`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| compte_id | INT | FK → comptes.id |
| client_id | INT | FK → clients.id |
| montant | DECIMAL(12,2) | NOT NULL |
| description | VARCHAR(255) | nullable |
| statut | ENUM('EN_ATTENTE','APPROUVE','REJETE') | DEFAULT 'EN_ATTENTE' |
| approuve_par | INT | FK → utilisateurs.id, nullable |
| date_demande | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| date_approbation | TIMESTAMP | nullable |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-RET-01 | Le montant maximum par retrait est de 1000 CAD |
| RB-RET-02 | Le compte doit avoir un solde suffisant avant la soumission |
| RB-RET-03 | Si `auto_validation = true`, le retrait est immédiatement approuvé |
| RB-RET-04 | Seuls ADMIN et MODERATEUR peuvent approuver ou rejeter |
| RB-RET-05 | L'approbation débite le compte et génère une transaction de type `RETRAIT` |
| RB-RET-06 | Un retrait ne peut être approuvé/rejeté que s'il est en statut `EN_ATTENTE` |
| RB-RET-07 | Le solde est re-vérifié au moment de l'approbation |
| RB-RET-08 | ADMIN et MODERATEUR voient tous les retraits ; un UTILISATEUR ne voit que les siens |
