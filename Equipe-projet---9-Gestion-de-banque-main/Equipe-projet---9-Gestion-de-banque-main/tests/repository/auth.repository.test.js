import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
const bcryptCompareMock = jest.fn();
const bcryptHashMock = jest.fn();

await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));
await jest.unstable_mockModule("bcryptjs", () => ({
  default: { compare: bcryptCompareMock, hash: bcryptHashMock },
}));

const repo = await import("../../server/data/auth.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
  bcryptCompareMock.mockReset();
  bcryptHashMock.mockReset();
});

describe("findUserByEmail", () => {
  it("retourne l'utilisateur si trouve", async () => {
    const user = { id: 1, email: "alice@test.local", role: "ADMIN" };
    mockDb.query.mockResolvedValueOnce([[user]]);

    const result = await repo.findUserByEmail("alice@test.local");

    expect(result).toEqual(user);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE email = ?"),
      ["alice@test.local"]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findUserByEmail("nobody@test.local");

    expect(result).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("retourne true si le mot de passe correspond", async () => {
    bcryptCompareMock.mockResolvedValueOnce(true);

    const result = await repo.verifyPassword("secret", "hashedSecret");

    expect(result).toBe(true);
    expect(bcryptCompareMock).toHaveBeenCalledWith("secret", "hashedSecret");
  });

  it("retourne false si le mot de passe ne correspond pas", async () => {
    bcryptCompareMock.mockResolvedValueOnce(false);

    const result = await repo.verifyPassword("wrong", "hashedSecret");

    expect(result).toBe(false);
  });
});

describe("findUserIdByEmail", () => {
  it("retourne l'id si l'utilisateur existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 5 }]]);

    const result = await repo.findUserIdByEmail("bob@test.local");

    expect(result).toEqual({ id: 5 });
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findUserIdByEmail("ghost@test.local");

    expect(result).toBeNull();
  });
});

describe("createUser", () => {
  it("hache le mot de passe et insere l'utilisateur", async () => {
    bcryptHashMock.mockResolvedValueOnce("hashedPwd");
    const insertResult = { insertId: 10 };
    mockDb.query.mockResolvedValueOnce([insertResult]);

    const result = await repo.createUser({
      email: "new@test.local",
      motDePasse: "password123",
      role: "UTILISATEUR",
      prenom: "Jean",
      nom: "Tremblay",
    });

    expect(bcryptHashMock).toHaveBeenCalledWith("password123", 12);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO utilisateurs"),
      ["new@test.local", "hashedPwd", "UTILISATEUR", "Jean", "Tremblay"]
    );
    expect(result).toEqual(insertResult);
  });
});

describe("findModerateurs", () => {
  it("retourne la liste des moderateurs", async () => {
    const mods = [
      { id: 2, email: "mod1@test.local", role: "MODERATEUR", prenom: "Marc", nom: "A" },
      { id: 3, email: "mod2@test.local", role: "MODERATEUR", prenom: "Zoe", nom: "B" },
    ];
    mockDb.query.mockResolvedValueOnce([mods]);

    const result = await repo.findModerateurs();

    expect(result).toEqual(mods);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE role = 'MODERATEUR'")
    );
  });

  it("retourne un tableau vide si aucun moderateur", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findModerateurs();

    expect(result).toEqual([]);
  });
});

describe("deleteModerateur", () => {
  it("supprime le moderateur et retourne 1 si trouve", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await repo.deleteModerateur(5);

    expect(result).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM utilisateurs"),
      [5]
    );
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("role = 'MODERATEUR'"),
      [5]
    );
  });

  it("retourne 0 si introuvable ou pas moderateur", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const result = await repo.deleteModerateur(999);

    expect(result).toBe(0);
  });
});

describe("upsertConfiguredAdmin", () => {
  it("met a jour l'admin existant (branche UPDATE)", async () => {
    bcryptHashMock.mockResolvedValueOnce("hashedPwd");
    const mockConnection = { query: jest.fn() };
    // SELECT retourne un utilisateur existant
    mockConnection.query.mockResolvedValueOnce([[{ id: 7 }]]);
    // UPDATE
    mockConnection.query.mockResolvedValueOnce([{}]);

    const result = await repo.upsertConfiguredAdmin(mockConnection, {
      email: "admin@Leon.local",
      motDePasse: "adminPass",
      prenom: "Super",
      nom: "Admin",
    });

    expect(result).toBe(7);
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE utilisateurs"),
      expect.arrayContaining(["hashedPwd", "Super", "Admin", 7])
    );
  });

  it("insere un nouvel admin si inexistant (branche INSERT)", async () => {
    bcryptHashMock.mockResolvedValueOnce("hashedPwd");
    const mockConnection = { query: jest.fn() };
    // SELECT retourne vide
    mockConnection.query.mockResolvedValueOnce([[]]);
    // INSERT
    mockConnection.query.mockResolvedValueOnce([{ insertId: 99 }]);

    const result = await repo.upsertConfiguredAdmin(mockConnection, {
      email: "newadmin@Leon.local",
      motDePasse: "pass",
      prenom: "Nouveau",
      nom: "Admin",
    });

    expect(result).toBe(99);
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO utilisateurs"),
      expect.arrayContaining(["newadmin@Leon.local", "hashedPwd", "Nouveau", "Admin"])
    );
  });
});
