# Frontend — Leon Bank

## Stack technique

| Technologie | Version | Rôle |
|-------------|---------|------|
| Next.js | 15 | Framework React — App Router, SSR |
| React | 19 | Bibliothèque UI |
| TypeScript | 5 | Typage statique |
| Tailwind CSS | v4 | Utilitaires CSS |
| Axios | — | Client HTTP via helpers `lib/api.ts` |

## Structure des dossiers

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Redirige vers /dashboard (session active) ou /login
│   │   ├── login/page.tsx              # Connexion + inscription (deux onglets)
│   │   └── dashboard/
│   │       ├── layout.tsx              # AppShell — AuthGate + sidebar + header
│   │       ├── page.tsx                # Tableau de bord
│   │       ├── clients/page.tsx
│   │       ├── comptes/page.tsx
│   │       ├── virements/page.tsx
│   │       ├── factures/page.tsx
│   │       ├── cartes/page.tsx
│   │       ├── depots/page.tsx
│   │       ├── retraits/page.tsx
│   │       ├── interac/page.tsx
│   │       └── admin/page.tsx
│   ├── components/
│   │   ├── AppShell.tsx                # Navigation, sidebar, header, AuthGate
│   │   └── ui/                        # Composants réutilisables
│   ├── context/
│   │   └── AuthContext.tsx             # useAuth() — user, logout()
│   └── lib/
│       ├── api.ts                      # apiGet, apiPost, apiPatch, apiDelete
│       └── types.ts                    # Types TypeScript partagés
├── next.config.ts                      # Proxy /api/* → Express :5000
└── package.json
```

---

## Authentification

### AuthContext
Expose `user` (id, email, role, prenom, nom, auto_validation) et `logout()` via `useAuth()`. La session est vérifiée via `GET /api/auth/me` au montage du layout dashboard. Si la réponse est `401`, l'utilisateur est redirigé vers `/`.

### AuthGate
Composant intégré dans `AppShell` — si `user` est `null` en fin de chargement, redirige vers `/`. Empêche tout flash de contenu non autorisé.

### Navigation par rôle

| Section | UTILISATEUR | MODÉRATEUR | ADMIN |
|---------|:-----------:|:----------:|:-----:|
| Mes comptes | ✓ | — | — |
| Clients | — | ✓ | ✓ |
| Virements | ✓ | ✓ | ✓ |
| Factures | ✓ | ✓ | ✓ |
| Cartes | ✓ | ✓ | ✓ |
| Dépôts | ✓ | ✓ | ✓ |
| Retraits | ✓ | ✓ | ✓ |
| Interac | ✓ | ✓ | ✓ |
| Utilisateurs | — | ✓ | ✓ |
| Administration | — | — | ✓ |

---

## Communication avec le backend

Toutes les requêtes passent par `src/lib/api.ts` :

```typescript
apiGet<T>(path: string): Promise<T>
apiPost<T>(path: string, body: object): Promise<T>
apiPatch<T>(path: string, body: object): Promise<T>
apiDelete<T>(path: string): Promise<T>
```

Le proxy `next.config.ts` redirige `/api/*` vers `http://localhost:5000/api/*`. Les cookies de session sont transmis automatiquement (`withCredentials: true`).

---

## Patterns UI communs

### Chargement des données
Chaque page charge ses données dans un `useEffect` au montage. Pendant le chargement, un indicateur visuel (spinner ou skeleton) est affiché. En cas d'erreur, un message d'erreur apparaît à la place du contenu.

```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

useEffect(() => {
  apiGet("/comptes")
    .then(res => setData(res.data))
    .catch(() => setError("Impossible de charger les données"))
    .finally(() => setLoading(false));
}, []);
```

### Gestion d'état local
Pas de Redux ni Zustand. L'état est géré localement dans chaque page avec `useState`. Après une action (paiement, annulation, envoi), les données sont rechargées via un appel API supplémentaire pour garantir la cohérence avec la base.

### Modals de confirmation
Les actions destructives ou irréversibles (annuler un virement Interac, supprimer un utilisateur, rejeter un dépôt) passent par une modal de confirmation avant d'appeler l'API. La modal affiche le détail de l'action et un bouton de confirmation.

### Badges de statut
Les statuts sont affichés avec des badges colorés :

| Statut | Couleur |
|--------|---------|
| `EN_ATTENTE` | Jaune/orange |
| `ACCEPTEE` / `APPROUVE` / `PAYEE` / `ACTIVE` | Vert |
| `ANNULEE` / `REJETE` / `BLOQUEE` | Rouge |
| `EXPIREE` / `GELEE` | Gris |

### Formulaires
Les formulaires utilisent l'état local React (`useState` par champ). La validation côté client vérifie les champs obligatoires avant l'envoi. Les erreurs retournées par l'API sont affichées sous le formulaire.

---

## Description des pages

### Login (`/login`)
Deux onglets : **Connexion** (email + mot de passe) et **Inscription** (email + mot de passe + prénom + nom). En cas de succès, redirige vers `/dashboard`. Les erreurs API (mauvais mot de passe, email déjà pris) sont affichées inline.

---

### Tableau de bord (`/dashboard`)
Vue de synthèse au chargement :
- Liste des comptes de l'utilisateur avec solde en temps réel
- Dernières transactions de chaque compte
- Indicateur de consommation des limites Interac (si des envois ont eu lieu)

---

### Clients (`/dashboard/clients`)
**MODÉRATEUR / ADMIN uniquement.**
- Liste de tous les clients avec recherche par nom
- Formulaire de création : prénom, nom, email fictif, ville, utilisateur lié
- Clic sur un client → liste de ses comptes avec possibilité d'ouvrir un nouveau compte (type + last_four)

---

### Comptes (`/dashboard/comptes`)
- **UTILISATEUR** : liste de ses propres comptes
- **MOD / ADMIN** : liste globale avec filtre de recherche (nom, numéro, type, statut)
- Clic sur un compte → vue détail avec **deux onglets** :
  - **Transactions** : historique trié du plus récent, avec type, libellé, montant (positif = crédit, négatif = débit), date
  - **Récurrentes** : liste des virements planifiés dont ce compte est la source — statut, montant, fréquence, prochaines dates. Boutons selon le statut :
    - `ACTIVE` → [Suspendre] [Annuler]
    - `SUSPENDUE` → [Reprendre] [Annuler]
    - `ANNULEE` / `TERMINEE` → lecture seule
  - Bouton **"+ Ajouter un paiement récurrent"** → formulaire : compte destination, montant, description optionnelle, fréquence, date de début optionnelle, date de fin optionnelle
- **ADMIN** : actions disponibles sur chaque compte (ajuster solde, bloquer, changer type, insérer/supprimer transaction)
- **ADMIN** : dans l'onglet Récurrentes, bouton "Créer un paiement récurrent" pour ce client, et accès Suspendre/Reprendre/Annuler sur toutes les récurrentes (via `GET /api/recurrentes/admin/all` filtré sur `compte_source_id`)

---

### Virements (`/dashboard/virements`)
Deux sections :
- **Formulaire d'envoi** : sélection compte source, choix interne (compte destination dans la liste) ou externe (numéro + institution + transit + SWIFT), montant, description optionnelle
- **Historique** : tableau des virements avec statut, montant, comptes impliqués, date — MOD/ADMIN voient tous les virements

---

### Factures (`/dashboard/factures`)
- Liste des factures avec statut (`EN_ATTENTE` / `PAYEE`), fournisseur, montant, date d'échéance
- Clic sur une facture EN_ATTENTE → modal de paiement : sélection du compte à débiter + confirmation
- **ADMIN** : formulaire de création de facture (client, fournisseur, montant, échéance, description)

---

### Cartes de crédit (`/dashboard/cartes`)
- Liste des cartes avec statut, numéro masqué, limite, solde dû, date d'expiration
- **Gel / dégel** : bouton direct sur la carte (`ACTIVE` → `GELEE` et inversement), sans confirmation admin
- **Remboursement** : modal avec champ montant (max = solde dû), sélection du compte source
- **ADMIN** : création de carte, blocage/réactivation administratif, modification de limite

---

### Dépôts de chèques (`/dashboard/depots`)
- **UTILISATEUR** : formulaire de soumission (compte destination, montant, numéro de chèque, banque origine, photo uploadée)
- Liste de ses dépôts avec statut et motif de rejet si applicable
- **MOD / ADMIN** : liste globale, boutons Approuver / Rejeter (champ motif obligatoire pour le rejet)

---

### Retraits (`/dashboard/retraits`)
- **UTILISATEUR** : formulaire de soumission (compte source, montant max 1 000 $, description optionnelle)
- Liste de ses retraits avec statut
- **MOD / ADMIN** : liste globale, boutons Approuver / Rejeter avec champ motif

---

### Interac e-Transfer (`/dashboard/interac`)
Organisée en trois onglets :

| Onglet | Contenu |
|--------|---------|
| **Historique** | Tableau des transferts envoyés — statut, destinataire, montant, date. Bouton "Annuler" sur les EN_ATTENTE (modal de confirmation avant appel API). |
| **À réclamer** | Transferts EN_ATTENTE à l'adresse email de l'utilisateur. Bouton "Réclamer" → modal : sélection du compte de réception + saisie du mot de passe. |
| **Auto-dépôt** | Statut du profil (actif / en attente / inactif). Formulaire d'activation en 2 étapes : email + compte → code à 6 chiffres. Bouton "Désactiver" si actif. |

En haut de page :
- Formulaire d'envoi : compte source, email destinataire, montant, mot de passe (optionnel si destinataire a l'auto-dépôt), description optionnelle
- Bloc des limites effectives : barre de progression 24h / 7j / 30j, badge PERSO si personnalisées par l'admin

---

### Administration (`/dashboard/admin`)
**ADMIN uniquement.** Organisée en sections via des onglets ou sous-menus :

| Section | Fonctionnalités |
|---------|----------------|
| **Comptes** | Recherche globale, ajustement de solde, blocage/déblocage, changement de type, insertion/suppression de transaction |
| **Virements** | Liste globale, insertion manuelle, suppression avec reversal, transfert forcé |
| **Utilisateurs** | Liste, création mod/admin, changement de rôle, réinitialisation de mot de passe, suppression, toggle auto_validation |
| **Audit** | Journal complet avec filtres (action, date, utilisateur) + bouton export CSV |
| **Interac** | Par client : historique, stats de consommation, statut auto-dépôt, modification des limites personnalisées |

---

## Proxy Next.js

```typescript
// next.config.ts
rewrites: async () => [
  { source: "/api/:path*", destination: "http://localhost:5000/api/:path*" }
]
```

## Scripts

```bash
npm run dev      # Développement (port 3000, webpack, NODE_OPTIONS=--max-old-space-size=768)
npm run build    # Build de production
npm run start    # Production
```
