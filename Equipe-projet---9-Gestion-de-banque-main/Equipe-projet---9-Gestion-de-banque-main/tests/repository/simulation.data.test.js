import { jest } from "@jest/globals";

// ─── Mock de la connexion dédiée (getConnection) ──────────────────────────────

const mockConnQuery          = jest.fn();
const mockConnRelease        = jest.fn();
const mockConnBeginTx        = jest.fn().mockResolvedValue(undefined);
const mockConnCommit         = jest.fn().mockResolvedValue(undefined);
const mockConnRollback       = jest.fn().mockResolvedValue(undefined);
const mockGetConnection = jest.fn().mockResolvedValue({
  query:            mockConnQuery,
  release:          mockConnRelease,
  beginTransaction: mockConnBeginTx,
  commit:           mockConnCommit,
  rollback:         mockConnRollback,
});

// ─── Mock du pool principal ───────────────────────────────────────────────────

const mockQuery = jest.fn();

await jest.unstable_mockModule("../../server/db.js", () => ({
  default: {
    query:         mockQuery,
    getConnection: mockGetConnection,
  },
}));

const {
  captureSnapshot,
  findSnapshots,
  findSnapshotById,
  restaurerSnapshot,
  deleteSnapshot,
  CLIENT_SNAPSHOT_TABLES,
} = await import("../../server/data/simulation.data.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConnection.mockResolvedValue({
    query:            mockConnQuery,
    release:          mockConnRelease,
    beginTransaction: mockConnBeginTx,
    commit:           mockConnCommit,
    rollback:         mockConnRollback,
  });
  mockConnQuery.mockResolvedValue([[], {}]);
  mockConnBeginTx.mockResolvedValue(undefined);
  mockConnCommit.mockResolvedValue(undefined);
  mockConnRollback.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT_SNAPSHOT_TABLES
// ─────────────────────────────────────────────────────────────────────────────

describe("CLIENT_SNAPSHOT_TABLES", () => {
  it("contient les 11 tables attendues", () => {
    expect(CLIENT_SNAPSHOT_TABLES).toHaveLength(11);
    expect(CLIENT_SNAPSHOT_TABLES).toContain("clients");
    expect(CLIENT_SNAPSHOT_TABLES).toContain("comptes");
    expect(CLIENT_SNAPSHOT_TABLES).toContain("transactions");
    expect(CLIENT_SNAPSHOT_TABLES).toContain("factures");
    expect(CLIENT_SNAPSHOT_TABLES).toContain("interac_beneficiaires");
    expect(CLIENT_SNAPSHOT_TABLES).toContain("interac_autodeposit");
  });

  it("ne contient pas les tables système exclues", () => {
    expect(CLIENT_SNAPSHOT_TABLES).not.toContain("utilisateurs");
    expect(CLIENT_SNAPSHOT_TABLES).not.toContain("audit_logs");
    expect(CLIENT_SNAPSHOT_TABLES).not.toContain("simulation_snapshots");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// captureSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("captureSnapshot", () => {
  it("insère l'en-tête du snapshot avec client_id et retourne le résultat MySQL", async () => {
    // Appels : INSERT header → SELECT compteIds → SELECT clients → SELECT comptes
    //         → (pas de tx/vir car 0 comptes) → SELECT factures → ... → 9 INSERT data
    mockQuery
      .mockResolvedValueOnce([{ insertId: 42 }])  // INSERT snapshot header
      .mockResolvedValueOnce([[]])                 // SELECT id FROM comptes (0 comptes)
      .mockResolvedValue([[]])                     // tout le reste
      ;

    const result = await captureSnapshot({
      nom: "Test A",
      description: "desc",
      creePar: 1,
      clientId: 5,
      estInitial: false,
    });

    expect(result.insertId).toBe(42);
    // Vérifier que l'INSERT header contient client_id
    expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO simulation_snapshots/);
    expect(mockQuery.mock.calls[0][1]).toEqual(["Test A", "desc", 0, 1, 5]);
  });

  it("appelle INSERT snapshot_data pour chaque table", async () => {
    mockQuery
      .mockResolvedValueOnce([{ insertId: 7 }])        // INSERT header
      .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]) // SELECT id FROM comptes
      .mockResolvedValue([[]])                          // toutes les SELECT * + SELECT utilisateur_id + INSERT data
      ;

    await captureSnapshot({ nom: "Snap", creePar: 1, clientId: 3, estInitial: false });

    const insertDataCalls = mockQuery.mock.calls.filter(c =>
      String(c[0]).includes("INSERT INTO simulation_snapshot_data")
    );
    expect(insertDataCalls).toHaveLength(CLIENT_SNAPSHOT_TABLES.length);
  });

  it("utilise est_initial=1 quand estInitial est vrai", async () => {
    mockQuery
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValue([[]])
      ;

    await captureSnapshot({ nom: "Initial", creePar: 1, clientId: 1, estInitial: true });

    expect(mockQuery.mock.calls[0][1][2]).toBe(1); // est_initial = 1
  });

  it("utilise null comme description si non fournie", async () => {
    mockQuery
      .mockResolvedValueOnce([{ insertId: 2 }])
      .mockResolvedValue([[]])
      ;

    await captureSnapshot({ nom: "Sans desc", creePar: 1, clientId: 2 });

    expect(mockQuery.mock.calls[0][1][1]).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findSnapshots
// ─────────────────────────────────────────────────────────────────────────────

describe("findSnapshots", () => {
  it("retourne la liste des snapshots filtrée par clientId", async () => {
    const fakeRows = [
      { id: 1, nom: "État initial", est_initial: 1, client_id: 3 },
      { id: 2, nom: "Snap A",       est_initial: 0, client_id: 3 },
    ];
    mockQuery.mockResolvedValueOnce([fakeRows]);

    const result = await findSnapshots(3);

    expect(result).toEqual(fakeRows);
    expect(mockQuery.mock.calls[0][0]).toMatch(/WHERE s\.client_id = \?/);
    expect(mockQuery.mock.calls[0][1]).toEqual([3]);
  });

  it("retourne un tableau vide si aucun snapshot pour ce client", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const result = await findSnapshots(99);

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findSnapshotById
// ─────────────────────────────────────────────────────────────────────────────

describe("findSnapshotById", () => {
  it("retourne le snapshot trouvé avec client_id", async () => {
    const snap = { id: 3, nom: "Test", est_initial: 0, client_id: 5, cree_par: 1 };
    mockQuery.mockResolvedValueOnce([[snap]]);

    const result = await findSnapshotById(3);

    expect(result).toEqual(snap);
    expect(result.client_id).toBe(5);
  });

  it("retourne null si le snapshot n'existe pas", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const result = await findSnapshotById(999);

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// restaurerSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("restaurerSnapshot", () => {
  it("désactive FOREIGN_KEY_CHECKS avant la restauration", async () => {
    // SELECT client_id + SELECT snapshot_data (pool)
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 2 }]])
      .mockResolvedValueOnce([[{ table_name: "clients", data_json: "[]" }]]);
    mockConnQuery.mockResolvedValue([[], {}]);

    await restaurerSnapshot(1);

    expect(mockConnQuery.mock.calls[0][0]).toMatch(/FOREIGN_KEY_CHECKS\s*=\s*0/);
  });

  it("appelle beginTransaction et commit", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 2 }]])
      .mockResolvedValueOnce([[{ table_name: "clients", data_json: "[]" }]]);
    mockConnQuery.mockResolvedValue([[], {}]);

    await restaurerSnapshot(1);

    expect(mockConnBeginTx).toHaveBeenCalledTimes(1);
    expect(mockConnCommit).toHaveBeenCalledTimes(1);
  });

  it("réactive FOREIGN_KEY_CHECKS dans le finally (même en cas d'erreur)", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 2 }]])
      .mockResolvedValueOnce([[{ table_name: "clients", data_json: "[]" }]]);

    mockConnQuery
      .mockResolvedValueOnce([[], {}])        // SET FK_CHECKS = 0
      .mockRejectedValueOnce(new Error("DELETE failed"));

    await expect(restaurerSnapshot(1)).rejects.toThrow("DELETE failed");

    const calls = mockConnQuery.mock.calls.map(c => String(c[0]));
    expect(calls.some(q => /FOREIGN_KEY_CHECKS\s*=\s*1/.test(q))).toBe(true);
    expect(mockConnRollback).toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalled();
  });

  it("supprime les données par client_id et non globalement", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 7 }]])
      .mockResolvedValueOnce([[{ table_name: "comptes", data_json: "[{\"id\":10}]" }, { table_name: "clients", data_json: "[{\"id\":7}]" }]]);
    mockConnQuery.mockResolvedValue([[], {}]);

    await restaurerSnapshot(5);

    const connCalls = mockConnQuery.mock.calls.map(c => String(c[0]));
    // DELETE clients WHERE id = ? (pas DELETE FROM clients sans condition)
    const deleteCalls = connCalls.filter(q => /DELETE FROM/.test(q));
    expect(deleteCalls.every(q => /WHERE/.test(q))).toBe(true);
  });

  it("libère la connexion dans le finally", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 1 }]])
      .mockResolvedValueOnce([[{ table_name: "clients", data_json: "[]" }]]);
    mockConnQuery.mockResolvedValue([[], {}]);

    await restaurerSnapshot(2);

    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });

  it("effectue INSERT pour les tables avec des données", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 3 }]])
      .mockResolvedValueOnce([[
        { table_name: "clients", data_json: JSON.stringify([{ id: 3, prenom: "Jean", nom: "Dupont", email_fictif: "j@j.com", cree_le: "2026-01-01" }]) },
        { table_name: "comptes", data_json: "[]" },
      ]]);
    mockConnQuery.mockResolvedValue([[], {}]);

    await restaurerSnapshot(9);

    const connCalls = mockConnQuery.mock.calls.map(c => String(c[0]));
    expect(connCalls.some(q => /INSERT INTO `clients`/.test(q))).toBe(true);
  });

  it("lève une erreur si le snapshot est introuvable", async () => {
    mockQuery.mockResolvedValueOnce([[]]); // snapRows vide

    await expect(restaurerSnapshot(999)).rejects.toThrow("introuvable");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteSnapshot", () => {
  it("supprime uniquement si est_initial = 0", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await deleteSnapshot(4);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("AND est_initial = 0"),
      [4]
    );
  });

  it("retourne le résultat MySQL", async () => {
    const fakeResult = { affectedRows: 1 };
    mockQuery.mockResolvedValueOnce([fakeResult]);

    const result = await deleteSnapshot(4);

    expect(result).toEqual(fakeResult);
  });

  it("retourne affectedRows=0 si le snapshot est protégé (est_initial=1)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const result = await deleteSnapshot(1);

    expect(result.affectedRows).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// captureSnapshot — branche interac (utilisateurIds.length > 0)
// ─────────────────────────────────────────────────────────────────────────────

describe("captureSnapshot — interac branch", () => {
  it("interroge interac_* quand le client a au moins un utilisateur lié", async () => {
    // Ordre attendu des SELECT dans collectClientData (avec compteIds non vides) :
    //   0) INSERT snapshot header
    //   1) SELECT id FROM comptes               → [{id:1}]
    //   2) SELECT * FROM clients
    //   3) SELECT * FROM comptes
    //   4) SELECT * FROM transactions
    //   5) SELECT * FROM virements
    //   6) SELECT * FROM factures
    //   7) SELECT * FROM cartes_credit
    //   8) SELECT * FROM depots_cheques
    //   9) SELECT * FROM retraits
    //  10) SELECT * FROM transactions_recurrentes
    //  11) SELECT utilisateur_id FROM utilisateurs_clients → [{utilisateur_id:7}] ← branche
    //  12) SELECT * FROM interac_beneficiaires  ← lignes 101-105
    //  13) SELECT * FROM interac_autodeposit    ← lignes 107-111
    //  14..) INSERT INTO simulation_snapshot_data (×11)
    mockQuery
      .mockResolvedValueOnce([{ insertId: 50 }])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[{ id: 3 }]])
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ utilisateur_id: 7 }]])
      .mockResolvedValueOnce([[{ id: 99 }]])
      .mockResolvedValueOnce([[{ id: 100 }]])
      .mockResolvedValue([{}]);

    await captureSnapshot({ nom: "Avec interac", creePar: 1, clientId: 3, estInitial: false });

    const queries = mockQuery.mock.calls.map(c => String(c[0]));
    expect(queries.some(q => /FROM interac_beneficiaires/.test(q))).toBe(true);
    expect(queries.some(q => /FROM interac_autodeposit/.test(q))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// restaurerSnapshot — branche interac (utilisateurIds.length > 0)
// ─────────────────────────────────────────────────────────────────────────────

describe("restaurerSnapshot — interac branch", () => {
  it("DELETE interac_beneficiaires + interac_autodeposit quand des utilisateurs sont liés", async () => {
    // pool : SELECT client_id, SELECT snapshot_data
    mockQuery
      .mockResolvedValueOnce([[{ client_id: 3 }]])
      .mockResolvedValueOnce([[
        { table_name: "comptes", data_json: JSON.stringify([{ id: 10 }]) },
        { table_name: "clients", data_json: "[]" },
      ]]);

    // conn calls:
    //   0) SET FK_CHECKS=0
    //   1) DELETE transactions_recurrentes (compte branch)
    //   2) DELETE virements
    //   3) DELETE transactions
    //   4) SELECT utilisateur_id FROM utilisateurs_clients → [{utilisateur_id:7}]
    //   5) DELETE FROM interac_beneficiaires   ← lignes 248-251
    //   6) DELETE FROM interac_autodeposit     ← lignes 252-255
    //   7..) DELETE depots/retraits/factures/cartes/comptes/clients
    //   then commit / SET FK_CHECKS=1
    mockConnQuery
      .mockResolvedValueOnce([{}, {}])                         // SET FK_CHECKS=0
      .mockResolvedValueOnce([{}, {}])                         // DELETE recurrentes
      .mockResolvedValueOnce([{}, {}])                         // DELETE virements
      .mockResolvedValueOnce([{}, {}])                         // DELETE transactions
      .mockResolvedValueOnce([[{ utilisateur_id: 7 }], {}])    // SELECT utilisateur_id
      .mockResolvedValue([{}, {}]);                            // tout le reste

    await restaurerSnapshot(1);

    const calls = mockConnQuery.mock.calls.map(c => String(c[0]));
    expect(calls.some(q => /DELETE FROM interac_beneficiaires/.test(q))).toBe(true);
    expect(calls.some(q => /DELETE FROM interac_autodeposit/.test(q))).toBe(true);
    expect(mockConnCommit).toHaveBeenCalled();
  });
});
