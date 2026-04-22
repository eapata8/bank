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

const repo = await import("../../server/data/factures.data.js");

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

describe("findFactures", () => {
  it("retourne toutes les factures pour un admin (canReadAll=true)", async () => {
    const rows = [{ id: 1, fournisseur: "Hydro" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findFactures({ userId: 1, canReadAll: true, search: "" });

    expect(result).toEqual(rows);
  });

  it("filtre par utilisateur si canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2 }]]);

    await repo.findFactures({ userId: 5, canReadAll: false, search: "" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("utilisateur_id = ?"),
      [5]
    );
  });

  it("ajoute la condition de recherche texte", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3 }]]);

    await repo.findFactures({ userId: 1, canReadAll: true, search: "Bell" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("f.fournisseur LIKE ?"),
      expect.arrayContaining(["%Bell%"])
    );
  });

  it("gere une recherche numerique", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findFactures({ userId: 1, canReadAll: true, search: "5" });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([5])
    );
  });
});

describe("findFactureById", () => {
  it("retourne la facture si trouvee", async () => {
    const facture = { id: 1, fournisseur: "Bell", statut: "IMPAYEE" };
    mockDb.query.mockResolvedValueOnce([[facture]]);

    const result = await repo.findFactureById(1);

    expect(result).toEqual(facture);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE f.id = ?"),
      [1]
    );
  });

  it("retourne null si introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findFactureById(999);

    expect(result).toBeNull();
  });
});

describe("findAuthorizedFactureById", () => {
  it("retourne la facture autorisee pour l'utilisateur", async () => {
    const facture = { id: 2, fournisseur: "Hydro" };
    mockDb.query.mockResolvedValueOnce([[facture]]);

    const result = await repo.findAuthorizedFactureById(1, 2);

    expect(result).toEqual(facture);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE uc.utilisateur_id = ? AND f.id = ?"),
      [1, 2]
    );
  });

  it("retourne null si non autorisee", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAuthorizedFactureById(99, 2);

    expect(result).toBeNull();
  });
});

describe("findAccountForFacturePayment", () => {
  it("retourne le compte directement si canReadAll=true", async () => {
    const compte = { id: 3, client_id: 1, solde: 500, numero_compte: "**** 3333" };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findAccountForFacturePayment({
      userId: 1,
      factureClientId: 1,
      compteId: 3,
      canReadAll: true,
    });

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM comptes"),
      [3, 1]
    );
  });

  it("retourne null si compte introuvable avec canReadAll=true", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAccountForFacturePayment({
      userId: 1,
      factureClientId: 1,
      compteId: 999,
      canReadAll: true,
    });

    expect(result).toBeNull();
  });

  it("filtre par utilisateur_id si canReadAll=false", async () => {
    const compte = { id: 3, client_id: 1, solde: 200, numero_compte: "**** 3333" };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findAccountForFacturePayment({
      userId: 5,
      factureClientId: 1,
      compteId: 3,
      canReadAll: false,
    });

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("JOIN utilisateurs_clients"),
      [5, 3, 1]
    );
  });

  it("retourne null si non autorise avec canReadAll=false", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findAccountForFacturePayment({
      userId: 99,
      factureClientId: 1,
      compteId: 3,
      canReadAll: false,
    });

    expect(result).toBeNull();
  });
});

describe("createFacture", () => {
  it("insere une facture et retourne le resultat", async () => {
    const insertResult = { insertId: 20 };
    mockDb.query.mockResolvedValueOnce([insertResult]);

    const result = await repo.createFacture({
      clientId: 1,
      fournisseur: "Bell",
      referenceFacture: "FAC-001",
      description: "Facture mars",
      montant: 88.5,
      dateEmission: "2026-03-01",
      dateEcheance: "2026-03-20",
      statut: "IMPAYEE",
    });

    expect(result).toEqual(insertResult);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO factures"),
      [1, "Bell", "FAC-001", "Facture mars", 88.5, "2026-03-01", "2026-03-20", "IMPAYEE"]
    );
  });

  it("utilise null pour description si absente", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 21 }]);

    await repo.createFacture({
      clientId: 1,
      fournisseur: "Hydro",
      referenceFacture: "FAC-002",
      description: undefined,
      montant: 120,
      dateEmission: "2026-03-01",
      dateEcheance: "2026-03-20",
      statut: "IMPAYEE",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO factures"),
      [1, "Hydro", "FAC-002", null, 120, "2026-03-01", "2026-03-20", "IMPAYEE"]
    );
  });
});

describe("markFactureAsPaid", () => {
  it("marque la facture comme payee", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.markFactureAsPaid({ factureId: 5, compteId: 2 });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET statut = 'PAYEE'"),
      [2, 5]
    );
  });
});

describe("decrementAccountBalance", () => {
  it("decrement le solde du compte", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.decrementAccountBalance(3, 80);

    expect(mockDb.query).toHaveBeenCalledWith(
      "UPDATE comptes SET solde = solde - ? WHERE id = ?",
      [80, 3]
    );
  });
});

describe("createBillPaymentTransaction", () => {
  it("insere une transaction de paiement de facture", async () => {
    mockDb.query.mockResolvedValueOnce([{}]);

    await repo.createBillPaymentTransaction({
      compteId: 2,
      fournisseur: "Bell",
      factureId: 5,
      montant: 80,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      expect.arrayContaining([2, -80])
    );
  });
});

describe("findClientIdForUser", () => {
  it("retourne le client_id de l'utilisateur s'il existe", async () => {
    mockDb.query.mockResolvedValueOnce([[{ client_id: 7 }]]);

    const result = await repo.findClientIdForUser(3);

    expect(result).toBe(7);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT client_id"),
      [3]
    );
  });

  it("retourne null si l'utilisateur n'a pas de client associe", async () => {
    mockDb.query.mockResolvedValueOnce([[]]); // rows vide → rows[0] undefined → || null

    const result = await repo.findClientIdForUser(999);

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// executePayementFactureAtomique
// ─────────────────────────────────────────────────────────────────────────────

describe("executePayementFactureAtomique", () => {
  it("débite, marque la facture PAYEE, insère transaction et commit", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE comptes
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // UPDATE factures
      .mockResolvedValueOnce([{ insertId: 9 }]);     // INSERT transactions

    await repo.executePayementFactureAtomique({
      factureId: 12, compteId: 5, montant: 75.25, fournisseur: "Hydro",
    });

    expect(mockConnBeginTx).toHaveBeenCalledTimes(1);
    expect(mockConnQuery).toHaveBeenCalledTimes(3);
    expect(mockConnCommit).toHaveBeenCalledTimes(1);
    expect(mockConnRollback).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
    expect(mockConnQuery.mock.calls[0][1]).toEqual([75.25, 5, 75.25]);
    expect(mockConnQuery.mock.calls[2][1]).toEqual([5, "Paiement facture #12 - Hydro", -75.25]);
  });

  it("lève SOLDE_INSUFFISANT et rollback si débit échoue", async () => {
    mockConnQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

    await expect(
      repo.executePayementFactureAtomique({
        factureId: 1, compteId: 1, montant: 999, fournisseur: "X",
      })
    ).rejects.toMatchObject({ code: "SOLDE_INSUFFISANT" });

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnCommit).not.toHaveBeenCalled();
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });

  it("rollback et propage si une requête post-débit échoue", async () => {
    mockConnQuery
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockRejectedValueOnce(new Error("UPDATE factures failed"));

    await expect(
      repo.executePayementFactureAtomique({
        factureId: 1, compteId: 1, montant: 10, fournisseur: "X",
      })
    ).rejects.toThrow("UPDATE factures failed");

    expect(mockConnRollback).toHaveBeenCalledTimes(1);
    expect(mockConnRelease).toHaveBeenCalledTimes(1);
  });
});
