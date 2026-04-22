import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/audit.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
});

describe("createAuditLog", () => {
  it("insere un log d'audit avec tous les champs", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 1 }]);

    await repo.createAuditLog({
      utilisateurId: 1,
      roleUtilisateur: "ADMIN",
      action: "LOGIN",
      details: "Connexion réussie",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_logs"),
      [1, "ADMIN", "LOGIN", "Connexion réussie"]
    );
  });

  it("utilise null si details est absent", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 2 }]);

    await repo.createAuditLog({
      utilisateurId: 2,
      roleUtilisateur: "MODERATEUR",
      action: "VIEW_COMPTES",
      details: undefined,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_logs"),
      [2, "MODERATEUR", "VIEW_COMPTES", null]
    );
  });
});

describe("findRecentAuditLogs", () => {
  it("retourne les logs avec la limite par defaut (50)", async () => {
    const rows = [{ id: 1, action: "LOGIN", prenom: "Alice", nom: "Martin" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findRecentAuditLogs();

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 50")
    );
    expect(result).toEqual(rows);
  });

  it("applique la limite personnalisee", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);

    const result = await repo.findRecentAuditLogs(10);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 10")
    );
    expect(result).toHaveLength(2);
  });

  it("clamp la limite a 200 maximum", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRecentAuditLogs(500);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 200")
    );
  });

  it("clamp la limite a 1 minimum", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRecentAuditLogs(-5);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 1")
    );
  });

  it("utilise 50 si la limite est NaN", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRecentAuditLogs("abc");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 50")
    );
  });

  it("contient la jointure avec utilisateurs", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRecentAuditLogs();

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("JOIN utilisateurs u")
    );
  });
});
