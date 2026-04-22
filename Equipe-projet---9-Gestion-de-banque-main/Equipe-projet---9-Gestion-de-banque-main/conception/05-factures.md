# Conception — Factures

## Description

Le système de factures permet de gérer des obligations de paiement. Les factures ont trois statuts : `A_VENIR` (pas encore due), `IMPAYEE` (due non payée), `PAYEE` (réglée). Les admins peuvent créer des factures avec n'importe quel statut; les utilisateurs créent uniquement des factures `IMPAYEE`. Le paiement débite le compte sélectionné.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Factures
        UC1[Lister ses factures]
        UC2[Voir une facture]
        UC3[Créer une facture - IMPAYEE]
        UC4[Créer une facture - tout statut]
        UC5[Payer une facture]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    U --> UC5
    MOD[Modérateur] --> UC1
    MOD --> UC2
    ADM[Admin] --> UC1
    ADM --> UC2
    ADM --> UC4
    ADM --> UC5
```

---

## Diagramme de classes

```mermaid
classDiagram
    class Facture {
        -int id
        -String description
        -double montant
        -StatutFacture statut
        -Date dateEcheance
        -Date creeLe
        +payer(compte: Compte) void
    }

    class Compte {
        -int id
        -double solde
        -StatutCompte statut
    }

    class StatutFacture {
        <<enumeration>>
        A_VENIR
        IMPAYEE
        PAYEE
    }

    Facture --> StatutFacture
    Facture "0..*" --> "1" Compte : associé à
```

---

## Diagramme de séquence — Créer une facture

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/factures { compte_id, description, montant, date_echeance, statut? }
    API->>API: requireAuth

    alt Rôle ADMIN
        Note over API: Peut définir statut librement (A_VENIR, IMPAYEE, PAYEE)
    else Rôle UTILISATEUR
        Note over API: Statut forcé à IMPAYEE
        API->>DB: Vérifier que compte_id appartient à l'utilisateur
    end

    API->>DB: INSERT INTO factures (...)
    DB-->>API: insertId
    API-->>C: 201 { facture }
```

---

## Diagramme de séquence — Payer une facture

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/factures/:id/payer { compte_id }
    API->>API: requireAuth
    API->>DB: SELECT facture WHERE id = ?

    alt Facture introuvable
        API-->>C: 404
    else Facture déjà PAYEE
        API-->>C: 400 { error: "Facture déjà payée" }
    else
        API->>DB: SELECT compte WHERE id = compte_id
        alt Solde insuffisant
            API-->>C: 400 { error: "Solde insuffisant" }
        else
            API->>DB: UPDATE factures SET statut = 'PAYEE'
            API->>DB: UPDATE comptes SET solde = solde - montant
            API->>DB: INSERT INTO transactions (type: PAIEMENT, compte_id, montant)
            API-->>C: 200 { facture }
        end
    end
```

---

## Flowchart — Cycle de vie d'une facture

```mermaid
flowchart LR
    A_VENIR([A_VENIR]) --> IMPAYEE([IMPAYEE])
    IMPAYEE --> PAYEE([PAYEE])
    A_VENIR --> PAYEE
    IMPAYEE -->|Paiement avec débit compte| PAYEE
```

---

## Schéma de la table `factures`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| client_id | INT | FK → clients.id, NOT NULL |
| compte_paiement_id | INT | FK → comptes.id, nullable |
| fournisseur | VARCHAR(120) | NOT NULL |
| reference_facture | VARCHAR(60) | NOT NULL |
| description | VARCHAR(255) | nullable |
| montant | DECIMAL(12,2) | NOT NULL |
| date_emission | DATE | NOT NULL |
| date_echeance | DATE | NOT NULL |
| statut | ENUM('A_VENIR','IMPAYEE','PAYEE') | DEFAULT 'A_VENIR' |
| payee_le | DATETIME | nullable |
| cree_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-FAC-01 | Un UTILISATEUR crée des factures avec statut `IMPAYEE` uniquement |
| RB-FAC-02 | Un ADMIN peut créer des factures avec n'importe quel statut |
| RB-FAC-03 | Une facture `PAYEE` ne peut pas être payée à nouveau |
| RB-FAC-04 | Le paiement débite le compte et génère une transaction de type `PAIEMENT` |
| RB-FAC-05 | Le compte doit avoir un solde suffisant pour payer une facture |
| RB-FAC-06 | ADMIN et MODERATEUR voient toutes les factures ; un UTILISATEUR ne voit que les siennes |
