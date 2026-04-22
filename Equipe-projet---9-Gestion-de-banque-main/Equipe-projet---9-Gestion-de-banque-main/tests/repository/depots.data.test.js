import { jest } from "@jest/globals";

// Mocks pour la connexion dédiée (atomic transactions)
const mockConnQuery    = jest.fn();
const mockConnRelease  = jest.fn();
const mockConnBeginTx  = jest.fn().mockResolvedValue(undefined);
const mockConnCommit   = jest.fn().mockResolvedValue(undefined);
const mockConnRollback = jest.fn().mockResolvedValue(undefined);
const mockGetConnection = jest.fn().mockResolvedValue({
  query:            mockConnQuery,
  release:          mockConnRelease,
  beginTransaction: mockConnBeginTx,
  commit:           mockConnCommit,
  rollback:         mockConnRollback,
});

const mockDb = { query: jest.fn(), getConnection: mockGetConnection };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/depots.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
  mockConnQuery.mockReset();
  mockConnRelease.mockReset();
  mockConnBeginTx.mockClear().mockResolvedValue(undefined);
  mockConnCommit.mockClear().mockResolvedValue(undefined);
  mockConnRollback.mockClear().mockResolvedValue(undefined);
  mockGetConnection.mockClear().mockResolvedValue({
    query:            mockConnQuery,
    release:          mockConnRelease,
    beginTransaction: mockConnBeginTx,
    commit:           mockConnCommit,
    rollback:         mockConnRollback,
  });
});

describe("findDepots", () => {
  it("retourne tous les depots pour un admin (canReadAll=true)", async () => {
    const rows = [{ id: 1, numero_cheque: "CHQ-001" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findDepots({ userId: 1, canReadAll: true, search: "" });

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.not.stringContaining("JOIN utilisateurs_clients"),
      []
    );
  });

  it("filtre par utilisateur si canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2 }]]);

    await repo.findDepots({ userId: 5, canReadAll: false, search: "" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("JOIN utilisateurs_clients"),
      [5]
    );
  });

  it("ajoute la condition de recherche texte", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    await repo.findDepots({ userId: 1, canReadAll: true, search: "CHQ" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("d.numero_cheque LIKE ?"),
      expect.arrayContaining(["%CHQ%"])
    );
  });

  it("gere une recherche numerique avec safeNum", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findDepots({ userId: 1, canReadAll: true, search: "42" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([42])
    );
  });

  it("utilise null pour safeNum si la recherche n'est pas numerique", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findDepots({ userId: 1, canReadAll: true, search: "CHQ-ABC" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([null])
    );
  });
});

describe("findDepotById", () => {
  it("retourne le depot si trouve", async () => {
    const depot = { id: 5, numero_cheque: "CHQ-005", statut: "EN_ATTENTE" };
    mockDb.query.mockResolvedValueOnce([[depot]]);

    const result = await repo.findDepotById(5);

    expect(result).toEqual(depot);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE d.id = ?"),
      [5]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findDepotById(999);

    expect(result).toBeNull();
  });
});

describe("findCompteForDepot", () => {
  it("retourne le compte si accessible pour l'utilisateur", async () => {
    const compte = { id: 2, client_id: 1, type_compte: "CHEQUES", est_actif: 1 };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findCompteForDepot(2, 3);

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE co.id = ? AND uc.utilisateur_id = ?"),
      [2, 3]
    );
  });

  it("retourne null si non autorise", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findCompteForDepot(999, 3);

    expect(result).toBeNull();
  });
});

describe("findCompteForDepotAdmin", () => {
  it("retourne le compte pour un admin", async () => {
    const compte = { id: 3, type_compte: "EPARGNE", est_actif: 1 };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findCompteForDepotAdmin(3);

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM comptes co"),
      [3]
    );
  });

  it("retourne null si le compte est inactif ou de mauvais type", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findCompteForDepotAdmin(5);

    expect(result).toBeNull();
  });
});

describe("createDepot", () => {
  it("insere un depot et retourne l'insertId", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 15 }]);

    const result = await repo.createDepot({
      compte_id: 1,
      client_id: 2,
      montant: 500,
      numero_cheque: "CHQ-NEW",
      banque_emettrice: "TD",
      fichier_chemin: "cheque-abc.png",
    });

    expect(result).toBe(15);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO depots_cheques"),
      [1, 2, 500, "CHQ-NEW", "TD", "cheque-abc.png"]
    );
  });

  it("utilise null si fichier_chemin est absent", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 16 }]);

    await repo.createDepot({
      compte_id: 1,
      client_id: 2,
      montant: 200,
      numero_cheque: "CHQ-002",
      banque_emettrice: "RBC",
      fichier_chemin: undefined,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO depots_cheques"),
      [1, 2, 200, "CHQ-002", "RBC", null]
    );
  });
});

describe("approuverDepot", () => {
  it("met a jour le statut en APPROUVE", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.approuverDepot(3, 1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'APPROUVE'"),
      [1, 3]
    );
  });
});

describe("rejeterDepot", () => {
  it("met a jour le statut en REJETE avec notes", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.rejeterDepot(4, 2, "Chèque illisible");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'REJETE'"),
      [2, "Chèque illisible", 4]
    );
  });

  it("utilise null pour les notes si absentes", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.rejeterDepot(5, 2, undefined);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      [2, null, 5]
    );
  });
});

describe("creditAccountBalance", () => {
  it("credite le solde du compte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.creditAccountBalance(2, 500);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET solde = solde + ?"),
      [500, 2]
    );
  });
});

describe("createDepotTransaction", () => {
  it("insere une transaction de depot", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.createDepotTransaction(2, 500, "CHQ-001");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      expect.arrayContaining([2, 500])
    );
  });
});

describe("findUserAutoValidation", () => {
  it("retourne la valeur auto_validation si l'utilisateur existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ auto_validation: 1 }]]);

    const result = await repo.findUserAutoValidation(5);

    expect(result).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT auto_validation"),
      [5]
    );
  });

  it("retourne 0 si l'utilisateur est introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]); // rows vide → rows[0] undefined → ?? 0

    const result = await repo.findUserAutoValidation(999);

    expect(result).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// executeApprouvementDepotAtomique
// ─────────────────────────────────────────────────────────────────────────────

describe("executeApprouvementDepotAtomique", () => {
  it("exécute UPDATE depot, UPDATE compte, INSERT transaction et commit", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE depots_cheques
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE comptes
      .mockResolvedValueOnce([{ insertId: 99 }]);    // INSERT transactions

    await repo.executeApprouvementDepotAtomique(10, 7, 42, 250.5, "CHQ-001");

    expect(mockGetConnection).toHaveBeenCalledTimes(1);
    expect(mockConnBeginTx).toHaveBeenCalledTimes(1);
    expect(mockConnQuery).toHaveBeenCalledTimes(3);
    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnRollback).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);

    // Vérifie les paramètres clés (id dépôt, userId, compteId, montant)
    expect(mockConnQuery.mock.calls[0][1]).toEqual([7, 10]);
    expect(mockConnQuery.mock.calls[1][1]).toEqual([250.5, 42]);
    expect(mockConnQuery.mock.calls[2][1]).toEqual([42, "Dépôt chèque #CHQ-001", 250.5]);
  });

  it("rollback et release si une requête échoue, puis propage l'erreur", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockRejectedValueOnce(new Error("UPDATE compte failed"));

    await expect(
      repo.executeApprouvementDepotAtomique(1, 1, 1, 100, "X")
    ).rejects.toThrow("UPDATE compte failed");

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnCommit).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });
});
