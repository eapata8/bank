# Conception — Gestion des Comptes

## Description

Les comptes bancaires sont liés à des clients. Trois types existent : `CHEQUES`, `EPARGNE`, `CREDIT`. Chaque compte possède un numéro de compte canadien généré automatiquement (institution 621, transit 5 chiffres, SWIFT NXBKCA2TXXX). Seuls les rôles élevés peuvent créer des comptes.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Gestion des Comptes
        UC1[Lister ses comptes]
        UC2[Consulter un compte]
        UC3[Voir les transactions d'un compte]
        UC4[Créer un compte]
        UC5[Obtenir les types de comptes]
        UC6[Activer / Désactiver un compte]
        UC7[Changer le type d'un compte]
        UC8[Ajuster le solde manuellement]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    U --> UC5
    MOD[Modérateur] --> UC1
    MOD --> UC2
    MOD --> UC3
    MOD --> UC4
    ADM[Admin] --> UC4
    ADM --> UC6
    ADM --> UC7
    ADM --> UC8
```

---

## Diagramme de classes

```mermaid
classDiagram
    class Compte {
        -int id
        -String numeroCompte
        -String institution
        -String transit
        -String swift
        -TypeCompte typeCompte
        -double solde
        -StatutCompte statut
        -Date creeLe
        +getTransactions() List~Transaction~
        +getDetails() Compte
    }

    class Client {
        -int id
        -String prenom
        -String nom
    }

    class Transaction {
        -int id
        -TypeTransaction typeTransaction
        -double montant
        -String description
        -Date dateCreation
    }

    class TypeCompte {
        <<enumeration>>
        CHEQUES
        EPARGNE
        CREDIT
    }

    class StatutCompte {
        <<enumeration>>
        ACTIF
        INACTIF
    }

    Client "1" --> "1..*" Compte : possède
    Compte "1" --> "0..*" Transaction : génère
    Compte --> TypeCompte
    Compte --> StatutCompte
```

---

## Diagramme de séquence — Créer un compte

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/comptes { client_id, type_compte, solde_initial? }
    API->>API: requireElevated
    API->>DB: SELECT client WHERE id = client_id
    alt Client inexistant
        API-->>C: 404 { error: "Client introuvable" }
    else Client trouvé
        API->>API: Générer numéro_compte canadien
        Note over API: institution=621, transit=5 chiffres aléatoires
        Note over API: SWIFT=NXBKCA2TXXX
        API->>DB: INSERT INTO comptes (client_id, numero_compte, institution, transit, swift, type_compte, solde)
        DB-->>API: insertId
        alt solde_initial > 0
            API->>DB: INSERT INTO transactions (type: DEPOT, montant: solde_initial)
        end
        API-->>C: 201 { compte }
    end
```

---

## Diagramme de séquence — Consulter les transactions d'un compte

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: GET /api/comptes/:id/transactions
    API->>API: requireAuth
    API->>DB: SELECT compte WHERE id = ?
    alt Compte inexistant
        API-->>C: 404
    else UTILISATEUR
        API->>DB: SELECT via utilisateurs_clients WHERE utilisateur_id = ?
        alt Compte non autorisé
            API-->>C: 403 Forbidden
        else Autorisé
            API->>DB: SELECT transactions WHERE compte_id = ?
            API-->>C: 200 [ transactions ]
        end
    else ADMIN / MODERATEUR
        API->>DB: SELECT transactions WHERE compte_id = ?
        API-->>C: 200 [ transactions ]
    end
```

---

## Format du numéro de compte canadien

```
Format: [Institution] [Transit] [Numéro de compte]
Exemple: 621-12345-9876543210

- Institution: 621 (LEON BANK)
- Transit: 5 chiffres aléatoires
- Numéro de compte: 10 chiffres aléatoires
- SWIFT: NXBKCA2TXXX
```

---

## Schéma de la table `comptes`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| client_id | INT | FK → clients.id |
| type_compte | ENUM('CHEQUES','EPARGNE','CREDIT') | NOT NULL |
| numero_compte | VARCHAR(20) | NOT NULL |
| numero_institution | CHAR(3) | DEFAULT '621' |
| numero_transit | CHAR(5) | DEFAULT '00000' |
| swift_bic | VARCHAR(11) | DEFAULT 'NXBKCA2TXXX' |
| solde | DECIMAL(12,2) | DEFAULT 0.00 |
| devise | CHAR(3) | DEFAULT 'CAD' |
| est_actif | TINYINT(1) | DEFAULT 1 |

## Schéma de la table `transactions`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| compte_id | INT | FK → comptes.id |
| type_transaction | ENUM('DEPOT','RETRAIT','VIREMENT','PAIEMENT','REMBOURSEMENT') | NOT NULL |
| description | VARCHAR(255) | NOT NULL |
| montant | DECIMAL(12,2) | NOT NULL |
| date_transaction | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| statut | ENUM('TERMINEE','EN_ATTENTE') | DEFAULT 'TERMINEE' |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-CPT-01 | Seuls ADMIN et MODERATEUR peuvent créer des comptes |
| RB-CPT-02 | Le numéro de compte est unique et généré automatiquement |
| RB-CPT-03 | Les types valides sont : `CHEQUES`, `EPARGNE`, `CREDIT` |
| RB-CPT-04 | Un UTILISATEUR ne peut voir que les comptes de ses propres clients |
| RB-CPT-05 | Un compte inactif (`INACTIF`) ne peut pas recevoir de transactions |
| RB-CPT-06 | L'ajustement manuel du solde est réservé à l'ADMIN |
| RB-CPT-07 | Tout dépôt initial à la création génère une transaction de type `DEPOT` |
