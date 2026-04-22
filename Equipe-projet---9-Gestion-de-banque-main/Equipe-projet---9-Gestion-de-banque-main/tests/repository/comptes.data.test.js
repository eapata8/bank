import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/comptes.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
});

describe("findAccountsByUserId", () => {
  it("retourne les comptes de l'utilisateur", async () => {
    const rows = [{ id: 1, type_compte: "EPARGNE" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAccountsByUserId(3);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ?"),
      [3]
    );
  });
});

describe("findAllAccounts", () => {
  it("retourne tous les comptes sans recherche", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAllAccounts();

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM comptes co"),
      ["", "%%", "%%", "%%", "%%", "%%"]
    );
  });

  it("filtre les comptes avec un terme de recherche", async () => {
    const rows = [{ id: 1, type_compte: "EPARGNE", client_prenom: "Alice" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAllAccounts("Alice");

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM comptes co"),
      ["Alice", "%Alice%", "%Alice%", "%Alice%", "%Alice%", "%Alice%"]
    );
  });
});

describe("findAnyAccountById", () => {
  it("retourne le compte si trouve", async () => {
    const account = { id: 5, type_compte: "CHEQUES" };
    mockDb.query.mockResolvedValueOnce([[account]]);

    const result = await repo.findAnyAccountById(5);

    expect(result).toEqual(account);
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAnyAccountById(999);

    expect(result).toBeNull();
  });
});

describe("findOwnedAccountById", () => {
  it("retourne le compte si l'utilisateur en est proprietaire", async () => {
    const account = { id: 2, client_id: 1 };
    mockDb.query.mockResolvedValueOnce([[account]]);

    const result = await repo.findOwnedAccountById(1, 2);

    expect(result).toEqual(account);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ? AND co.id = ?"),
      [1, 2]
    );
  });

  it("retourne null si l'utilisateur n'est pas proprietaire", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findOwnedAccountById(99, 2);

    expect(result).toBeNull();
  });
});

describe("findOwnedAccountAccess", () => {
  it("retourne l'id du compte si accessible", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    const result = await repo.findOwnedAccountAccess(1, 3);

    expect(result).toEqual({ id: 3 });
  });

  it("retourne null si non accessible", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findOwnedAccountAccess(99, 3);

    expect(result).toBeNull();
  });
});

describe("findAccountById", () => {
  it("retourne l'id du compte si existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 7 }]]);

    const result = await repo.findAccountById(7);

    expect(result).toEqual({ id: 7 });
  });

  it("retourne null si inexistant", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAccountById(999);

    expect(result).toBeNull();
  });
});

describe("createCompte", () => {
  it("insere un compte et retourne l'insertId", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 20 }]);

    const result = await repo.createCompte({
      clientId: 3,
      typeCompte: "CHEQUES",
      numeroCompte: "1234 5678 4567",
      numeroInstitution: "621",
      numeroTransit: "12345",
      swiftBic: "NXBKCA2TXXX",
      solde: 0,
      devise: "CAD",
    });

    expect(result).toBe(20);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO comptes"),
      [3, "CHEQUES", "1234 5678 4567", "621", "12345", "NXBKCA2TXXX", 0, "CAD"]
    );
  });

  it("utilise 0 comme solde par defaut si non fourni", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 21 }]);

    await repo.createCompte({ clientId: 1, typeCompte: "EPARGNE", numeroCompte: "1234 5678 1234", numeroTransit: "67890" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO comptes"),
      [1, "EPARGNE", "1234 5678 1234", "621", "67890", "NXBKCA2TXXX", 0, "CAD"]
    );
  });
});

describe("findTransactionsByAccountId", () => {
  it("retourne les transactions du compte", async () => {
    const txs = [
      { id: 1, type_transaction: "DEPOT", montant: 500 },
      { id: 2, type_transaction: "VIREMENT", montant: -100 },
    ];
    mockDb.query.mockResolvedValueOnce([txs]);

    const result = await repo.findTransactionsByAccountId(2);

    expect(result).toEqual(txs);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE compte_id = ?"),
      [2]
    );
  });

  it("retourne un tableau vide si aucune transaction", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findTransactionsByAccountId(99);

    expect(result).toEqual([]);
  });
});
