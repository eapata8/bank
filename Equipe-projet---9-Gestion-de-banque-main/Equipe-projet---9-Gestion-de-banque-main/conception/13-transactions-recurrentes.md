# Conception — Transactions récurrentes

## Description

Permettre aux utilisateurs de planifier des **virements automatiques** répétés
entre deux comptes selon une fréquence (hebdomadaire, mensuelle, annuelle).
Un **scheduler** côté serveur exécute les récurrentes échues toutes les heures
sans intervention humaine, gère les échecs (solde insuffisant) avec un compteur
de tentatives, et suspend automatiquement la récurrente après 3 échecs.

Les statuts possibles sont : `ACTIVE`, `SUSPENDUE`, `ANNULEE`, `TERMINEE`.

---

## Diagramme de cas d'utilisation

```mermaid
graph TD
    subgraph Récurrentes
        UC1[Créer une récurrente]
        UC2[Voir ses récurrentes]
        UC3[Suspendre une récurrente]
        UC4[Reprendre une récurrente]
        UC5[Annuler une récurrente]
        UC6[Voir toutes les récurrentes - admin]
        UC7[Exécution automatique horaire]
    end

    U[Utilisateur] --> UC1
    U --> UC2
    U --> UC3
    U --> UC4
    U --> UC5
    ADM[Admin] --> UC1
    ADM --> UC3
    ADM --> UC4
    ADM --> UC5
    ADM --> UC6
    SYS[Scheduler système] --> UC7
```

> Les MODÉRATEURS n'ont **aucun** accès aux transactions récurrentes :
> il s'agit d'une opération financière initiée par le client.

---

## Diagramme de classes

```mermaid
classDiagram
    class TransactionRecurrente {
        -int id
        -int utilisateur_id
        -int compte_source_id
        -int compte_destination_id
        -double montant
        -String description
        -Frequence frequence
        -Date prochaine_execution
        -Date derniere_execution
        -Date date_fin
        -int nb_echecs
        -StatutRecurrente statut
        -Date cree_le
    }

    class Frequence {
        <<enumeration>>
        HEBDOMADAIRE
        MENSUEL
        ANNUEL
    }

    class StatutRecurrente {
        <<enumeration>>
        ACTIVE
        SUSPENDUE
        ANNULEE
        TERMINEE
    }

    class Compte {
        -int id
        -String numero_compte
        -double solde
    }

    class Scheduler {
        +setIntervalHoraire()
        +executerRecurrentesEchues()
        +calculerProchaineDate(frequence, date)
    }

    TransactionRecurrente --> Frequence
    TransactionRecurrente --> StatutRecurrente
    TransactionRecurrente "0..*" --> "1" Compte : source
    TransactionRecurrente "0..*" --> "1" Compte : destination
    Scheduler ..> TransactionRecurrente : exécute
```

---

## Diagramme de séquence — Création

```mermaid
sequenceDiagram
    participant C as Client Browser
    participant API as Express API
    participant DB as MySQL

    C->>API: POST /api/recurrentes { compte_source_id, compte_destination_id, montant, frequence, date_debut?, date_fin? }
    API->>API: requireAuth + requireNotModerator
    API->>API: validateCreateRecurrente (champs, montant > 0, src ≠ dest)
    API->>DB: SELECT compte source WHERE id = ? AND utilisateur_id = ?

    alt Compte source non autorisé
        API-->>C: 403 { message }
    end

    API->>DB: SELECT compte destination WHERE id = ?

    alt Compte destination introuvable
        API-->>C: 404 { message }
    else Valide
        API->>API: calculerProchaine(date_debut ?? today, frequence)
        API->>DB: INSERT INTO transactions_recurrentes (statut: ACTIVE)
        API->>DB: INSERT INTO audit_logs (RECURRENTE_CREEE)
        API-->>C: 201 { id }
    end
```

---

## Diagramme de séquence — Exécution par le scheduler

```mermaid
sequenceDiagram
    participant Cron as setInterval (1h)
    participant SCH as Scheduler
    participant DB as MySQL

    Cron->>SCH: tick horaire
    SCH->>DB: SELECT * FROM transactions_recurrentes WHERE statut='ACTIVE' AND prochaine_execution <= CURDATE()

    loop Pour chaque récurrente échue
        SCH->>DB: SELECT solde compte_source

        alt Solde suffisant
            SCH->>DB: UPDATE compte_source SET solde = solde - montant
            SCH->>DB: UPDATE compte_destination SET solde = solde + montant
            SCH->>DB: INSERT transactions (débit + crédit)
            SCH->>DB: UPDATE recurrente SET prochaine_execution = +1 période, derniere_execution = today, nb_echecs = 0
            SCH->>DB: INSERT audit_logs (RECURRENTE_EXECUTEE)
        else Solde insuffisant
            SCH->>DB: UPDATE recurrente SET nb_echecs = nb_echecs + 1, prochaine_execution = +1 période
            SCH->>DB: INSERT audit_logs (RECURRENTE_ECHEC)
            alt nb_echecs >= 3
                SCH->>DB: UPDATE recurrente SET statut = 'SUSPENDUE'
            end
        end

        alt date_fin && prochaine_execution > date_fin
            SCH->>DB: UPDATE recurrente SET statut = 'TERMINEE'
        end
    end
```

---

## Flowchart — Cycle de vie

```mermaid
flowchart TD
    START([Création]) --> ACTIVE[ACTIVE]
    ACTIVE -- suspendre --> SUSPENDUE[SUSPENDUE]
    ACTIVE -- 3 échecs consécutifs --> SUSPENDUE
    SUSPENDUE -- reprendre --> ACTIVE
    ACTIVE -- annuler --> ANNULEE([ANNULEE])
    SUSPENDUE -- annuler --> ANNULEE
    ACTIVE -- prochaine > date_fin --> TERMINEE([TERMINEE])
```

---

## Flowchart — Calcul de la prochaine date

```mermaid
flowchart TD
    START([prochaine_execution actuelle + frequence]) --> F{Quelle fréquence ?}
    F -- HEBDOMADAIRE --> H[date + 7 jours]
    F -- MENSUEL --> M[date + 1 mois]
    F -- ANNUEL --> A[date + 1 an]

    M --> ENDM{Le jour existe<br/>dans le nouveau mois ?}
    ENDM -- Non --> CLAMP[Ramener au dernier jour du mois<br/>ex. 31 jan → 28/29 fév]
    ENDM -- Oui --> OK1[Conserver le jour]

    A --> ENDA{29 fév sur année non bissextile ?}
    ENDA -- Oui --> CLAMP2[Ramener au 28 fév]
    ENDA -- Non --> OK2[Conserver le jour]

    H --> RESULT([Nouvelle prochaine_execution])
    CLAMP --> RESULT
    OK1 --> RESULT
    CLAMP2 --> RESULT
    OK2 --> RESULT
```

---

## Schéma de la table `transactions_recurrentes`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | INT | PK, AUTO_INCREMENT |
| utilisateur_id | INT | FK → utilisateurs.id, NOT NULL |
| compte_source_id | INT | FK → comptes.id, NOT NULL |
| compte_destination_id | INT | FK → comptes.id, NOT NULL |
| montant | DECIMAL(12,2) | NOT NULL, > 0 |
| description | VARCHAR(255) | nullable |
| frequence | ENUM('HEBDOMADAIRE','MENSUEL','ANNUEL') | NOT NULL |
| prochaine_execution | DATE | NOT NULL |
| derniere_execution | DATE | nullable |
| date_fin | DATE | nullable (null = pas de fin) |
| nb_echecs | INT | DEFAULT 0 |
| statut | ENUM('ACTIVE','SUSPENDUE','ANNULEE','TERMINEE') | DEFAULT 'ACTIVE' |
| cree_le | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| RB-REC-01 | Le compte source doit appartenir à l'utilisateur créateur |
| RB-REC-02 | Le compte destination peut appartenir à n'importe quel utilisateur |
| RB-REC-03 | `compte_source_id` ≠ `compte_destination_id` |
| RB-REC-04 | `montant` doit être strictement positif |
| RB-REC-05 | La fréquence doit être une valeur valide (HEBDOMADAIRE / MENSUEL / ANNUEL) |
| RB-REC-06 | Le virement n'est PAS exécuté immédiatement à la création |
| RB-REC-07 | Le scheduler tourne au démarrage du serveur puis toutes les heures |
| RB-REC-08 | Sur échec d'exécution, `nb_echecs += 1` et la date avance quand même |
| RB-REC-09 | Une récurrente passe à `SUSPENDUE` automatiquement après 3 échecs |
| RB-REC-10 | Une récurrente `ANNULEE` ou `TERMINEE` ne peut plus être relancée |
| RB-REC-11 | L'ADMIN peut suspendre/reprendre/annuler la récurrente de n'importe qui |
| RB-REC-12 | MODÉRATEUR n'a aucun accès aux récurrentes |
| RB-REC-13 | Le calcul mensuel gère la fin de mois (31 jan → 28/29 fév) |
| RB-REC-14 | Le calcul annuel gère le 29 fév en année non bissextile |
| RB-REC-15 | Chaque exécution réussie génère 2 transactions (débit + crédit) et un audit log |

---

## Audit

| Action | Déclencheur |
|--------|-------------|
| `RECURRENTE_CREEE` | Création d'une nouvelle récurrente |
| `RECURRENTE_SUSPENDUE` | Suspension manuelle |
| `RECURRENTE_REPRISE` | Reprise manuelle |
| `RECURRENTE_ANNULEE` | Annulation manuelle |
| `RECURRENTE_EXECUTEE` | Exécution réussie par le scheduler |
| `RECURRENTE_ECHEC` | Échec d'exécution (solde insuffisant) |

---

## Décisions techniques

| Décision | Justification |
|----------|---------------|
| `setInterval` 1h plutôt que cron OS | Pas de dépendance externe, démarre avec le serveur |
| Avancer la date même sur échec | Évite les boucles infinies sur un compte vide |
| Suspension auto à 3 échecs | Stoppe les notifications/audit inutiles, force action utilisateur |
| `prochaines_executions` calculé à la lecture | Pas besoin de matérialiser N dates en DB |
| Validation 2 couches | Middleware (`validateCreateRecurrente`) + contrôleur (autorisation compte) |
| MODÉRATEUR exclu | Une récurrente est un mandat permanent du client |

---

## Référence

- API : `documentation API/recurrentes.md`
- Documentation fonctionnelle : `docs/transactions-recurrentes.md`
- Code : `server/data/recurrentes.data.js`, `server/controllers/recurrentes.controller.js`, `server/scheduler.js`
