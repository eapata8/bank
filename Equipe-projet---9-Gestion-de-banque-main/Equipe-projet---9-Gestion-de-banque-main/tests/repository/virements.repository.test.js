import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/virements.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
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

