# Conception — Dépôts de Chèques

## Description

Les utilisateurs peuvent soumettre des dépôts de chèques avec une image (photo du chèque). Les dépôts passent par un processus d'approbation sauf si le flag `auto_validation` est activé sur l'utilisateur. Les statuts sont `EN_ATTENTE`, `APPROUVE`, `REJETE`.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Dépôts de Chèques
        UC1[Lister ses dépôts]
        UC2[Voir un dépôt]
        UC3[Soumettre un dépôt]
        UC4[Approuver un dépôt]
        UC5[Rejeter un dépôt]
        UC6[Voir tous les dépôts]
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
    class DepotCheque {
        -int id
        -double montant
        -String imageCheque
        -String notes
        -StatutDepot statut
        -Date dateCreation
        +approuver() void
        +rejeter(notes: String) void
    }

    class Compte {
        -int id
        -double solde
    }

    class Utilisateur {
        -int id
        -boolean autoValidation
    }

    class StatutDepot {
        <<enumeration>>
        EN_ATTENTE
        APPROUVE
        REJETE
    }

    DepotCheque --> StatutDepot
    DepotCheque "0..*" --> "1" Compte : crédite
    DepotCheque "0..*" --> "1" Utilisateur : soumis par
```

---

## Diagramme de séquence — Soumettre un dépôt

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant FS as Système de fichiers
    participant DB as MySQL

    C->>API: POST /api/depots (multipart: compte_id, montant, image_cheque)
    API->>API: requireAuth
    API->>FS: Sauvegarder image (multer → /uploads/)
    API->>DB: SELECT utilisateur WHERE id = session.userId
    API->>DB: INSERT INTO depots_cheques (statut: EN_ATTENTE, image_cheque: path)

    alt auto_validation = true
        API->>DB: UPDATE depots_cheques SET statut = 'APPROUVE'
        API->>DB: UPDATE comptes SET solde = solde + montant
        API->>DB: INSERT INTO transactions (type: DEPOT, montant)
        API-->>C: 201 { depot, statut: 'APPROUVE' }
    else
        API-->>C: 201 { depot, statut: 'EN_ATTENTE' }
    end
```

---

## Diagramme de séquence — Approuver un dépôt

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: PATCH /api/depots/:id/approuver
    API->>API: requireElevated
    API->>DB: SELECT depot WHERE id = ?
    alt Dépôt introuvable
        API-->>C: 404
    else Statut != EN_ATTENTE
        API-->>C: 400 { error: "Dépôt non en attente" }
    else
        API->>DB: UPDATE depots_cheques SET statut = 'APPROUVE'
        API->>DB: UPDATE comptes SET solde = solde + montant
        API->>DB: INSERT INTO transactions (type: DEPOT, montant)
        API-->>C: 200 { depot }
    end
```

---

## Diagramme de séquence — Rejeter un dépôt

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: PATCH /api/depots/:id/rejeter { notes? }
    API->>API: requireElevated
    API->>DB: SELECT depot WHERE id = ?
    alt Statut != EN_ATTENTE
        API-->>C: 400
    else
        API->>DB: UPDATE depots_cheques SET statut = 'REJETE', notes = ?
        API-->>C: 200 { depot }
    end
```

---

## Flowchart — Cycle de vie d'un dépôt

```mermaid
flowchart TD
    SUBMIT([Soumettre dépôt]) --> AUTO{auto_validation ?}
    AUTO -- Oui --> APPROVED([APPROUVE - Compte crédité])
    AUTO -- Non --> PENDING([EN_ATTENTE])
    PENDING --> REVIEW{Décision mod/admin}
    REVIEW -- Approuver --> APPROVED
    REVIEW -- Rejeter --> REJECTED([REJETE])
```

---

## Schéma de la table `depots_cheques`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| compte_id | INT | FK → comptes.id |
| client_id | INT | FK → clients.id |
| montant | DECIMAL(12,2) | NOT NULL |
| numero_cheque | VARCHAR(50) | NOT NULL |
| banque_emettrice | VARCHAR(120) | NOT NULL |
| fichier_chemin | VARCHAR(500) | nullable (chemin fichier dans uploads/depots/) |
| statut | ENUM('EN_ATTENTE','APPROUVE','REJETE') | DEFAULT 'EN_ATTENTE' |
| notes | VARCHAR(255) | nullable |
| depose_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| traite_le | TIMESTAMP | nullable |
| traite_par | INT | FK → utilisateurs.id, nullable |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-DEP-01 | L'image du chèque est obligatoire lors de la soumission |
| RB-DEP-02 | Si `auto_validation = true` sur l'utilisateur, le dépôt est immédiatement approuvé |
| RB-DEP-03 | Seuls ADMIN et MODERATEUR peuvent approuver ou rejeter |
| RB-DEP-04 | L'approbation crédite le compte et génère une transaction de type `DEPOT` |
| RB-DEP-05 | Un dépôt ne peut être approuvé/rejeté que s'il est en statut `EN_ATTENTE` |
| RB-DEP-06 | Les fichiers uploadés sont stockés dans le dossier `/uploads/` |
| RB-DEP-07 | ADMIN et MODERATEUR voient tous les dépôts ; un UTILISATEUR ne voit que les siens |
