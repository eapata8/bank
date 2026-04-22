import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/clients.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
});

describe("findClientsByUserId", () => {
  it("retourne les clients associes a l'utilisateur", async () => {
    const rows = [{ id: 1, prenom: "Alice", nom: "Martin" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientsByUserId(5);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ?"),
      [5]
    );
  });

  it("retourne un tableau vide si aucun client", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientsByUserId(99);

    expect(result).toEqual([]);
  });
});

describe("findAllClients", () => {
  it("retourne tous les clients sans filtre de recherche", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAllClients();

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM clients"),
      ["", "%%", "%%", "%%"]
    );
  });

  it("filtre les clients avec un terme de recherche", async () => {
    const rows = [{ id: 1, prenom: "Alice", nom: "Martin" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAllClients("Alice");

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM clients"),
      ["Alice", "%Alice%", "%Alice%", "%Alice%"]
    );
  });

  it("retourne un tableau vide si aucun resultat", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAllClients("zzz");

    expect(result).toEqual([]);
  });
});

describe("findAccountsByUserIdAndClientId", () => {
  it("retourne les comptes du client pour l'utilisateur", async () => {
    const rows = [{ id: 10, type_compte: "EPARGNE" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAccountsByUserIdAndClientId(1, 2);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ?"),
      [1, 2]
    );
  });
});

describe("findAccountsByClientId", () => {
  it("retourne tous les comptes d'un client", async () => {
    const rows = [{ id: 5, type_compte: "CHEQUES" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAccountsByClientId(3);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE client_id = ?"),
      [3]
    );
  });
});

describe("findClientById", () => {
  it("retourne le client si trouve", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 7 }]]);

    const result = await repo.findClientById(7);

    expect(result).toEqual({ id: 7 });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [7]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientById(999);

    expect(result).toBeNull();
  });
});

describe("findClientByEmailFictif", () => {
  it("retourne le client si email existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    const result = await repo.findClientByEmailFictif("alice@test.com");

    expect(result).toEqual({ id: 3 });
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE email_fictif = ?"),
      ["alice@test.com"]
    );
  });

  it("retourne null si email inexistant", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientByEmailFictif("nouveau@test.com");

    expect(result).toBeNull();
  });
});

describe("findUserById", () => {
  it("retourne l'utilisateur si trouve", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 5 }]]);

    const result = await repo.findUserById(5);

    expect(result).toEqual({ id: 5 });
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findUserById(999);

    expect(result).toBeNull();
  });
});

describe("createClient", () => {
  it("insere un client et retourne l'insertId", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 10 }]);

    const result = await repo.createClient({
      prenom: "Alice",
      nom: "Martin",
      emailFictif: "alice.martin@test.com",
      ville: "Montreal",
    });

    expect(result).toBe(10);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO clients"),
      ["Alice", "Martin", "alice.martin@test.com", "Montreal"]
    );
  });

  it("utilise null si ville est absente", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 11 }]);

    await repo.createClient({ prenom: "Bob", nom: "Roy", emailFictif: "bob@test.com" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO clients"),
      ["Bob", "Roy", "bob@test.com", null]
    );
  });
});

describe("linkClientToUser", () => {
  it("insere la liaison utilisateur-client", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.linkClientToUser(10, 5);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO utilisateurs_clients"),
      [5, 10]
    );
  });
});
