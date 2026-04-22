import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/cartes.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
});

describe("findCartes", () => {
  it("retourne toutes les cartes pour un admin (canReadAll=true)", async () => {
    const rows = [{ id: 1, numero_masque: "**** 1111" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findCartes({ userId: 1, canReadAll: true, search: "" });

    expect(result).toEqual(rows);
    // pas de filtre utilisateur_id
    expect(mockDb.query).not.toHaveBeenCalledWith(
      expect.stringContaining("utilisateur_id = ?"),
      expect.anything()
    );
  });

  it("filtre par utilisateur si canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2 }]]);

    await repo.findCartes({ userId: 5, canReadAll: false, search: "" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("utilisateur_id = ?"),
      expect.arrayContaining([5])
    );
  });

  it("ajoute la condition de recherche quand search est fourni", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    await repo.findCartes({ userId: 1, canReadAll: true, search: "VISA" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("cc.type_carte LIKE ?"),
      expect.arrayContaining(["%VISA%"])
    );
  });

  it("gere une recherche numerique", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findCartes({ userId: 1, canReadAll: true, search: "42" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([42])
    );
  });
});

describe("findCarteById", () => {
  it("retourne la carte si trouvee", async () => {
    const carte = { id: 1, numero_masque: "**** 9999", type_carte: "VISA" };
    mockDb.query.mockResolvedValueOnce([[carte]]);

    const result = await repo.findCarteById(1);

    expect(result).toEqual(carte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE cc.id = ?"),
      [1]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findCarteById(999);

    expect(result).toBeNull();
  });
});

describe("findAuthorizedCarteById", () => {
  it("retourne la carte si autorisee pour l'utilisateur", async () => {
    const carte = { id: 5, numero_masque: "**** 5555" };
    mockDb.query.mockResolvedValueOnce([[carte]]);

    const result = await repo.findAuthorizedCarteById(1, 5);

    expect(result).toEqual(carte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ? AND cc.id = ?"),
      [1, 5]
    );
  });

  it("retourne null si non autorisee", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAuthorizedCarteById(99, 5);

    expect(result).toBeNull();
  });
});

describe("createCarte", () => {
  it("insere une nouvelle carte et retourne le resultat", async () => {
    const insertResult = { insertId: 10 };
    mockDb.query.mockResolvedValueOnce([insertResult]);

    const result = await repo.createCarte({
      clientId: 1,
      numeroCompte: "**** 1234",
      cvv: "123",
      typeCarte: "VISA",
      limiteCredit: 5000,
      dateExpiration: "2030-12-31",
    });

    expect(result).toEqual(insertResult);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cartes_credit"),
      [1, "**** 1234", "123", "VISA", 5000, "2030-12-31"]
    );
  });
});

describe("updateCarteStatut", () => {
  it("met a jour le statut de la carte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.updateCarteStatut(3, "BLOQUEE");

    expect(mockDb.query).toHaveBeenCalledWith(
      "UPDATE cartes_credit SET statut = ? WHERE id = ?",
      ["BLOQUEE", 3]
    );
  });
});

describe("updateCarteLimite", () => {
  it("met a jour la limite de credit", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.updateCarteLimite(3, 10000);

    expect(mockDb.query).toHaveBeenCalledWith(
      "UPDATE cartes_credit SET limite_credit = ? WHERE id = ?",
      [10000, 3]
    );
  });
});

describe("decrementSoldeUtilise", () => {
  it("decrement le solde utilise en utilisant GREATEST", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.decrementSoldeUtilise(5, 200);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("GREATEST(0, solde_utilise - ?)"),
      [200, 5]
    );
  });
});

describe("findSourceAccountForRemboursement", () => {
  it("retourne le compte directement si canReadAll=true", async () => {
    const compte = { id: 2, client_id: 1, solde: 1000, type_compte: "CHEQUES" };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findSourceAccountForRemboursement({
      userId: 1,
      compteId: 2,
      canReadAll: true,
    });

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM comptes"),
      [2]
    );
  });

  it("retourne null si compte introuvable avec canReadAll=true", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findSourceAccountForRemboursement({
      userId: 1,
      compteId: 999,
      canReadAll: true,
    });

    expect(result).toBeNull();
  });

  it("filtre par utilisateur_id si canReadAll=false", async () => {
    const compte = { id: 2, client_id: 1, solde: 500, type_compte: "EPARGNE" };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findSourceAccountForRemboursement({
      userId: 3,
      compteId: 2,
      canReadAll: false,
    });

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("JOIN utilisateurs_clients"),
      [3, 2]
    );
  });

  it("retourne null si non autorise avec canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findSourceAccountForRemboursement({
      userId: 99,
      compteId: 2,
      canReadAll: false,
    });

    expect(result).toBeNull();
  });
});

describe("decrementAccountBalance", () => {
  it("decrement le solde du compte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.decrementAccountBalance(4, 300);

    expect(mockDb.query).toHaveBeenCalledWith(
      "UPDATE comptes SET solde = solde - ? WHERE id = ?",
      [300, 4]
    );
  });
});

describe("createRemboursementTransaction", () => {
  it("insere une transaction de remboursement", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.createRemboursementTransaction({ compteId: 2, carteId: 5, montant: 150 });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      expect.arrayContaining([2, -150])
    );
  });
});
