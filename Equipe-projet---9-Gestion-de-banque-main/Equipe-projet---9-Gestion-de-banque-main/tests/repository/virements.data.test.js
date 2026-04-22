import { jest } from "@jest/globals";

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

const repo = await import("../../server/data/virements.data.js");

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

describe("findVirements", () => {
  it("retourne tous les virements pour un admin (isAdmin=true)", async () => {
    const rows = [{ id: 1, montant: 200 }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findVirements({ userId: 1, isAdmin: true, search: "" });

    expect(result).toEqual(rows);
    // pas de filtre utilisateur
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.not.stringContaining("utilisateur_id = ?"),
      []
    );
  });

  it("filtre par utilisateur si isAdmin=false", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2 }]]);

    await repo.findVirements({ userId: 5, isAdmin: false, search: "" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("utilisateur_id = ?"),
      [5, 5]
    );
  });

  it("ajoute la condition de recherche texte", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    await repo.findVirements({ userId: 1, isAdmin: true, search: "virement" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("v.description LIKE ?"),
      expect.arrayContaining(["%virement%"])
    );
  });

  it("gere une recherche numerique avec safeNumeric", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findVirements({ userId: 1, isAdmin: true, search: "10" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([10])
    );
  });

  it("utilise null pour safeNumeric si recherche non-numerique", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findVirements({ userId: 1, isAdmin: true, search: "abc" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([null])
    );
  });
});

describe("findAuthorizedSourceAccount", () => {
  it("retourne le compte source si autorise", async () => {
    const compte = { id: 2, solde: 1000 };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findAuthorizedSourceAccount(1, 2);

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ? AND co.id = ?"),
      [1, 2]
    );
  });

  it("retourne null si non autorise", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAuthorizedSourceAccount(99, 2);

    expect(result).toBeNull();
  });
});

describe("findAccountById", () => {
  it("retourne l'id si le compte existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 5 }]]);

    const result = await repo.findAccountById(5);

    expect(result).toEqual({ id: 5 });
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAccountById(999);

    expect(result).toBeNull();
  });
});

describe("findAuthorizedDestinationAccount", () => {
  it("retourne le compte destination si accessible", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    const result = await repo.findAuthorizedDestinationAccount(1, 3);

    expect(result).toEqual({ id: 3 });
  });

  it("retourne null si non accessible", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAuthorizedDestinationAccount(99, 3);

    expect(result).toBeNull();
  });
});

describe("createVirementRecord", () => {
  it("insere un virement et retourne le resultat", async () => {
    const insertResult = { insertId: 8 };
    mockDb.query.mockResolvedValueOnce([insertResult]);

    const result = await repo.createVirementRecord({
      compteSourceId: 1,
      compteDestinationId: 2,
      montant: 300,
      description: "Virement test",
    });

    expect(result).toEqual(insertResult);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO virements"),
      [1, 2, 300, "Virement test"]
    );
  });

  it("utilise null si description est absente", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 9 }]);

    await repo.createVirementRecord({
      compteSourceId: 1,
      compteDestinationId: 2,
      montant: 100,
      description: undefined,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      [1, 2, 100, null]
    );
  });
});

describe("decrementAccountBalance", () => {
  it("decrement le solde du compte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.decrementAccountBalance(1, 300);

    expect(mockDb.query).toHaveBeenCalledWith(
      "UPDATE comptes SET solde = solde - ? WHERE id = ?",
      [300, 1]
    );
  });
});

describe("incrementAccountBalance", () => {
  it("incremente le solde du compte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.incrementAccountBalance(2, 300);

    expect(mockDb.query).toHaveBeenCalledWith(
      "UPDATE comptes SET solde = solde + ? WHERE id = ?",
      [300, 2]
    );
  });
});

describe("findAccountByCoords", () => {
  it("retourne le compte trouve par ses coordonnees avec swift", async () => {
    const row = { id: 5, solde: 1200 };
    mockDb.query.mockResolvedValueOnce([[row]]);

    const result = await repo.findAccountByCoords({
      numeroCompte: "1234 5678 9012",
      numeroInstitution: "621",
      numeroTransit: "10482",
      swiftBic: "NXBKCA2TXXX",
    });

    expect(result).toEqual(row);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT"),
      ["1234 5678 9012", "621", "10482", "NXBKCA2TXXX", "NXBKCA2TXXX"]
    );
  });

  it("passe null pour swiftBic si absent (clause optionnelle ignoree)", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3, solde: 500 }]]);

    await repo.findAccountByCoords({
      numeroCompte: "9999 0000 1111",
      numeroInstitution: "002",
      numeroTransit: "00200",
      swiftBic: null,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("IS NULL OR swift_bic"),
      ["9999 0000 1111", "002", "00200", null, null]
    );
  });

  it("retourne null si aucun compte ne correspond", async () => {
    mockDb.query.mockResolvedValueOnce([[]]); // rows vide

    const result = await repo.findAccountByCoords({
      numeroCompte: "0000 0000 0000",
      numeroInstitution: "000",
      numeroTransit: "00000",
      swiftBic: null,
    });

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// executeVirementAtomique
// ─────────────────────────────────────────────────────────────────────────────

describe("executeVirementAtomique", () => {
  it("débit, crédit, INSERT virement, INSERT transactions miroir et commit (cas nominal interne)", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])     // UPDATE source (débit OK)
      .mockResolvedValueOnce([{ affectedRows: 1 }])     // UPDATE destination (crédit)
      .mockResolvedValueOnce([{ insertId: 100 }])       // INSERT virements
      .mockResolvedValueOnce([{ affectedRows: 2 }]);    // INSERT 2 transactions

    const id = await repo.executeVirementAtomique({
      compteSourceId: 1,
      compteDestinationId: 2,
      montant: 200,
      description: "Loyer",
      typeLabel: "interne",
    });

    expect(id).toBe(100);
    expect(mockConnBeginTx).toHaveBeenCalledTimes(1);
    expect(mockConnQuery).toHaveBeenCalledTimes(4);
    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnRollback).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);

    expect(mockConnQuery.mock.calls[0][1]).toEqual([200, 1, 200]);
    expect(mockConnQuery.mock.calls[1][1]).toEqual([200, 2]);
    expect(mockConnQuery.mock.calls[2][1]).toEqual([1, 2, 200, "Loyer"]);
  });

  it("utilise une description auto si description est null/absente", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 101 }])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);

    await repo.executeVirementAtomique({
      compteSourceId: 1, compteDestinationId: 2, montant: 50,
      description: null, typeLabel: "externe",
    });

    // L'INSERT transactions doit contenir la description auto-générée
    const txParams = mockConnQuery.mock.calls[3][1];
    expect(txParams).toEqual(
      expect.arrayContaining([
        "Virement externe #101 (sortant)",
        "Virement externe #101 (entrant)",
      ])
    );
  });

  it("lève SOLDE_INSUFFISANT et rollback si le débit affecte 0 ligne", async () => {
    mockConnQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

    await expect(
      repo.executeVirementAtomique({
        compteSourceId: 1, compteDestinationId: 2, montant: 999999,
      })
    ).rejects.toMatchObject({ code: "SOLDE_INSUFFISANT" });

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnCommit).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });

  it("rollback et propage si une requête post-débit échoue", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])     // débit OK
      .mockRejectedValueOnce(new Error("UPDATE destination failed"));

    await expect(
      repo.executeVirementAtomique({
        compteSourceId: 1, compteDestinationId: 2, montant: 50,
      })
    ).rejects.toThrow("UPDATE destination failed");

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });

  it("utilise typeLabel='interne' par défaut si non fourni", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 102 }])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);

    await repo.executeVirementAtomique({
      compteSourceId: 1, compteDestinationId: 2, montant: 10,
    });

    const txParams = mockConnQuery.mock.calls[3][1];
    expect(txParams).toEqual(
      expect.arrayContaining([
        "Virement interne #102 (sortant)",
        "Virement interne #102 (entrant)",
      ])
    );
  });

  it("release est appelé même si rollback throw (finally garanti)", async () => {
    mockConnQuery.mockRejectedValueOnce(new Error("query failed"));
    mockConnRollback.mockRejectedValueOnce(new Error("rollback failed"));

    await expect(
      repo.executeVirementAtomique({
        compteSourceId: 1, compteDestinationId: 2, montant: 50,
      })
    ).rejects.toThrow("rollback failed");

    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });
});
