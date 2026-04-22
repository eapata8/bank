# Conception — Architecture Globale LEON BANK

## Vue d'ensemble

LEON BANK est une application web de gestion bancaire complète. Elle simule un environnement bancaire avec trois niveaux d'accès, une interface client et un back-office de supervision.

---

## Diagramme d'architecture globale

```mermaid
graph TB
    subgraph Client Browser
        FE["Next.js Frontend<br/>Port 3000"]
    end

    subgraph Serveur
        API["Express.js API<br/>Port 3001"]
        SESSION["express-session<br/>MySQL Store"]
        UPLOAD["/uploads/<br/>Fichiers chèques"]
    end

    subgraph Base de données
        DB[("MySQL<br/>leon_bank")]
    end

    FE -->|HTTP via rewrites| API
    API --> SESSION
    API --> DB
    API --> UPLOAD
    SESSION --> DB
```

---

## Diagramme de déploiement

```mermaid
graph LR
    subgraph Développement local
        NODE[Node.js 18+]
        MYSQL[MySQL 8+]
        NEXT[Next.js dev server]
    end

    NODE --> |runs| EXPRESS[Express API :3001]
    NEXT --> |proxies /api| EXPRESS
    EXPRESS --> MYSQL
```

---

## Diagramme de composants — Backend

```mermaid
graph TD
    subgraph Express App
        IDX["index.js<br/>Point d'entrée"]

        subgraph Routes
            AR[auth.routes]
            CR[clients.routes]
            CPR[comptes.routes]
            VR[virements.routes]
            FR[factures.routes]
            KR[cartes.routes]
            DR[depots.routes]
            RR[retraits.routes]
            ADR[admin.routes]
            EXR[export.routes]
        end

        subgraph Controllers
            AC[auth.controller]
            CC[clients.controller]
            CPC[comptes.controller]
            VC[virements.controller]
            FC[factures.controller]
            KC[cartes.controller]
            DC[depots.controller]
            RC[retraits.controller]
            ADC[admin.controller]
            EXC[export.controller]
        end

        subgraph DL["Data Layer"]
            AD[auth.data]
            CD[clients.data]
            CPD[comptes.data]
            VD[virements.data]
            FD[factures.data]
            KD[cartes.data]
            DD[depots.data]
            RD[retraits.data]
            ADD[admin.data]
            AUD[audit.data]
        end

        subgraph Middlewares
            MW[auth.middleware]
            UPL[upload.middleware]
        end
    end

    DB[(MySQL)]

    IDX --> Routes
    Routes --> Middlewares
    Routes --> Controllers
    Controllers --> DL
    DL --> DB
```

---

## Diagramme de composants — Frontend

```mermaid
graph TD
    subgraph Next.js App
        subgraph Pages
            LG[login/page.tsx]
            DASH[dashboard/page.tsx]
            CPT[dashboard/comptes/]
            VIR[dashboard/virements/]
            FAC[dashboard/factures/]
            CAR[dashboard/cartes/]
            DEP[dashboard/depots/]
            RET[dashboard/retraits/]
            CLI[dashboard/clients/]
            ADM[dashboard/admin/]
        end

        subgraph Composants
            APP[AppShell.tsx]
            AUTH[AuthGate.tsx]
            LUX[LuxuryBankingDashboard.tsx]
            BTN[ui/Button.tsx]
            CRD[ui/Card.tsx]
            INP[ui/Input.tsx]
            SEL[ui/Select.tsx]
        end

        subgraph Context & Lib
            CTX[AuthContext.tsx]
            API[lib/api.ts]
            TYP[lib/types.ts]
        end
    end

    Pages --> Composants
    Pages --> CTX
    Pages --> API
    API -->|fetch| BACKEND[Express API :3001]
```

---

## Modèle de données — Diagramme ERD complet

```mermaid
erDiagram
    utilisateurs {
        int id PK
        varchar email
        varchar mot_de_passe_hash
        enum role
        varchar prenom
        varchar nom
        tinyint auto_validation
        timestamp cree_le
    }

    clients {
        int id PK
        varchar prenom
        varchar nom
        varchar email_fictif
        varchar ville
        timestamp cree_le
    }

    utilisateurs_clients {
        int utilisateur_id FK
        int client_id FK
    }

    comptes {
        int id PK
        int client_id FK
        enum type_compte
        varchar numero_compte
        char numero_institution
        char numero_transit
        varchar swift_bic
        decimal solde
        char devise
        tinyint est_actif
    }

    transactions {
        int id PK
        int compte_id FK
        enum type_transaction
        varchar description
        decimal montant
        datetime date_transaction
        enum statut
    }

    virements {
        int id PK
        int compte_source_id FK
        int compte_destination_id FK
        decimal montant
        varchar description
        datetime date_virement
        enum statut
    }

    factures {
        int id PK
        int client_id FK
        int compte_paiement_id FK
        varchar fournisseur
        varchar reference_facture
        varchar description
        decimal montant
        date date_emission
        date date_echeance
        enum statut
        datetime payee_le
        timestamp cree_le
    }

    cartes_credit {
        int id PK
        int client_id FK
        varchar numero_compte
        enum type_carte
        decimal limite_credit
        decimal solde_utilise
        enum statut
        date date_expiration
        char cvv
        timestamp cree_le
    }

    depots_cheques {
        int id PK
        int compte_id FK
        int client_id FK
        decimal montant
        varchar numero_cheque
        varchar banque_emettrice
        varchar fichier_chemin
        enum statut
        varchar notes
        timestamp depose_le
        timestamp traite_le
        int traite_par FK
    }

    retraits {
        int id PK
        int compte_id FK
        int client_id FK
        decimal montant
        varchar description
        enum statut
        int approuve_par FK
        timestamp date_demande
        timestamp date_approbation
    }

    audit_logs {
        int id PK
        int utilisateur_id FK
        enum role_utilisateur
        varchar action
        varchar details
        timestamp cree_le
    }

    utilisateurs ||--o{ utilisateurs_clients : ""
    clients ||--o{ utilisateurs_clients : ""
    clients ||--o{ comptes : possède
    comptes ||--o{ transactions : génère
    comptes ||--o{ virements : source
    comptes ||--o{ virements : destination
    comptes ||--o{ factures : associé
    comptes ||--o{ cartes_credit : lie
    comptes ||--o{ depots_cheques : cible
    comptes ||--o{ retraits : cible
    utilisateurs ||--o{ depots_cheques : soumet
    utilisateurs ||--o{ retraits : soumet
    utilisateurs ||--o{ audit_logs : génère
```

---

## Stack technique

| Composant | Technologie | Version |
|-----------|------------|---------|
| Backend | Node.js / Express | 4.19 |
| Authentification | express-session + bcryptjs | 1.19 / 3.0 |
| Base de données | MySQL | 8+ |
| ORM/Query | mysql2 (requêtes directes) | 3.20 |
| Frontend | Next.js | 16.2 |
| UI Framework | React | 19.2 |
| Langage frontend | TypeScript | — |
| Styles | Tailwind CSS | v4 |
| Tests | Jest | 30 |
| Upload fichiers | multer | — |

---

## Flux d'authentification et de navigation

```mermaid
flowchart TD
    VISIT[Visiteur] --> LOGIN["/login"]
    LOGIN --> AUTH{Authentifié ?}
    AUTH -- Non --> FORM[Formulaire login/inscription]
    FORM --> SUBMIT[POST /api/auth/login]
    SUBMIT --> SESSION{Session créée ?}
    SESSION -- Non --> FORM
    SESSION -- Oui --> ROLE{Rôle ?}
    AUTH -- Oui --> ROLE
    ROLE -- UTILISATEUR --> UDASH[Dashboard utilisateur]
    ROLE -- MODERATEUR --> MDASH[Dashboard + supervision]
    ROLE -- ADMIN --> ADASH[Dashboard + admin panel]

    UDASH --> CPT[Comptes]
    UDASH --> VIR[Virements]
    UDASH --> FAC[Factures]
    UDASH --> CAR[Cartes]
    UDASH --> DEP[Dépôts]
    UDASH --> RET[Retraits]

    ADASH --> ADM[Admin Panel]
    ADM --> USERS[Utilisateurs]
    ADM --> ACCTS[Gestion comptes]
    ADM --> AUDIT[Audit logs]
```
