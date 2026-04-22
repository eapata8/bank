import { jest } from "@jest/globals";

/* ── Mocks des repositories ────────────────────── */
const mockFindAllUsers           = jest.fn();
const mockFindUserById           = jest.fn();
const mockGetFirstAdminId        = jest.fn();
const mockDeleteUserById         = jest.fn();
const mockUpdateUserRole         = jest.fn();
const mockResetUserPassword      = jest.fn();
const mockCreateAdminUser        = jest.fn();
const mockCreateModeratorUser    = jest.fn();
const mockFindUserIdByEmail      = jest.fn();
const mockFindAccountWithClient  = jest.fn();
const mockSetAccountBalance      = jest.fn();
const mockSetAccountStatus       = jest.fn();
const mockSetAccountType         = jest.fn();
const mockFindTransactionById    = jest.fn();
const mockInsertTransaction      = jest.fn();
const mockDeleteTransactionById  = jest.fn();
const mockAdjustBalanceBy        = jest.fn();
const mockFindVirementById       = jest.fn();
const mockInsertVirement         = jest.fn();
const mockDeleteVirementById     = jest.fn();
const mockDeleteTxByVirement     = jest.fn();
const mockFindAnyAccountById              = jest.fn();
const mockFindAccountByCoords             = jest.fn();
const mockFindPairedVirementTransaction   = jest.fn();
const mockUpdateAutoValidation            = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog                  = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/admin.data.js", () => ({
  findAllUsers:                       mockFindAllUsers,
  findUserById:                       mockFindUserById,
  getFirstAdminId:                    mockGetFirstAdminId,
  deleteUserById:                     mockDeleteUserById,
  updateUserRole:                     mockUpdateUserRole,
  resetUserPassword:                  mockResetUserPassword,
  createAdminUser:                    mockCreateAdminUser,
  createModeratorUser:                mockCreateModeratorUser,
  findUserIdByEmail:                  mockFindUserIdByEmail,
  findAccountWithClientInfo:          mockFindAccountWithClient,
  setAccountBalance:                  mockSetAccountBalance,
  setAccountStatus:                   mockSetAccountStatus,
  setAccountType:                     mockSetAccountType,
  findTransactionById:                mockFindTransactionById,
  insertTransaction:                  mockInsertTransaction,
  deleteTransactionById:              mockDeleteTransactionById,
  adjustBalanceBy:                    mockAdjustBalanceBy,
  findVirementById:                   mockFindVirementById,
  insertVirement:                     mockInsertVirement,
  deleteVirementById:                 mockDeleteVirementById,
  deleteTransactionsByVirementAccounts: mockDeleteTxByVirement,
  findPairedVirementTransaction:        mockFindPairedVirementTransaction,
  updateAutoValidation:                 mockUpdateAutoValidation,
}));

await jest.unstable_mockModule("../../server/data/comptes.data.js", () => ({
  findAnyAccountById: mockFindAnyAccountById,
}));

await jest.unstable_mockModule("../../server/data/virements.data.js", () => ({
  findAccountByCoords: mockFindAccountByCoords,
}));

await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const admin = await import("../../server/controllers/admin.controller.js");

/* ── Helpers ─────────────────────────────────────── */
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json   = jest.fn().mockReturnThis();
  return res;
}
function adminReq(overrides = {}) {
  return { session: { user: { id: 1, role: "ADMIN" } }, params: {}, query: {}, body: {}, ...overrides };
}
function modoReq(overrides = {}) {
  return { session: { user: { id: 2, role: "MODERATEUR" } }, params: {}, query: {}, body: {}, ...overrides };
}
const compte = { id: 10, solde: 1000, est_actif: 1, type_compte: "CHEQUES", client_prenom: "Jean", client_nom: "Dupont" };

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
});

/* ── adjustBalance ────────────────────────────────── */
describe("adjustBalance", () => {
  it("retourne 400 si id invalide", async () => {
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "abc" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant manquant", async () => {
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("montant") }));
  });

  it("retourne 400 si montant est 0", async () => {
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "0" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si compte introuvable", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("ajuste le solde et crée une transaction", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockSetAccountBalance.mockResolvedValueOnce(1);
    mockInsertTransaction.mockResolvedValueOnce(99);
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "200", motif: "Bonus" } }), res);
    expect(mockSetAccountBalance).toHaveBeenCalledWith(10, 1200);
    expect(mockInsertTransaction).toHaveBeenCalledWith(expect.objectContaining({ montant: 200 }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nouveau_solde: 1200 }));
  });

  it("retourne 500 en cas d'erreur", async () => {
    mockFindAccountWithClient.mockRejectedValueOnce(new Error("DB"));
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "50" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── adjustBalance (cas supplementaires) ─────────── */
describe("adjustBalance (edge cases)", () => {
  it("retourne 400 si type_transaction invalide (pas auto-determinable)", async () => {
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "100", type_transaction: "INCONNU" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("auto-determine RETRAIT si montant negatif", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockSetAccountBalance.mockResolvedValueOnce(1);
    mockInsertTransaction.mockResolvedValueOnce(55);
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "-300" } }), res);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ typeTransaction: "RETRAIT", montant: -300 })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nouveau_solde: 700 }));
  });
});

/* ── toggleAccountStatus ──────────────────────────── */
describe("toggleAccountStatus", () => {
  it("retourne 400 si id invalide", async () => {
    const res = mockRes();
    await admin.toggleAccountStatus(adminReq({ params: { id: "0" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("bloque un compte actif", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce({ ...compte, est_actif: 1 });
    mockSetAccountStatus.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.toggleAccountStatus(adminReq({ params: { id: "10" } }), res);
    expect(mockSetAccountStatus).toHaveBeenCalledWith(10, 0);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ est_actif: 0 }));
  });

  it("débloque un compte bloqué", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce({ ...compte, est_actif: 0 });
    mockSetAccountStatus.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.toggleAccountStatus(adminReq({ params: { id: "10" } }), res);
    expect(mockSetAccountStatus).toHaveBeenCalledWith(10, 1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ est_actif: 1 }));
  });

  it("retourne 404 si compte introuvable", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.toggleAccountStatus(adminReq({ params: { id: "10" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ── toggleAccountStatus (cas d'erreur) ──────────── */
describe("toggleAccountStatus (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindAccountWithClient.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.toggleAccountStatus(adminReq({ params: { id: "10" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── changeAccountType ────────────────────────────── */
describe("changeAccountType", () => {
  it("retourne 400 si type invalide", async () => {
    const res = mockRes();
    await admin.changeAccountType(adminReq({ params: { id: "10" }, body: { type_compte: "MAUVAIS" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("change le type de compte", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockSetAccountType.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.changeAccountType(adminReq({ params: { id: "10" }, body: { type_compte: "EPARGNE" } }), res);
    expect(mockSetAccountType).toHaveBeenCalledWith(10, "EPARGNE");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ type_compte: "EPARGNE" }));
  });
});

/* ── changeAccountType (cas d'erreur) ────────────── */
describe("changeAccountType (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindAccountWithClient.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.changeAccountType(adminReq({ params: { id: "10" }, body: { type_compte: "EPARGNE" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 400 si id invalide", async () => {
    const res = mockRes();
    await admin.changeAccountType(adminReq({ params: { id: "0" }, body: { type_compte: "EPARGNE" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── addTransaction ───────────────────────────────── */
describe("addTransaction", () => {
  it("retourne 400 si montant est 0", async () => {
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "10" }, body: { montant: "0" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si type_transaction invalide", async () => {
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "10" }, body: { montant: "100", type_transaction: "INCONNU" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("insère une transaction et ajuste le solde", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockInsertTransaction.mockResolvedValueOnce(50);
    mockAdjustBalanceBy.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "10" }, body: { montant: "100", type_transaction: "DEPOT" } }), res);
    expect(mockInsertTransaction).toHaveBeenCalledWith(expect.objectContaining({ montant: 100 }));
    expect(mockAdjustBalanceBy).toHaveBeenCalledWith(10, 100);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("n'ajuste pas le solde si ajuster_solde=false", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockInsertTransaction.mockResolvedValueOnce(51);
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "10" }, body: { montant: "100", ajuster_solde: false } }), res);
    expect(mockAdjustBalanceBy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ── addTransaction (cas d'erreur) ───────────────── */
describe("addTransaction (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindAccountWithClient.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "10" }, body: { montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 400 si id invalide", async () => {
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "0" }, body: { montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── removeTransaction ────────────────────────────── */
describe("removeTransaction", () => {
  it("retourne 400 si txId invalide", async () => {
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "0" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si transaction introuvable", async () => {
    mockFindTransactionById.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "99" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("supprime la transaction et reverse le solde", async () => {
    const tx = { id: 10, compte_id: 5, montant: 200 };
    mockFindTransactionById.mockResolvedValueOnce(tx);
    mockDeleteTransactionById.mockResolvedValueOnce(1);
    mockAdjustBalanceBy.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "10" } }), res);
    expect(mockDeleteTransactionById).toHaveBeenCalledWith(10);
    expect(mockAdjustBalanceBy).toHaveBeenCalledWith(5, -200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("ne reverse pas le solde si reverser_solde=false", async () => {
    const tx = { id: 10, compte_id: 5, montant: 200 };
    mockFindTransactionById.mockResolvedValueOnce(tx);
    mockDeleteTransactionById.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "10" }, body: { reverser_solde: false } }), res);
    expect(mockAdjustBalanceBy).not.toHaveBeenCalled();
  });
});

/* ── removeTransaction (cas d'erreur et virement) ── */
describe("removeTransaction (cas supplementaires)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindTransactionById.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "10" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("reverse la transaction jumelee si type VIREMENT", async () => {
    const tx = { id: 10, compte_id: 5, montant: 200, type_transaction: "VIREMENT", date_transaction: new Date() };
    const paired = { id: 11, compte_id: 6, montant: -200 };
    mockFindTransactionById.mockResolvedValueOnce(tx);
    mockDeleteTransactionById.mockResolvedValueOnce(1);
    mockAdjustBalanceBy.mockResolvedValue(1);
    mockFindPairedVirementTransaction.mockResolvedValueOnce(paired);
    mockDeleteTransactionById.mockResolvedValueOnce(1);
    mockAdjustBalanceBy.mockResolvedValue(1);
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "10" } }), res);
    expect(mockFindPairedVirementTransaction).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("ne cherche pas de transaction jumelee si type non-VIREMENT", async () => {
    const tx = { id: 10, compte_id: 5, montant: 150, type_transaction: "DEPOT", date_transaction: new Date() };
    mockFindTransactionById.mockResolvedValueOnce(tx);
    mockDeleteTransactionById.mockResolvedValueOnce(1);
    mockAdjustBalanceBy.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "10" } }), res);
    expect(mockFindPairedVirementTransaction).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

/* ── addVirement ──────────────────────────────────── */
const virBodyBase = {
  numero_compte_source: "4821 3390 4521", numero_institution_source: "621", numero_transit_source: "10482",
  numero_compte_dest:   "6214 8820 1104", numero_institution_dest:   "621", numero_transit_dest:   "23815",
};

describe("addVirement", () => {
  it("retourne 400 si coordonnées manquantes", async () => {
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", async () => {
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { ...virBodyBase, montant: "-50" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si compte source introuvable", async () => {
    mockFindAccountByCoords.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 });
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { ...virBodyBase, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("insère un virement ACCEPTE et ajuste les soldes", async () => {
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    mockInsertVirement.mockResolvedValueOnce(20);
    mockAdjustBalanceBy.mockResolvedValue(1);
    mockInsertTransaction.mockResolvedValue(100);
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { ...virBodyBase, montant: "300", statut: "ACCEPTE", ajuster_soldes: true } }), res);
    expect(mockInsertVirement).toHaveBeenCalledWith(expect.objectContaining({ montant: 300 }));
    expect(mockAdjustBalanceBy).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("n'ajuste pas les soldes si statut REFUSE", async () => {
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    mockInsertVirement.mockResolvedValueOnce(21);
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { ...virBodyBase, montant: "100", statut: "REFUSE" } }), res);
    expect(mockAdjustBalanceBy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ── addVirement (cas d'erreur) ──────────────────── */
describe("addVirement (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindAccountByCoords.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { ...virBodyBase, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 404 si compte destination introuvable", async () => {
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.addVirement(adminReq({ body: { ...virBodyBase, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ── removeVirement ───────────────────────────────── */
describe("removeVirement", () => {
  it("retourne 404 si virement introuvable", async () => {
    mockFindVirementById.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.removeVirement(adminReq({ params: { virementId: "99" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("supprime le virement et reverse les soldes si ACCEPTE", async () => {
    const virement = { id: 5, compte_source_id: 1, compte_destination_id: 2, montant: "500", statut: "ACCEPTE", date_virement: new Date() };
    mockFindVirementById.mockResolvedValueOnce(virement);
    mockDeleteTxByVirement.mockResolvedValueOnce(undefined);
    mockAdjustBalanceBy.mockResolvedValue(1);
    mockDeleteVirementById.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.removeVirement(adminReq({ params: { virementId: "5" } }), res);
    expect(mockAdjustBalanceBy).toHaveBeenCalledWith(1, 500);
    expect(mockAdjustBalanceBy).toHaveBeenCalledWith(2, -500);
    expect(mockDeleteVirementById).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("ne reverse pas si reverser_soldes=false", async () => {
    const virement = { id: 5, compte_source_id: 1, compte_destination_id: 2, montant: "500", statut: "ACCEPTE", date_virement: new Date() };
    mockFindVirementById.mockResolvedValueOnce(virement);
    mockDeleteVirementById.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.removeVirement(adminReq({ params: { virementId: "5" }, body: { reverser_soldes: false } }), res);
    expect(mockAdjustBalanceBy).not.toHaveBeenCalled();
  });
});

/* ── removeVirement (cas d'erreur) ───────────────── */
describe("removeVirement (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindVirementById.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.removeVirement(adminReq({ params: { virementId: "5" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── forceTransfer ────────────────────────────────── */
const ftDestCoords = { numero_compte_dest: "6214 8820 1104", numero_institution_dest: "621", numero_transit_dest: "23815" };

describe("forceTransfer", () => {
  it("retourne 400 si coordonnées destination manquantes", async () => {
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si comptes identiques (même ID après lookup)", async () => {
    mockFindAnyAccountById.mockResolvedValueOnce({ id: 1 });
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 1 });
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", ...ftDestCoords, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("effectue le transfert forcé", async () => {
    mockFindAnyAccountById.mockResolvedValueOnce({ id: 1 });
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 2 });
    mockInsertVirement.mockResolvedValueOnce(30);
    mockAdjustBalanceBy.mockResolvedValue(1);
    mockInsertTransaction.mockResolvedValue(200);
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", ...ftDestCoords, montant: "1000" } }), res);
    expect(mockAdjustBalanceBy).toHaveBeenCalledWith(1, -1000);
    expect(mockAdjustBalanceBy).toHaveBeenCalledWith(2, 1000);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }));
  });
});

/* ── forceTransfer (cas d'erreur) ────────────────── */
describe("forceTransfer (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindAnyAccountById.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", ...ftDestCoords, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 400 si montant invalide ou zero", async () => {
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", ...ftDestCoords, montant: "0" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si compte source introuvable", async () => {
    mockFindAnyAccountById.mockResolvedValueOnce(null);
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 2 });
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", ...ftDestCoords, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 404 si compte destination introuvable", async () => {
    mockFindAnyAccountById.mockResolvedValueOnce({ id: 1 });
    mockFindAccountByCoords.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.forceTransfer(adminReq({ body: { compte_source_id: "1", ...ftDestCoords, montant: "100" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ── getUsers ─────────────────────────────────────── */
describe("getUsers", () => {
  it("retourne tous les utilisateurs", async () => {
    const users = [{ id: 1, email: "a@a.com", role: "ADMIN" }];
    mockFindAllUsers.mockResolvedValueOnce(users);
    const res = mockRes();
    await admin.getUsers(adminReq(), res);
    expect(res.json).toHaveBeenCalledWith({ data: users });
  });

  it("retourne 500 en cas d'erreur", async () => {
    mockFindAllUsers.mockRejectedValueOnce(new Error("DB"));
    const res = mockRes();
    await admin.getUsers(adminReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── deleteUser (cas d'erreur) ───────────────────── */
describe("deleteUser (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockGetFirstAdminId.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.deleteUser(adminReq({ params: { id: "3" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── deleteUser ───────────────────────────────────── */
describe("deleteUser", () => {
  it("retourne 400 si id invalide", async () => {
    const res = mockRes();
    await admin.deleteUser(adminReq({ params: { id: "0" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("refuse de supprimer le premier admin", async () => {
    mockGetFirstAdminId.mockResolvedValueOnce(5);
    const res = mockRes();
    await admin.deleteUser(adminReq({ params: { id: "5" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("premier administrateur") }));
    expect(mockDeleteUserById).not.toHaveBeenCalled();
  });

  it("retourne 404 si utilisateur introuvable", async () => {
    mockGetFirstAdminId.mockResolvedValueOnce(1);
    mockFindUserById.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.deleteUser(adminReq({ params: { id: "99" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("supprime un utilisateur normal", async () => {
    mockGetFirstAdminId.mockResolvedValueOnce(1);
    mockFindUserById.mockResolvedValueOnce({ id: 3, email: "u@u.com", role: "UTILISATEUR" });
    mockDeleteUserById.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.deleteUser(adminReq({ params: { id: "3" } }), res);
    expect(mockDeleteUserById).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

/* ── changeUserRole (cas d'erreur) ───────────────── */
describe("changeUserRole (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindUserById.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.changeUserRole(adminReq({ params: { id: "2" }, body: { role: "MODERATEUR" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── changeUserRole ───────────────────────────────── */
describe("changeUserRole", () => {
  it("retourne 400 si rôle invalide", async () => {
    const res = mockRes();
    await admin.changeUserRole(adminReq({ params: { id: "2" }, body: { role: "SUPERADMIN" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si utilisateur introuvable", async () => {
    mockFindUserById.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.changeUserRole(adminReq({ params: { id: "99" }, body: { role: "MODERATEUR" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("change le rôle de l'utilisateur", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 2, email: "u@u.com", role: "UTILISATEUR" });
    mockUpdateUserRole.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.changeUserRole(adminReq({ params: { id: "2" }, body: { role: "MODERATEUR" } }), res);
    expect(mockUpdateUserRole).toHaveBeenCalledWith(2, "MODERATEUR");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: "MODERATEUR" }));
  });
});

/* ── resetPassword (cas d'erreur) ────────────────── */
describe("resetPassword (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindUserById.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.resetPassword(adminReq({ params: { id: "2" }, body: { nouveau_mot_de_passe: "password123" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── resetPassword ────────────────────────────────── */
describe("resetPassword", () => {
  it("retourne 400 si mot de passe trop court", async () => {
    const res = mockRes();
    await admin.resetPassword(adminReq({ params: { id: "2" }, body: { nouveau_mot_de_passe: "abc" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si utilisateur introuvable", async () => {
    mockFindUserById.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.resetPassword(adminReq({ params: { id: "99" }, body: { nouveau_mot_de_passe: "password123" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("réinitialise le mot de passe", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 2, email: "u@u.com" });
    mockResetUserPassword.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.resetPassword(adminReq({ params: { id: "2" }, body: { nouveau_mot_de_passe: "newpassword123" } }), res);
    expect(mockResetUserPassword).toHaveBeenCalledWith(2, "newpassword123");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

/* ── createAdmin (cas d'erreur) ──────────────────── */
describe("createAdmin (cas supplementaire)", () => {
  it("retourne 400 si id invalide pour changeUserRole", async () => {
    const res = mockRes();
    await admin.changeUserRole(adminReq({ params: { id: "0" }, body: { role: "MODERATEUR" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── createAdmin ──────────────────────────────────── */
describe("createAdmin", () => {
  it("retourne 400 si champs manquants", async () => {
    const res = mockRes();
    await admin.createAdmin(adminReq({ body: { email: "a@a.com" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Champs manquants") }));
  });

  it("retourne 400 si mot de passe trop court", async () => {
    const res = mockRes();
    await admin.createAdmin(adminReq({ body: { email: "a@a.com", motDePasse: "abc", prenom: "A", nom: "B" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 409 si email déjà utilisé", async () => {
    mockFindUserIdByEmail.mockResolvedValueOnce({ id: 1 });
    const res = mockRes();
    await admin.createAdmin(adminReq({ body: { email: "a@a.com", motDePasse: "password", prenom: "A", nom: "B" } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("crée un administrateur", async () => {
    mockFindUserIdByEmail.mockResolvedValueOnce(null);
    mockCreateAdminUser.mockResolvedValueOnce(10);
    const res = mockRes();
    await admin.createAdmin(adminReq({ body: { email: "new@a.com", motDePasse: "password123", prenom: "Nou", nom: "Admin" } }), res);
    expect(mockCreateAdminUser).toHaveBeenCalledWith(expect.objectContaining({ email: "new@a.com" }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it("retourne 500 en cas d'erreur", async () => {
    mockFindUserIdByEmail.mockRejectedValueOnce(new Error("DB"));
    const res = mockRes();
    await admin.createAdmin(adminReq({ body: { email: "a@a.com", motDePasse: "password", prenom: "A", nom: "B" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── createModerator ──────────────────────────────── */
describe("createModerator", () => {
  it("retourne 400 si champs manquants", async () => {
    const res = mockRes();
    await admin.createModerator(adminReq({ body: { email: "m@m.com" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si mot de passe trop court", async () => {
    const res = mockRes();
    await admin.createModerator(adminReq({ body: { email: "m@m.com", motDePasse: "abc", prenom: "M", nom: "N" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 409 si email déjà utilisé", async () => {
    mockFindUserIdByEmail.mockResolvedValueOnce({ id: 5 });
    const res = mockRes();
    await admin.createModerator(adminReq({ body: { email: "m@m.com", motDePasse: "password", prenom: "M", nom: "N" } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("crée un modérateur (appelé par un admin)", async () => {
    mockFindUserIdByEmail.mockResolvedValueOnce(null);
    mockCreateModeratorUser.mockResolvedValueOnce(20);
    const res = mockRes();
    await admin.createModerator(adminReq({ body: { email: "new@m.com", motDePasse: "password123", prenom: "Nou", nom: "Modo" } }), res);
    expect(mockCreateModeratorUser).toHaveBeenCalledWith(expect.objectContaining({ email: "new@m.com" }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }));
  });

  it("crée un modérateur (appelé par un modérateur)", async () => {
    mockFindUserIdByEmail.mockResolvedValueOnce(null);
    mockCreateModeratorUser.mockResolvedValueOnce(21);
    const res = mockRes();
    await admin.createModerator(modoReq({ body: { email: "mod2@m.com", motDePasse: "password123", prenom: "M2", nom: "D" } }), res);
    expect(mockCreateModeratorUser).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ── createModerator (cas d'erreur) ──────────────── */
describe("createModerator (erreur serveur)", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindUserIdByEmail.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.createModerator(adminReq({ body: { email: "m@m.com", motDePasse: "password123", prenom: "M", nom: "N" } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── setAutoValidation ────────────────────────────── */
describe("setAutoValidation", () => {
  it("retourne 400 si id invalide", async () => {
    const res = mockRes();
    await admin.setAutoValidation(adminReq({ params: { id: "0" }, body: { auto_validation: true } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si utilisateur introuvable", async () => {
    mockFindUserById.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.setAutoValidation(adminReq({ params: { id: "99" }, body: { auto_validation: true } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Utilisateur introuvable" });
  });

  it("active l'auto-validation et crée un audit log", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 5, email: "u@u.com" });
    mockUpdateAutoValidation.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await admin.setAutoValidation(adminReq({ params: { id: "5" }, body: { auto_validation: true } }), res);
    expect(mockUpdateAutoValidation).toHaveBeenCalledWith(5, true);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SET_AUTO_VALIDATION", details: expect.stringContaining("activée") })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("activée") }));
  });

  it("désactive l'auto-validation", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 5, email: "u@u.com" });
    mockUpdateAutoValidation.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await admin.setAutoValidation(adminReq({ params: { id: "5" }, body: { auto_validation: false } }), res);
    expect(mockUpdateAutoValidation).toHaveBeenCalledWith(5, false);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("désactivée") }));
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindUserById.mockRejectedValueOnce(new Error("DB error"));
    const res = mockRes();
    await admin.setAutoValidation(adminReq({ params: { id: "5" }, body: { auto_validation: true } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── changeUserRole — restriction modérateur ──────── */
describe("changeUserRole — restriction modérateur", () => {
  it("refuse qu'un modérateur assigne le rôle ADMIN", async () => {
    const res = mockRes();
    await admin.changeUserRole(modoReq({ params: { id: "3" }, body: { role: "ADMIN" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("ADMIN") }));
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  it("permet à un modérateur d'assigner MODERATEUR", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 3, email: "u@u.com", role: "UTILISATEUR" });
    mockUpdateUserRole.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.changeUserRole(modoReq({ params: { id: "3" }, body: { role: "MODERATEUR" } }), res);
    expect(mockUpdateUserRole).toHaveBeenCalledWith(3, "MODERATEUR");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: "MODERATEUR" }));
  });

  it("permet à un modérateur de rétrograder vers UTILISATEUR", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 4, email: "m@m.com", role: "MODERATEUR" });
    mockUpdateUserRole.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.changeUserRole(modoReq({ params: { id: "4" }, body: { role: "UTILISATEUR" } }), res);
    expect(mockUpdateUserRole).toHaveBeenCalledWith(4, "UTILISATEUR");
  });

  it("refuse qu'un modérateur modifie le rôle d'un compte ADMIN (bug fix)", async () => {
    mockFindUserById.mockResolvedValueOnce({ id: 5, email: "admin@Leon.local", role: "ADMIN" });
    const res = mockRes();
    await admin.changeUserRole(modoReq({ params: { id: "5" }, body: { role: "UTILISATEUR" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("administrateur") })
    );
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  it("refuse qu'un admin modifie son propre rôle", async () => {
    const res = mockRes();
    // adminReq has session.user.id = 1 ; on tente de modifier l'id 1
    await admin.changeUserRole(adminReq({ params: { id: "1" }, body: { role: "UTILISATEUR" } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("propre rôle") })
    );
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });
});

/* ── adjustBalance (branche "+" montant positif sans motif) ── */
describe("adjustBalance (branche + montant positif sans motif)", () => {
  it("génère une description avec '+' si montant positif et aucun motif", async () => {
    const compte = { id: 10, solde: 1000, client_prenom: "Alice", client_nom: "Martin" };
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockSetAccountBalance.mockResolvedValueOnce(1);
    mockInsertTransaction.mockResolvedValueOnce(88);
    const res = mockRes();
    await admin.adjustBalance(adminReq({ params: { id: "10" }, body: { montant: "50" } }), res);
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("+") })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nouveau_solde: 1050 }));
  });
});

/* ── changeAccountType (compte introuvable) ──────────── */
describe("changeAccountType (compte introuvable)", () => {
  it("retourne sans appeler setAccountType si le compte est introuvable", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.changeAccountType(adminReq({ params: { id: "10" }, body: { type_compte: "CREDIT" } }), res);
    expect(mockSetAccountType).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

/* ── addTransaction (branches manquantes) ────────────── */
describe("addTransaction (branches manquantes)", () => {
  it("retourne sans insérer si le compte est introuvable", async () => {
    mockFindAccountWithClient.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.addTransaction(adminReq({ params: { id: "10" }, body: { montant: "100" } }), res);
    expect(mockInsertTransaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("insère avec une date de transaction fournie explicitement", async () => {
    const compte = { id: 10, solde: 500, client_prenom: "Bob", client_nom: "Tremblay" };
    mockFindAccountWithClient.mockResolvedValueOnce(compte);
    mockInsertTransaction.mockResolvedValueOnce(77);
    mockAdjustBalanceBy.mockResolvedValueOnce(1);
    const res = mockRes();
    await admin.addTransaction(
      adminReq({ params: { id: "10" }, body: { montant: "100", date_transaction: "2025-06-15" } }),
      res
    );
    expect(mockInsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ dateTransaction: expect.any(Date) })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ── removeTransaction (VIREMENT sans transaction jumelée) ── */
describe("removeTransaction (VIREMENT sans transaction jumelée)", () => {
  it("supprime la transaction VIREMENT sans erreur si pas de transaction jumelée trouvée", async () => {
    const tx = { id: 10, compte_id: 5, montant: 200, type_transaction: "VIREMENT", date_transaction: new Date() };
    mockFindTransactionById.mockResolvedValueOnce(tx);
    mockDeleteTransactionById.mockResolvedValueOnce(1);
    mockAdjustBalanceBy.mockResolvedValue(1);
    mockFindPairedVirementTransaction.mockResolvedValueOnce(null);
    const res = mockRes();
    await admin.removeTransaction(adminReq({ params: { txId: "10" } }), res);
    expect(mockFindPairedVirementTransaction).toHaveBeenCalled();
    expect(mockDeleteTransactionById).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

/* ── addVirement (date_virement fournie) ──────────────── */
describe("addVirement (date_virement fournie)", () => {
  it("insère un virement avec une date fournie explicitement", async () => {
    mockFindAccountByCoords.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    mockInsertVirement.mockResolvedValueOnce(42);
    mockAdjustBalanceBy.mockResolvedValue(1);
    mockInsertTransaction.mockResolvedValue(100);
    const res = mockRes();
    await admin.addVirement(
      adminReq({ body: { ...virBodyBase, montant: "200", ajuster_soldes: true, date_virement: "2025-03-10" } }),
      res
    );
    expect(mockInsertVirement).toHaveBeenCalledWith(
      expect.objectContaining({ dateVirement: expect.any(Date) })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
