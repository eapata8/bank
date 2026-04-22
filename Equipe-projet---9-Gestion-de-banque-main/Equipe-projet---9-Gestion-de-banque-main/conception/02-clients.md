# Conception — Gestion des Clients

## Description

Un **client** représente un profil bancaire fictif (personne physique) distinct du compte utilisateur système. Un utilisateur peut être lié à plusieurs clients via la table de jonction `utilisateurs_clients`. Les admins et modérateurs voient tous les clients; un utilisateur ne voit que les siens.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Gestion des Clients
        UC1[Lister ses clients]
        UC2[Créer un client]
        UC3[Voir les comptes d'un client]
        UC4[Voir toutes les opérations d'un client]
        UC5[Lier client à un utilisateur]
    end

    U[Utilisateur] --> UC1
    U --> UC3
    MOD[Modérateur] --> UC1
    MOD --> UC2
    MOD --> UC3
    MOD --> UC4
    MOD --> UC5
    ADM[Admin] --> UC1
    ADM --> UC2
    ADM --> UC3
    ADM --> UC4
    ADM --> UC5
```

---

## Diagramme de classes

```mermaid
classDiagram
    class Client {
        -int id
        -String prenom
        -String nom
        -String email
        -String telephone
        -String adresse
        -Date creeLe
        +getComptes() List~Compte~
    }

    class Utilisateur {
        -int id
        -String email
        -Role role
    }

    class Compte {
        -int id
        -String numeroCompte
        -TypeCompte typeCompte
        -double solde
        -StatutCompte statut
    }

    class Role {
        <<enumeration>>
        UTILISATEUR
        MODERATEUR
        ADMIN
    }

    Utilisateur "1..*" -- "0..*" Client : lié à
    Client "1" --> "1..*" Compte : possède
```

---

## Diagramme de séquence — Créer un client

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/clients { prenom, nom, email, telephone, adresse, utilisateur_id? }
    API->>API: requireElevated (ADMIN/MOD)
    API->>DB: INSERT INTO clients (...)
    DB-->>API: insertId (client_id)
    alt utilisateur_id fourni
        API->>DB: INSERT INTO utilisateurs_clients (utilisateur_id, client_id)
    end
    alt auto_validation activée (si via admin)
        API->>DB: UPDATE utilisateurs SET auto_validation=1 WHERE id=utilisateur_id
    end
    API-->>C: 201 { client }
```

---

## Diagramme de séquence — Lister les clients

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: GET /api/clients
    API->>API: requireAuth
    alt Rôle ADMIN ou MODERATEUR
        API->>DB: SELECT * FROM clients
    else Rôle UTILISATEUR
        API->>DB: SELECT clients via utilisateurs_clients WHERE utilisateur_id = ?
    end
    DB-->>API: liste clients
    API-->>C: 200 [ { client... } ]
```

---

## Diagramme de séquence — Opérations d'un client

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: GET /api/clients/:clientId/operations
    API->>API: requireElevated
    API->>DB: SELECT comptes WHERE client_id = ?
    loop Chaque compte
        API->>DB: SELECT transactions WHERE compte_id = ?
        API->>DB: SELECT virements WHERE compte_source/dest = ?
        API->>DB: SELECT depots_cheques WHERE compte_id = ?
        API->>DB: SELECT retraits WHERE compte_id = ?
    end
    API-->>C: 200 { comptes, transactions, virements, depots, retraits }
```

---

## Schémas des tables

### Table `clients`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| prenom | VARCHAR(80) | NOT NULL |
| nom | VARCHAR(80) | NOT NULL |
| email_fictif | VARCHAR(190) | UNIQUE, NOT NULL |
| ville | VARCHAR(120) | nullable |
| cree_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table `utilisateurs_clients`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| utilisateur_id | INT | FK → utilisateurs.id |
| client_id | INT | FK → clients.id |
| PK | (utilisateur_id, client_id) | UNIQUE |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-CLI-01 | Seuls ADMIN et MODERATEUR peuvent créer un client |
| RB-CLI-02 | Un client peut être lié à aucun ou plusieurs utilisateurs |
| RB-CLI-03 | Un utilisateur peut gérer plusieurs clients (ex: compte famille) |
| RB-CLI-04 | ADMIN et MODERATEUR voient tous les clients du système |
| RB-CLI-05 | Un UTILISATEUR ne voit que ses propres clients (via `utilisateurs_clients`) |
| RB-CLI-06 | La consultation de toutes les opérations d'un client est réservée aux rôles élevés |
