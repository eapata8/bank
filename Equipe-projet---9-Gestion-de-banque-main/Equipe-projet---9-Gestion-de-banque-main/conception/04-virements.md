# Conception — Virements

## Description

Deux types de virements sont supportés :
- **Virement interne** : entre deux comptes existants dans le système LEON BANK
- **Virement externe** : vers un compte externe avec coordonnées bancaires (institution, transit, SWIFT)

Les virements peuvent avoir les statuts `EN_ATTENTE`, `ACCEPTE`, `REFUSE`.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Virements
        UC1[Voir l'historique des virements]
        UC2[Effectuer un virement interne]
        UC3[Effectuer un virement externe]
        UC4[Voir tous les virements - admin]
        UC5[Ajouter un virement manuellement]
        UC6[Supprimer un virement]
        UC7[Forcer un transfert]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    MOD[Modérateur] --> UC1
    MOD --> UC4
    ADM[Admin] --> UC4
    ADM --> UC5
    ADM --> UC6
    ADM --> UC7
```

---

## Diagramme de classes

```mermaid
classDiagram
    class Virement {
        -int id
        -double montant
        -String description
        -StatutVirement statut
        -TypeVirement typeVirement
        -String institutionDestination
        -String transitDestination
        -String swiftDestination
        -Date dateCreation
    }

    class Compte {
        -int id
        -String numeroCompte
        -double solde
        -StatutCompte statut
    }

    class StatutVirement {
        <<enumeration>>
        EN_ATTENTE
        ACCEPTE
        REFUSE
    }

    class TypeVirement {
        <<enumeration>>
        INTERNE
        EXTERNE
    }

    Virement --> StatutVirement
    Virement --> TypeVirement
    Virement "0..*" --> "1" Compte : source
    Virement "0..*" --> "0..1" Compte : destination (interne)
```

---

## Diagramme de séquence — Virement interne

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/virements { compte_source_id, compte_destination_id, montant, description? }
    API->>API: requireAuth
    API->>DB: SELECT compte source WHERE id = ?
    API->>DB: SELECT compte destination WHERE id = ?

    alt Compte source ou destination introuvable
        API-->>C: 404 { error }
    else Solde insuffisant
        API-->>C: 400 { error: "Solde insuffisant" }
    else Comptes valides
        API->>DB: UPDATE comptes SET solde = solde - montant WHERE id = source
        API->>DB: UPDATE comptes SET solde = solde + montant WHERE id = destination
        API->>DB: INSERT INTO transactions (type: VIREMENT, compte: source, montant: -montant)
        API->>DB: INSERT INTO transactions (type: VIREMENT, compte: dest, montant: +montant)
        API->>DB: INSERT INTO virements (statut: ACCEPTE)
        API-->>C: 201 { virement }
    end
```

---

## Diagramme de séquence — Virement externe

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/virements/externe { compte_source_id, numero_compte_dest, institution_dest, transit_dest, swift_dest, montant, description? }
    API->>API: requireAuth
    API->>DB: SELECT compte source WHERE id = ?

    alt Solde insuffisant
        API-->>C: 400 { error: "Solde insuffisant" }
    else Coordonnées invalides
        API-->>C: 400 { error: "Coordonnées bancaires invalides" }
    else Valide
        API->>DB: UPDATE comptes SET solde = solde - montant WHERE id = source
        API->>DB: INSERT INTO transactions (type: VIREMENT, compte: source, montant: -montant)
        API->>DB: INSERT INTO virements (compte_destination_id: NULL, institution_dest, transit_dest, swift_dest, statut: ACCEPTE)
        API-->>C: 201 { virement }
    end
```

---

## Flowchart — Validation d'un virement

```mermaid
flowchart TD
    START([Demande de virement]) --> AUTH{Utilisateur authentifié ?}
    AUTH -- Non --> E401[401 Non autorisé]
    AUTH -- Oui --> TYPE{Type de virement ?}

    TYPE -- Interne --> DEST{Compte destination existe ?}
    DEST -- Non --> E404[404 Compte introuvable]
    DEST -- Oui --> BAL{Solde source >= montant ?}

    TYPE -- Externe --> COORDS{Coordonnées valides ?}
    COORDS -- Non --> E400[400 Coordonnées invalides]
    COORDS -- Oui --> BAL

    BAL -- Non --> E400B[400 Solde insuffisant]
    BAL -- Oui --> EXEC[Exécuter le virement]
    EXEC --> DEBIT[Débiter source]
    DEBIT --> CREDIT[Créditer destination]
    CREDIT --> TXN[Enregistrer transactions]
    TXN --> VIR[Enregistrer virement ACCEPTE]
    VIR --> SUCCESS([201 Succès])
```

---

## Schéma de la table `virements`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| compte_source_id | INT | FK → comptes.id, NOT NULL |
| compte_destination_id | INT | FK → comptes.id, NOT NULL |
| montant | DECIMAL(12,2) | NOT NULL |
| description | VARCHAR(255) | nullable |
| date_virement | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| statut | ENUM('ACCEPTE','REFUSE','EN_ATTENTE') | DEFAULT 'ACCEPTE' |

**Note :** Pour les virements externes, le compte de destination est trouvé via ses coordonnées bancaires (`numero_compte`, `numero_institution`, `numero_transit`, `swift_bic`) — ce compte doit exister dans la base de données LEON BANK. Le système simule uniquement des transferts interbancaires vers des comptes du réseau NEXUS.

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-VIR-01 | Un virement interne exige que les deux comptes existent dans le système |
| RB-VIR-02 | Le compte source doit avoir un solde suffisant avant le virement |
| RB-VIR-03 | Un virement externe n'a pas de `compte_destination_id` (NULL) |
| RB-VIR-04 | Les virements sont exécutés immédiatement avec statut `ACCEPTE` |
| RB-VIR-05 | ADMIN et MODERATEUR voient tous les virements ; un UTILISATEUR ne voit que les siens |
| RB-VIR-06 | Un virement génère deux transactions : débit sur source, crédit sur destination |
| RB-VIR-07 | L'ADMIN peut ajouter ou supprimer des virements manuellement via le panel admin |
