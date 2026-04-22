# Tests — Leon Bank

## Stratégie

Le projet utilise **Jest 30** avec `--experimental-vm-modules` pour la compatibilité ES Modules natifs (le backend est écrit en ESM pur).

- **Backend (controllers + repositories)** : tests unitaires — toutes les dépendances (DB, bcrypt, sessions) sont mockées avec `jest.unstable_mockModule`. Aucune connexion réelle à la base de données.
- **Middlewares** : tests unitaires des fonctions `requireAuth`, `requireElevated`, `requireAdmin`.
- **Frontend** : tests de composants React avec **React Testing Library** — les appels API (`apiGet`, `apiPost`, etc.) et le contexte auth (`useAuth`) sont mockés.

## Couverture

| Couche | Statements | Branches | Fonctions | Lines |
|--------|-----------|---------|-----------|-------|
| `server/controllers` | 100 % | 100 % | 100 % | 100 % |
| `server/data` | 100 % | 100 % | 100 % | 100 % |
| `server/middlewares` | 100 % | 100 % | 100 % | 100 % |

Total : **833 assertions**, **37 suites de tests**.

## Structure et suites

```
tests/
├── controller/
│   ├── auth.controller.test.js          → register, login, logout, me, logs, createMod, createAdmin
│   ├── comptes.controller.test.js       → getComptes, getCompteById, createCompte, getTransactions
│   ├── virements.controller.test.js     → getVirements, createVirement, createVirementExterne
│   ├── factures.controller.test.js      → getFactures, getFactureById, createFacture, payerFacture
│   ├── cartes.controller.test.js        → getCartes, createCarte, rembourser, geler, bloquer, limite
│   ├── depots.controller.test.js        → getDepots, createDepot, approuver, rejeter
│   ├── retraits.controller.test.js      → getRetraits, createRetrait, approuver, rejeter
│   ├── interac.controller.test.js       → sendTransfert, reclamerTransfert, annulerTransfert,
│   │                                      getAutodeposit, createAutodeposit, confirmerAutodeposit,
│   │                                      deleteAutodeposit, getLimites, adminGetTransferts,
│   │                                      adminGetStats, adminGetAutodeposit, adminSetAutodeposit,
│   │                                      adminDeleteAutodeposit, adminGetLimites, adminSetLimites
│   ├── admin.controller.test.js         → adjustBalance, blockCompte, changeType, insertTransaction,
│   │                                      deleteTransaction, insertVirement, deleteVirement,
│   │                                      forceTransfer, getUtilisateurs, deleteUser, changeRole,
│   │                                      resetPassword, autoValidation
│   └── export.controller.test.js        → exportAudit, exportUtilisateurs, exportClients,
│                                          exportVirements, exportTransactions
│
├── repository/
│   ├── auth.data.test.js                → findUserByEmail, createUser, createAuditLog, getAuditLogs
│   ├── comptes.data.test.js             → findComptes, findCompteById, createCompte, findTransactions
│   ├── virements.data.test.js           → findVirements, createVirement, findCompteByCoords
│   ├── factures.data.test.js            → findFactures, findFactureById, createFacture, payerFacture
│   ├── cartes.data.test.js              → findCartes, createCarte, updateStatut, updateLimite
│   ├── depots.data.test.js              → findDepots, createDepot, approuverDepot, rejeterDepot
│   ├── retraits.data.test.js            → findRetraits, createRetrait, approuver, rejeter
│   ├── interac.data.test.js             → findInteracTransferts, findTransfertById,
│   │                                      createInteracTransfert, updateStatutTransfert,
│   │                                      findActiveAutoDepositByEmail, getAutodeposit,
│   │                                      createOrUpdateAutodeposit, activerAutodeposit,
│   │                                      deleteAutodeposit, getLimitesInteracParUtilisateur,
│   │                                      getLimitesInteracParClient, setLimitesInteracParClient,
│   │                                      getCumulInterac
│   ├── admin.data.test.js               → toutes les fonctions d'accès admin
│   └── export.data.test.js              → requêtes d'export CSV
│
├── middlewares/
│   └── auth.middleware.test.js          → requireAuth (avec/sans session), requireElevated,
│                                          requireAdmin (rôles valides et invalides)
│
└── frontend/
    ├── login.page.test.jsx              → formulaire connexion, inscription, erreurs
    ├── comptes.page.test.jsx            → liste des comptes, détail, transactions
    ├── virements.page.test.jsx          → virement interne, externe, historique
    ├── factures.page.test.jsx           → liste, paiement, création admin
    ├── cartes.page.test.jsx             → liste, gel, remboursement
    ├── depots.page.test.jsx             → soumission, approbation, rejet
    ├── retraits.page.test.jsx           → soumission, approbation, rejet
    ├── interac.page.test.jsx            → envoi, réclamation, annulation, auto-dépôt (2 étapes),
    │                                      onglets (historique / à réclamer), modal d'annulation,
    │                                      affichage des limites effectives
    └── admin.page.test.jsx              → gestion comptes, utilisateurs, audit, export CSV
```

## Commandes

```bash
# Tous les tests
npm test

# Avec rapport de couverture (généré dans coverage/)
npm run test:coverage

# Mode watch (relance à chaque modification)
npm run test:watch

# Un fichier ou un pattern spécifique
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --config jest.config.cjs --testPathPatterns "interac"
```

## Configuration Jest

Fichier : `jest.config.cjs`

```js
{
  testEnvironment: "node",           // backend
  testEnvironment: "jsdom",          // frontend (jest-environment-jsdom)
  transform: { ... },                // babel-jest pour JSX
  moduleNameMapper: { "@/": "src/" } // alias TypeScript
}
```

## Approche des mocks — Backend

```js
// Exemple type controller test
const { mockFn } = await import("../data/module.data.js");
jest.unstable_mockModule("../data/module.data.js", () => ({
  maFonction: mockFn,
}));

beforeEach(() => jest.clearAllMocks());

it("cas nominal", async () => {
  mockFn.mockResolvedValueOnce({ insertId: 1 });
  await controller.maRoute(req, res);
  expect(res.status).toHaveBeenCalledWith(201);
});
```

- `jest.unstable_mockModule` est requis pour les modules ES (import/export)
- Chaque test déclare ses retours avec `mockResolvedValueOnce` (ordre FIFO)
- `jest.clearAllMocks()` dans `beforeEach` — pas de fuite entre les tests

## Approche des mocks — Frontend

```jsx
jest.mock("@/lib/api", () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiDelete: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, role: "UTILISATEUR", email: "user@Leon.local" } }),
}));

beforeEach(() => {
  // Les 5 appels GET au montage de la page Interac (ordre FIFO)
  mockApiGet
    .mockResolvedValueOnce({ data: [] })         // GET /interac
    .mockResolvedValueOnce({ data: comptes })    // GET /comptes
    .mockResolvedValueOnce({ data: [] })         // GET /interac/a-reclamer
    .mockResolvedValueOnce({ data: null })       // GET /interac/autodeposit
    .mockResolvedValueOnce({ data: limites });   // GET /interac/limites
});
```

**Points critiques RTL :**
- Les boutons avec badge (`À réclamer 1`) : utiliser `findByRole("button", { name: /À réclamer/ })` plutôt que `findByText("À réclamer")`
- Éléments multiples : `getAllByText()` si un texte apparaît dans plusieurs nœuds DOM
- Ordre des boutons : `getAllByRole("button", { name: "Annuler" })[0]` — le premier dans le DOM est le bouton du modal, le second est dans le tableau d'historique
