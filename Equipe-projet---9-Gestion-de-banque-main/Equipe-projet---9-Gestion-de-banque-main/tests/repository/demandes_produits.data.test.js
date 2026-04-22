import { jest } from "@jest/globals";

/* ── Mock DB ──────────────────────────────────────── */
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

const repo = await import("../../server/data/demandes_produits.data.js");

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

/* ── findAllDemandes ──────────────────────────────── */
describe("findAllDemandes", () => {
  it("retourne toutes les demandes pour un admin (canReadAll=true)", async () => {
    const rows = [{ id: 1, type_produit: "CARTE_VISA", statut: "EN_ATTENTE" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findAllDemandes({ userId: 1, canReadAll: true });

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.not.stringContaining("utilisateurs_clients"),
      []
    );
  });

  it("filtre par utilisateur si canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2 }]]);

    await repo.findAllDemandes({ userId: 5, canReadAll: false });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("utilisateurs_clients"),
      [5]
    );
  });

  it("inclut les infos client enrichies dans la requete", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findAllDemandes({ userId: 1, canReadAll: true });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("c.prenom"),
      expect.anything()
    );
  });

  it("trie par date decroissante", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findAllDemandes({ userId: 1, canReadAll: true });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY dp.cree_le DESC"),
      expect.anything()
    );
  });
});

/* ── findDemandeById ──────────────────────────────── */
describe("findDemandeById", () => {
  it("retourne la demande si trouvee", async () => {
    const demande = { id: 5, type_produit: "COMPTE_CHEQUES", statut: "EN_ATTENTE" };
    mockDb.query.mockResolvedValueOnce([[demande]]);

    const result = await repo.findDemandeById(5);

    expect(result).toEqual(demande);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE dp.id = ?"),
      [5]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findDemandeById(999);

    expect(result).toBeNull();
  });

  it("inclut le nom du traitant via LEFT JOIN utilisateurs", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findDemandeById(1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN utilisateurs u ON u.id = dp.traite_par"),
      [1]
    );
  });
});

/* ── hasPendingDemande ────────────────────────────── */
describe("hasPendingDemande", () => {
  it("retourne true si une demande EN_ATTENTE existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    const result = await repo.hasPendingDemande(3, "CARTE_VISA");

    expect(result).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("statut = 'EN_ATTENTE'"),
      [3, "CARTE_VISA"]
    );
  });

  it("retourne false si aucune demande EN_ATTENTE", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.hasPendingDemande(3, "CARTE_MASTERCARD");

    expect(result).toBe(false);
  });
});

/* ── createDemande ────────────────────────────────── */
describe("createDemande", () => {
  it("insere une demande et retourne l'insertId", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 42 }]);

    const id = await repo.createDemande({
      client_id: 1,
      type_produit: "CARTE_VISA",
      notes: "Demande urgente",
      limite_credit: 3000,
    });

    expect(id).toBe(42);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO demandes_produits"),
      [1, "CARTE_VISA", "Demande urgente", 3000]
    );
  });

  it("accepte notes et limite_credit null", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 7 }]);

    const id = await repo.createDemande({
      client_id: 2,
      type_produit: "COMPTE_EPARGNE",
      notes: null,
      limite_credit: null,
    });

    expect(id).toBe(7);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      [2, "COMPTE_EPARGNE", null, null]
    );
  });
});

/* ── approuverDemande (CARTE_VISA) ───────────────── */
describe("approuverDemande — CARTE_VISA", () => {
  it("met a jour le statut et cree une carte VISA en transaction", async () => {
    mockConnQuery.mockResolvedValue([{}]);

    await repo.approuverDemande(1, 99, {
      client_id: 5,
      type_produit: "CARTE_VISA",
      limite_credit: 5000,
    });

    expect(mockConnBeginTx).toHaveBeenCalledTimes(1);
    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnRelease).toHaveBeenCalledTimes(1);

    // Première requête : UPDATE statut
    expect(mockConnQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("statut = 'APPROUVEE'"),
      [99, 1]
    );

    // Deuxième requête : INSERT carte VISA
    expect(mockConnQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO cartes_credit"),
      expect.arrayContaining([5, "VISA", 5000])
    );
  });

  it("rollback si une erreur survient", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{}])  // UPDATE OK
      .mockRejectedValueOnce(new Error("DB error")); // INSERT fail

    await expect(
      repo.approuverDemande(1, 99, { client_id: 5, type_produit: "CARTE_VISA", limite_credit: 5000 })
    ).rejects.toThrow("DB error");

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });
});

/* ── approuverDemande (CARTE_MASTERCARD) ─────────── */
describe("approuverDemande — CARTE_MASTERCARD", () => {
  it("cree une carte MASTERCARD avec prefixe 5", async () => {
    mockConnQuery.mockResolvedValue([{}]);

    await repo.approuverDemande(2, 99, {
      client_id: 6,
      type_produit: "CARTE_MASTERCARD",
      limite_credit: null,
    });

    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    // Le numero de carte doit commencer par 5
    const insertCall = mockConnQuery.mock.calls[1];
    const numeroCarte = insertCall[1][1]; // deuxième argument de la deuxième requête
    expect(numeroCarte).toMatch(/^5/);
    // La limite par defaut est 5000
    expect(insertCall[1]).toContain(5000);
  });
});

/* ── approuverDemande (COMPTE_CHEQUES) ───────────── */
describe("approuverDemande — COMPTE_CHEQUES", () => {
  it("cree un compte CHEQUES en transaction", async () => {
    mockConnQuery.mockResolvedValue([{}]);

    await repo.approuverDemande(3, 99, {
      client_id: 7,
      type_produit: "COMPTE_CHEQUES",
      limite_credit: null,
    });

    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO comptes"),
      expect.arrayContaining([7, "CHEQUES"])
    );
  });
});

/* ── approuverDemande (COMPTE_EPARGNE) ───────────── */
describe("approuverDemande — COMPTE_EPARGNE", () => {
  it("cree un compte EPARGNE en transaction", async () => {
    mockConnQuery.mockResolvedValue([{}]);

    await repo.approuverDemande(4, 99, {
      client_id: 8,
      type_produit: "COMPTE_EPARGNE",
      limite_credit: null,
    });

    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO comptes"),
      expect.arrayContaining([8, "EPARGNE"])
    );
  });
});

/* ── isDemandeOwner ───────────────────────────────── */
describe("isDemandeOwner", () => {
  it("retourne true si l'utilisateur est lie au client de la demande", async () => {
    mockDb.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    const result = await repo.isDemandeOwner(10, 5);

    expect(result).toBe(true);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("utilisateurs_clients uc"),
      [10, 5]
    );
  });

  it("retourne false si aucun lien", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.isDemandeOwner(10, 999);

    expect(result).toBe(false);
  });
});

/* ── annulerDemande ───────────────────────────────── */
describe("annulerDemande", () => {
  it("supprime une demande EN_ATTENTE et retourne le nombre de lignes", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const affected = await repo.annulerDemande(42);

    expect(affected).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM demandes_produits"),
      [42]
    );
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("statut = 'EN_ATTENTE'"),
      [42]
    );
  });

  it("retourne 0 si la demande n'est pas EN_ATTENTE", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const affected = await repo.annulerDemande(42);

    expect(affected).toBe(0);
  });
});

/* ── findUserAutoValidation ───────────────────────── */
describe("findUserAutoValidation", () => {
  it("retourne 1 si auto_validation activée", async () => {
    mockDb.query.mockResolvedValueOnce([[{ auto_validation: 1 }]]);

    const result = await repo.findUserAutoValidation(42);

    expect(result).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT auto_validation FROM utilisateurs"),
      [42]
    );
  });

  it("retourne 0 si auto_validation désactivée", async () => {
    mockDb.query.mockResolvedValueOnce([[{ auto_validation: 0 }]]);

    const result = await repo.findUserAutoValidation(7);

    expect(result).toBe(0);
  });

  it("retourne 0 par défaut si utilisateur introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findUserAutoValidation(999);

    expect(result).toBe(0);
  });
});

/* ── refuserDemande ───────────────────────────────── */
describe("refuserDemande", () => {
  it("met a jour le statut a REFUSEE", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.refuserDemande(10, 5, "Profil incomplet");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("statut = 'REFUSEE'"),
      [5, "Profil incomplet", 10]
    );
  });

  it("accepte notes null", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.refuserDemande(11, 5, null);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      [5, null, 11]
    );
  });
});
