# Transactions récurrentes

## Objectif

Permettre aux utilisateurs de configurer des virements automatiques répétés à une fréquence définie (hebdomadaire, mensuelle, annuelle) entre deux comptes. Un scheduler côté serveur exécute les virements échus toutes les heures sans intervention humaine.

## Accès par rôle

| Fonctionnalité | UTILISATEUR | MODÉRATEUR | ADMIN |
|----------------|:-----------:|:----------:|:-----:|
| Créer une récurrente | ✓ | — | ✓ |
| Voir ses propres récurrentes | ✓ | — | ✓ |
| Voir toutes les récurrentes | — | — | ✓ |
| Suspendre / reprendre / annuler | ✓ (les siennes) | — | ✓ (toutes) |

Les MODÉRATEURS n'ont pas accès aux transactions récurrentes (opération financière initiée par le client).

## Fréquences disponibles

| Fréquence | Intervalle | Exemple |
|-----------|-----------|---------|
| `HEBDOMADAIRE` | +7 jours exact | 15 avr → 22 avr |
| `MENSUEL` | +1 mois (gérant la fin de mois) | 31 jan → 28 fév (ou 29 en bissextile) |
| `ANNUEL` | +1 an (gérant le 29 fév) | 29 fév 2024 → 28 fév 2025 |

## Workflow de création

```
POST /api/recurrentes { compte_source_id, compte_destination_id, montant, frequence, date_debut?, date_fin? }
  → Validation champs obligatoires
  → Vérification compte source appartient à l'utilisateur
  → Vérification compte destination existe
  → Calcul prochaine_execution (date_debut ou today + 1 période)
  → INSERT transactions_recurrentes (statut: ACTIVE)
  → Audit RECURRENTE_CREEE
  → 201 { id }
```

## Exécution automatique (scheduler)

Le scheduler s'exécute **au démarrage du serveur** puis **toutes les heures** via `setInterval`.

```
findRecurrentesEchues() — WHERE statut='ACTIVE' AND prochaine_execution <= CURDATE()
  Pour chaque récurrente échue :
    Solde suffisant ?
      OUI → débit source + crédit destination + créer 2 transactions + avancer la date
      NON → incrémenter nb_echecs, avancer la date quand même
              nb_echecs >= 3 → statut SUSPENDUE automatiquement
    date_fin && prochaine > date_fin → statut TERMINEE
```

## Machine d'états

```
                  ┌──────────┐
   [Création]     │  ACTIVE  │◄──── reprendre ─────┐
   ─────────────► │          │                     │
                  └────┬─────┘                     │
                       │                    ┌──────┴──────┐
           suspendre / │ 3 échecs           │  SUSPENDUE  │
                       │                    └──────┬──────┘
                  ┌────▼─────┐                     │
                  │ SUSPENDUE│─────── annuler ──────┤
                  └──────────┘                     │
                                                   │
              date_fin dépassée              ┌──────▼──────┐
              ─────────────────────────────► │   ANNULEE   │
                                             └─────────────┘
                                             ┌─────────────┐
              scheduler détecte fin ────────►│  TERMINEE   │
                                             └─────────────┘
```

## Gestion des échecs

Quand le solde du compte source est insuffisant au moment de l'exécution :
- `nb_echecs` est incrémenté de 1
- La `prochaine_execution` avance normalement (la récurrente ne retente pas la même date)
- Si `nb_echecs >= 3` : la récurrente passe automatiquement à `SUSPENDUE`
- L'utilisateur peut consulter `nb_echecs` pour diagnostiquer le problème
- **Reprendre** une récurrente suspendue ne remet pas `nb_echecs` à 0 via l'API (le reset est géré à la prochaine exécution réussie)

## Affichage des dates planifiées

Chaque réponse de `GET /api/recurrentes` inclut un champ calculé côté serveur :

```json
{
  "prochaines_executions": ["2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15", "2026-09-15"]
}
```

Ces 5 dates sont calculées en JS pur à partir de `prochaine_execution` et de la `frequence`, sans requête DB supplémentaire.

## Règles métier

- Le compte source doit appartenir à l'utilisateur créateur
- Le compte destination peut appartenir à n'importe quel utilisateur du système
- Source ≠ destination (comptes différents obligatoires)
- Montant strictement positif
- Le virement n'est PAS exécuté immédiatement à la création : la première exécution se fait à `prochaine_execution`
- Une récurrente TERMINEE ou ANNULEE ne peut pas être relancée
- Un ADMIN peut suspendre / reprendre / annuler la récurrente de n'importe quel utilisateur

## Données de démonstration

Disponibles après `npm run db:init` :

| Utilisateur | Source | Destination | Montant | Fréquence | Statut |
|-------------|--------|-------------|---------|-----------|--------|
| user@Leon.local | CHEQUES | EPARGNE | 500 $ | MENSUEL | ACTIVE |
| sarah.clark@Leon.local | CHEQUES | EPARGNE | 1 200 $ | HEBDOMADAIRE | SUSPENDUE (3 échecs) |
| marc.roy@Leon.local | CHEQUES | EPARGNE | 250 $ | ANNUEL | ACTIVE |
| lina.nguyen@Leon.local | CHEQUES | EPARGNE | 300 $ | MENSUEL | ANNULEE |

## Audit

| Action | Déclencheur |
|--------|-------------|
| `RECURRENTE_CREEE` | Création d'une nouvelle récurrente |
| `RECURRENTE_SUSPENDUE` | Suspension manuelle |
| `RECURRENTE_REPRISE` | Reprise manuelle |
| `RECURRENTE_ANNULEE` | Annulation manuelle |
| `RECURRENTE_EXECUTEE` | Exécution réussie par le scheduler |
| `RECURRENTE_ECHEC` | Échec d'exécution (solde insuffisant) |

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `database/migration_transactions_recurrentes.sql` | Migration SQL — table dédiée |
| `database/schema.sql` | Schéma complet (table `transactions_recurrentes`) |
| `server/data/recurrentes.data.js` | Repository (6 fonctions SQL) |
| `server/controllers/recurrentes.controller.js` | Logique métier + calcul des dates |
| `server/routes/recurrentes.routes.js` | Déclaration des routes Express |
| `server/scheduler.js` | Exécution automatique des récurrentes échus |
| `server/index.js` | Montage `/api/recurrentes` + démarrage scheduler |

## Référence API

Voir `documentation API/recurrentes.md`.
