import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/beneficiaires.data.js");

// ─────────────────────────────────────────────────────────────────────────────
// emailExistsDansLeSysteme
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockDb.query.mockReset();
});

describe("emailExistsDansLeSysteme", () => {
  it("retourne true si le courriel est trouvé via UNION", async () => {
    mockDb.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    const result = await repo.emailExistsDansLeSysteme("test@test.com");

    expect(result).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("UNION"),
      ["test@test.com", "test@test.com"]
    );
  });

  it("retourne false si le courriel n'existe pas dans le système", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.emailExistsDansLeSysteme("inconnu@test.com");

    expect(result).toBe(false);
  });

  it("vérifie dans utilisateurs.email et interac_autodeposit.email_interac", async () => {
    mockDb.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    await repo.emailExistsDansLeSysteme("quelquun@test.com");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("interac_autodeposit"),
      expect.anything()
    );
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("utilisateurs"),
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findBeneficiaires
// ─────────────────────────────────────────────────────────────────────────────

describe("findBeneficiaires", () => {
  it("retourne la liste des bénéficiaires triés par alias pour un utilisateur", async () => {
    const rows = [
      { id: 1, utilisateur_id: 5, alias: "Maman", email_interac: "maman@exemple.com", cree_le: "2026-01-01" },
      { id: 2, utilisateur_id: 5, alias: "Papa",  email_interac: "papa@exemple.com",  cree_le: "2026-01-02" },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findBeneficiaires(5);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE utilisateur_id = ?"),
      [5]
    );
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY alias ASC"),
      [5]
    );
  });

  it("retourne un tableau vide si aucun bénéficiaire trouvé", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findBeneficiaires(99);

    expect(result).toEqual([]);
  });

  it("interroge la table interac_beneficiaires", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findBeneficiaires(1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("interac_beneficiaires"),
      [1]
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findBeneficiaireById
// ─────────────────────────────────────────────────────────────────────────────

describe("findBeneficiaireById", () => {
  it("retourne le bénéficiaire si trouvé", async () => {
    const row = { id: 3, utilisateur_id: 5, alias: "Loyer Marc", email_interac: "marc@exemple.com" };
    mockDb.query.mockResolvedValueOnce([[row]]);

    const result = await repo.findBeneficiaireById(3);

    expect(result).toEqual(row);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [3]
    );
  });

  it("retourne null si le bénéficiaire est introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findBeneficiaireById(999);

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createBeneficiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("createBeneficiaire", () => {
  it("insère un bénéficiaire et retourne le résultat avec insertId", async () => {
    const fakeResult = { insertId: 42 };
    mockDb.query.mockResolvedValueOnce([fakeResult]);

    const result = await repo.createBeneficiaire({
      utilisateurId: 5,
      alias: "Maman",
      emailInterac: "maman@exemple.com",
    });

    expect(result).toEqual(fakeResult);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO interac_beneficiaires"),
      [5, "Maman", "maman@exemple.com"]
    );
  });

  it("normalise le courriel en minuscules avant insertion", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 7 }]);

    await repo.createBeneficiaire({
      utilisateurId: 1,
      alias: "Test",
      emailInterac: "  TEST@EXEMPLE.COM  ",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      [1, "Test", "test@exemple.com"]
    );
  });

  it("normalise l'alias (trim) avant insertion", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 8 }]);

    await repo.createBeneficiaire({
      utilisateurId: 2,
      alias: "  Loyer  ",
      emailInterac: "loyer@exemple.com",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      [2, "Loyer", "loyer@exemple.com"]
    );
  });

  it("lève l'erreur MySQL si elle n'est pas une violation de contrainte", async () => {
    const dbErr = new Error("DB connection lost");
    mockDb.query.mockRejectedValueOnce(dbErr);

    await expect(
      repo.createBeneficiaire({ utilisateurId: 1, alias: "X", emailInterac: "x@x.com" })
    ).rejects.toThrow("DB connection lost");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteBeneficiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteBeneficiaire", () => {
  it("exécute un DELETE avec le bon id", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.deleteBeneficiaire(10);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM interac_beneficiaires WHERE id = ?"),
      [10]
    );
  });

  it("ne lève pas d'erreur si le bénéficiaire n'existe pas (0 lignes affectées)", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    await expect(repo.deleteBeneficiaire(999)).resolves.not.toThrow();
  });
});
