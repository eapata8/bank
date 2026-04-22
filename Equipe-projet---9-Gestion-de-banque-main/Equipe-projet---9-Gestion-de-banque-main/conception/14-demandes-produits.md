# Conception — Demandes de produits financiers

## Description

Catalogue de produits bancaires consultable par les clients depuis `/dashboard/produits`. Un client peut demander l'ouverture d'un produit (Carte VISA, Carte Mastercard, Compte CHEQUES, Compte EPARGNE). Un admin/modérateur examine la demande et peut l'approuver (le produit est automatiquement provisionné) ou la refuser. Le client peut également annuler sa propre demande tant qu'elle est encore `EN_ATTENTE`.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Demandes de produits
        UC1[Consulter le catalogue]
        UC2[Soumettre une demande]
        UC3[Voir ses demandes]
        UC4[Annuler sa demande EN_ATTENTE]
        UC5[Voir toutes les demandes]
        UC6[Approuver une demande]
        UC7[Refuser une demande]
        UC8[Annuler toute demande EN_ATTENTE]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    U --> UC4
    MOD[Modérateur] --> UC5
    MOD --> UC6
    MOD --> UC7
    MOD --> UC8
    ADM[Admin] --> UC5
    ADM --> UC6
    ADM --> UC7
    ADM --> UC8
```

---

## Diagramme de classes

```mermaid
classDiagram
    class DemandeProduit {
        -int id
        -int client_id
        -TypeProduit type_produit
        -StatutDemande statut
        -String notes
        -double limite_credit
        -int traite_par
        -Date cree_le
        -Date traite_le
        +soumettre() void
        +approuver(agent: Utilisateur) void
        +refuser(agent: Utilisateur, notes: String) void
        +annuler() void
    }

    class TypeProduit {
        <<enumeration>>
        CARTE_VISA
        CARTE_MASTERCARD
        COMPTE_CHEQUES
        COMPTE_EPARGNE
    }

    class StatutDemande {
        <<enumeration>>
        EN_ATTENTE
        APPROUVEE
        REFUSEE
    }

    class Client {
        -int id
        -String prenom
        -String nom
    }

    class Utilisateur {
        -int id
        -String role
    }

    class CarteCredit {
        -int id
        -int client_id
    }

    class Compte {
        -int id
        -int client_id
    }

    DemandeProduit --> TypeProduit
    DemandeProduit --> StatutDemande
    DemandeProduit "0..*" --> "1" Client : appartient à
    DemandeProduit "0..*" --> "0..1" Utilisateur : traité par
    DemandeProduit "1" ..> "0..1" CarteCredit : provisionne
    DemandeProduit "1" ..> "0..1" Compte : provisionne
```

---

## Diagramme d'états — Demande de produit

```mermaid
stateDiagram-v2
    [*] --> EN_ATTENTE : POST (client)
    EN_ATTENTE --> APPROUVEE : PATCH /approuver (admin/modérateur)
    EN_ATTENTE --> REFUSEE  : PATCH /refuser (admin/modérateur)
    EN_ATTENTE --> [*]      : DELETE (annulation — ligne supprimée)
    APPROUVEE --> [*]
    REFUSEE --> [*]
```

Une demande en statut `APPROUVEE` ou `REFUSEE` est immuable. L'annulation supprime physiquement la ligne : le client peut donc soumettre une nouvelle demande du même type immédiatement après.

---

## Diagramme de séquence — Soumettre une demande

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/demandes-produits { type_produit }
    API->>API: requireAuth + validateCreateDemandeProduit
    API->>DB: SELECT client_id FROM utilisateurs_clients WHERE utilisateur_id = ?
    alt Aucun client lié
        API-->>C: 403 Aucun profil client
    else
        API->>DB: SELECT 1 FROM demandes_produits WHERE EN_ATTENTE
        alt Doublon
            API-->>C: 409 Demande déjà EN_ATTENTE
        else
            API->>DB: INSERT INTO demandes_produits (...)
            API->>DB: INSERT INTO audit_log (CREATE_DEMANDE_PRODUIT)
            API->>DB: SELECT auto_validation FROM utilisateurs
            alt auto_validation = 1
                API->>DB: BEGIN TRANSACTION — provisionner le produit
                API->>DB: UPDATE demandes_produits SET statut='APPROUVEE'
                API->>DB: INSERT INTO cartes_credit / comptes
                API->>DB: COMMIT
                API->>DB: INSERT INTO audit_log (APPROUVER_DEMANDE_PRODUIT)
                API-->>C: 201 { id, auto_valide: true }
            else
                API-->>C: 201 { id }
            end
        end
    end
```

---

## Diagramme de séquence — Approuver (provisionnement automatique)

```mermaid
sequenceDiagram
    participant A as Admin Browser
    participant API as Express API
    participant DB as MySQL

    A->>API: PATCH /api/demandes-produits/:id/approuver
    API->>API: requireElevated
    API->>DB: SELECT demande WHERE id = ?
    alt Statut ≠ EN_ATTENTE
        API-->>A: 400
    else
        API->>DB: BEGIN TRANSACTION
        API->>DB: UPDATE demandes_produits SET statut = 'APPROUVEE'
        alt Type = CARTE_VISA / CARTE_MASTERCARD
            API->>API: Générer numéro (préfixe 4 ou 5), CVV, date expiration
            API->>DB: INSERT INTO cartes_credit (...)
        else Type = COMPTE_CHEQUES / COMPTE_EPARGNE
            API->>API: Générer numero_compte, numero_transit
            API->>DB: INSERT INTO comptes (...)
        end
        API->>DB: COMMIT
        API->>DB: INSERT INTO audit_log (APPROUVER_DEMANDE_PRODUIT)
        API-->>A: 200 { message }
    end
```

Si l'INSERT du produit échoue (ex : contrainte DB), la transaction est ROLLBACK. Le statut de la demande n'est pas modifié, l'admin peut retenter.

---

## Diagramme de séquence — Annuler une demande (client)

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: DELETE /api/demandes-produits/:id
    API->>API: requireAuth
    API->>DB: SELECT demande WHERE id = ?
    alt Introuvable
        API-->>C: 404
    else Statut ≠ EN_ATTENTE
        API-->>C: 400 Déjà traitée
    else
        alt Rôle UTILISATEUR
            API->>DB: SELECT 1 FROM utilisateurs_clients WHERE ?
            alt Non-propriétaire
                API-->>C: 403
            end
        end
        API->>DB: DELETE FROM demandes_produits WHERE id = ? AND EN_ATTENTE
        alt affectedRows = 0 (race condition)
            API-->>C: 400
        else
            API->>DB: INSERT INTO audit_log (ANNULER_DEMANDE_PRODUIT)
            API-->>C: 200 { message }
        end
    end
```

---

## Modèle de données

Table `demandes_produits` :

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | INT AUTO_INCREMENT | PK |
| `client_id` | INT | FK → `clients.id` ON DELETE CASCADE |
| `type_produit` | ENUM(…) | NOT NULL |
| `statut` | ENUM('EN_ATTENTE','APPROUVEE','REFUSEE') | DEFAULT 'EN_ATTENTE' |
| `notes` | VARCHAR(255) | NULL |
| `limite_credit` | DECIMAL(12,2) | NULL (cartes uniquement) |
| `traite_par` | INT | FK → `utilisateurs.id` ON DELETE SET NULL |
| `cree_le` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `traite_le` | TIMESTAMP | NULL |

Index : `idx_dp_client`, `idx_dp_statut`, `idx_dp_type`.

---

## Règles métier synthèse

- Un client ne peut avoir qu'**une seule demande EN_ATTENTE** par type de produit (contrainte applicative via `hasPendingDemande`).
- L'approbation est **atomique** : statut + création du produit dans la même transaction SQL.
- Le provisionnement réutilise les **mêmes générateurs** (`numero_compte` 3×4 chiffres, numéro de carte préfixé par 4 ou 5) que les endpoints `POST /api/cartes` et `POST /api/comptes`.
- L'annulation est **réversible** au sens applicatif : la ligne est supprimée et le client peut redemander immédiatement.
- Un `MODERATEUR` ne peut pas **soumettre** de demande (middleware `requireNotModerator`) mais peut **approuver/refuser/annuler** (requireElevated / requireAuth).

---

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `database/schema.sql` | Table `demandes_produits` |
| `server/data/demandes_produits.data.js` | Couche d'accès SQL |
| `server/controllers/demandes_produits.controller.js` | Logique métier |
| `server/routes/demandes_produits.routes.js` | Déclaration des routes |
| `server/middlewares/validation.middleware.js` | `validateCreateDemandeProduit` |
| `frontend/src/app/dashboard/produits/page.tsx` | Interface catalogue client |
| `frontend/src/app/dashboard/admin/demandes/page.tsx` | Interface gestion admin |
| `frontend/src/components/CreditCard3D.tsx` | Visuel 3D carte (variant VISA/Mastercard) |
