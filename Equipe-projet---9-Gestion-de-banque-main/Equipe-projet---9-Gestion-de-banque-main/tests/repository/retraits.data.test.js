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

const repo = await import("../../server/data/retraits.data.js");

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

describe("findRetraits", () => {
  it("retourne tous les retraits pour un admin (canReadAll=true)", async () => {
    const rows = [{ id: 1, montant: 200, statut: "EN_ATTENTE" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findRetraits({ userId: 1, canReadAll: true, search: "" });

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.not.stringContaining("JOIN utilisateurs_clients"),
      []
    );
  });

  it("filtre par utilisateur si canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2 }]]);

    await repo.findRetraits({ userId: 5, canReadAll: false, search: "" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("JOIN utilisateurs_clients"),
      [5]
    );
  });

  it("ajoute la condition de recherche texte", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    await repo.findRetraits({ userId: 1, canReadAll: true, search: "especes" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("r.description LIKE ?"),
      expect.arrayContaining(["%especes%"])
    );
  });

  it("gere une recherche numerique avec safeNum", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRetraits({ userId: 1, canReadAll: true, search: "42" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([42])
    );
  });

  it("utilise null pour safeNum si la recherche n'est pas numerique", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRetraits({ userId: 1, canReadAll: true, search: "retrait-abc" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([null])
    );
  });
});

describe("findRetraitById", () => {
  it("retourne le retrait si trouve", async () => {
    const retrait = { id: 5, montant: 300, statut: "EN_ATTENTE" };
    mockDb.query.mockResolvedValueOnce([[retrait]]);

    const result = await repo.findRetraitById(5);

    expect(result).toEqual(retrait);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE r.id = ?"),
      [5]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findRetraitById(999);

    expect(result).toBeNull();
  });
});

describe("findCompteForRetrait", () => {
  it("retourne le compte si accessible pour l'utilisateur", async () => {
    const compte = { id: 2, client_id: 1, type_compte: "CHEQUES", est_actif: 1, solde: 1000 };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findCompteForRetrait(2, 3);

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE co.id = ? AND uc.utilisateur_id = ?"),
      [2, 3]
    );
  });

  it("retourne null si non autorise", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findCompteForRetrait(999, 3);

    expect(result).toBeNull();
  });

  it("filtre sur les types CHEQUES et EPARGNE uniquement", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findCompteForRetrait(1, 2);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("co.type_compte IN ('CHEQUES','EPARGNE')"),
      expect.anything()
    );
  });
});

describe("findCompteForRetraitAdmin", () => {
  it("retourne le compte pour un admin", async () => {
    const compte = { id: 3, type_compte: "EPARGNE", est_actif: 1, solde: 500 };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findCompteForRetraitAdmin(3);

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM comptes co"),
      [3]
    );
  });

  it("retourne null si le compte est inactif ou de mauvais type", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findCompteForRetraitAdmin(5);

    expect(result).toBeNull();
  });
});

describe("createRetrait", () => {
  it("insere un retrait et retourne l'insertId", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 15 }]);

    const result = await repo.createRetrait({
      compte_id: 1,
      client_id: 2,
      montant: 300,
      description: "Retrait en espèces",
    });

    expect(result).toBe(15);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO retraits"),
      [1, 2, 300, "Retrait en espèces"]
    );
  });

  it("peut inserer sans description (null)", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 16 }]);

    await repo.createRetrait({
      compte_id: 2,
      client_id: 3,
      montant: 100,
      description: undefined,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO retraits"),
      [2, 3, 100, undefined]
    );
  });
});

describe("approuverRetrait", () => {
  it("met a jour le statut en APPROUVE", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.approuverRetrait(3, 1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'APPROUVE'"),
      [1, 3]
    );
  });
});

describe("rejeterRetrait", () => {
  it("met a jour le statut en REJETE", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.rejeterRetrait(4, 2, "Motif de rejet");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'REJETE'"),
      [2, 4]
    );
  });

  it("fonctionne sans notes", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.rejeterRetrait(5, 2, undefined);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'REJETE'"),
      [2, 5]
    );
  });
});

describe("debitAccountBalance", () => {
  it("debite le solde du compte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.debitAccountBalance(2, 300);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET solde = solde - ?"),
      [300, 2]
    );
  });
});

describe("findUserAutoValidation (retraits)", () => {
  it("retourne la valeur auto_validation si l'utilisateur existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ auto_validation: 1 }]]);

    const result = await repo.findUserAutoValidation(5);

    expect(result).toBe(1);
  });

  it("retourne 0 si l'utilisateur est introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]); // rows vide → ?? 0

    const result = await repo.findUserAutoValidation(999);

    expect(result).toBe(0);
  });
});

describe("createRetraitTransaction", () => {
  it("insere une transaction de retrait", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.createRetraitTransaction(2, 300, "Retrait en espèces");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      expect.arrayContaining([2, 300])
    );
  });

  it("utilise la description par defaut si absente", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.createRetraitTransaction(3, 100, null);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      expect.arrayContaining([3, 100])
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// executeApprouvementRetraitAtomique
// ─────────────────────────────────────────────────────────────────────────────

describe("executeApprouvementRetraitAtomique", () => {
  it("débite, met à jour le retrait, insère la transaction et commit (cas nominal)", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE comptes (débit OK)
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE retraits
      .mockResolvedValueOnce([{ insertId: 5 }]);     // INSERT transactions

    await repo.executeApprouvementRetraitAtomique(11, 7, 42, 100, "Retrait DAB");

    expect(mockConnBeginTx).toHaveBeenCalledTimes(1);
    expect(mockConnQuery).toHaveBeenCalledTimes(3);
    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnRollback).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
    expect(mockConnQuery.mock.calls[0][1]).toEqual([100, 42, 100]);
  });

  it("utilise 'Retrait en espèces' comme description par défaut si null", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ insertId: 6 }]);

    await repo.executeApprouvementRetraitAtomique(12, 7, 42, 50, null);

    expect(mockConnQuery.mock.calls[2][1]).toEqual([42, 50, "Retrait en espèces"]);
  });

  it("lève SOLDE_INSUFFISANT et rollback si débit affecte 0 ligne", async () => {
    mockConnQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

    await expect(
      repo.executeApprouvementRetraitAtomique(1, 1, 1, 999999, "x")
    ).rejects.toMatchObject({ code: "SOLDE_INSUFFISANT" });

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnCommit).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });

  it("rollback et propage l'erreur si une étape post-débit échoue", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // débit OK
      .mockRejectedValueOnce(new Error("UPDATE retraits failed"));

    await expect(
      repo.executeApprouvementRetraitAtomique(1, 1, 1, 50, "x")
    ).rejects.toThrow("UPDATE retraits failed");

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });
});
