# Conception — Authentification & Sessions

## Description

Le système d'authentification de LEON BANK repose sur des sessions côté serveur gérées par `express-session` avec un store MySQL. Les mots de passe sont hashés avec `bcryptjs`. Trois rôles existent : `UTILISATEUR`, `MODERATEUR`, `ADMIN`. Un flag `auto_validation` permet de bypasser les approbations manuelles sur les dépôts et retraits.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Système d'authentification
        UC1[S'inscrire]
        UC2[Se connecter]
        UC3[Se déconnecter]
        UC4[Consulter son profil]
        UC5[Créer un modérateur]
        UC6[Lister les modérateurs]
        UC7[Supprimer un modérateur]
        UC8[Consulter les logs d'audit]
    end

    U[Utilisateur non connecté] --> UC1
    U --> UC2
    AU[Utilisateur connecté] --> UC3
    AU --> UC4
    AD[Admin] --> UC5
    AD --> UC6
    AD --> UC7
    AD --> UC8
```

---

## Diagramme de classes

```mermaid
classDiagram
    class Utilisateur {
        -int id
        -String email
        -String motDePasseHash
        -Role role
        -boolean autoValidation
        -Date creeLe
        +login(email: String, motDePasse: String) boolean
        +logout() void
        +register(email: String, motDePasse: String) Utilisateur
    }

    class Session {
        -String sessionId
        -Date expiration
        +estValide() boolean
    }

    class AuditLog {
        -int id
        -String action
        -String details
        -Date creeLe
    }

    class Role {
        <<enumeration>>
        UTILISATEUR
        MODERATEUR
        ADMIN
    }

    Utilisateur "1" --> "0..*" Session : possède
    Utilisateur "1" --> "0..*" AuditLog : génère
    Utilisateur --> Role
```

---

## Diagramme de séquence — Connexion

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/auth/login {email, password}
    API->>DB: SELECT utilisateur WHERE email = ?
    DB-->>API: utilisateur row
    API->>API: bcrypt.compare(password, hash)
    alt Mot de passe correct
        API->>API: req.session.userId = id
        API->>DB: INSERT audit_log (action: LOGIN)
        API-->>C: 200 { id, email, role, auto_validation }
    else Mot de passe incorrect
        API-->>C: 401 { error: "Identifiants invalides" }
    end
```

---

## Diagramme de séquence — Inscription

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/auth/register {email, password}
    API->>DB: SELECT utilisateur WHERE email = ?
    DB-->>API: résultat
    alt Email déjà utilisé
        API-->>C: 409 { error: "Email déjà utilisé" }
    else Email disponible
        API->>API: bcrypt.hash(password, 10)
        API->>DB: INSERT utilisateur (role: UTILISATEUR)
        DB-->>API: insertId
        API-->>C: 201 { id, email, role }
    end
```

---

## Diagramme de séquence — Vérification de session (middleware)

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as auth.middleware
    participant API as Controller

    C->>MW: Requête avec cookie de session
    MW->>MW: Vérifier req.session.userId
    alt Session valide
        MW->>API: next()
        API-->>C: Réponse
    else Session invalide / expirée
        MW-->>C: 401 { error: "Non authentifié" }
    end
```

---

## Flux RBAC (Role-Based Access Control)

```mermaid
flowchart TD
    REQ[Requête entrante] --> AUTH{Session valide ?}
    AUTH -- Non --> R401[401 Unauthorized]
    AUTH -- Oui --> ROLE{Rôle requis ?}
    ROLE -- requireAuth --> OK[Accès accordé]
    ROLE -- requireElevated --> ELEV{ADMIN ou MODERATEUR ?}
    ELEV -- Oui --> OK
    ELEV -- Non --> R403[403 Forbidden]
    ROLE -- requireAdmin --> ADM{ADMIN ?}
    ADM -- Oui --> OK
    ADM -- Non --> R403
```

---

## Schéma de la table `utilisateurs`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| email | VARCHAR(190) | UNIQUE, NOT NULL |
| mot_de_passe_hash | VARCHAR(255) | NOT NULL |
| role | ENUM('UTILISATEUR','MODERATEUR','ADMIN') | DEFAULT 'UTILISATEUR' |
| prenom | VARCHAR(80) | NOT NULL |
| nom | VARCHAR(80) | NOT NULL |
| auto_validation | TINYINT(1) | DEFAULT 0 |
| cree_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-AUTH-01 | L'inscription crée uniquement le rôle `UTILISATEUR` — impossible de s'auto-assigner ADMIN |
| RB-AUTH-02 | Les sessions expirent après 2 heures (`maxAge: 7200000`) |
| RB-AUTH-03 | Seul un `ADMIN` peut créer ou supprimer un modérateur |
| RB-AUTH-04 | Les actions sensibles (login, logout, gestion modérateurs) sont tracées dans `audit_logs` |
| RB-AUTH-05 | Le flag `auto_validation` permet à un utilisateur de bypasser l'approbation manuelle pour les dépôts et retraits |
| RB-AUTH-06 | Un ADMIN ne peut pas être supprimé via l'API publique |
