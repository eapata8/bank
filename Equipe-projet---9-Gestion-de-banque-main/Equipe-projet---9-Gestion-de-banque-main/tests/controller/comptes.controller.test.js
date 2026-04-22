import { jest } from "@jest/globals";

const mockFindAccountsByUserId = jest.fn();
const mockFindAllAccounts = jest.fn();
const mockFindAnyAccountById = jest.fn();
const mockFindOwnedAccountById = jest.fn();
const mockFindOwnedAccountAccess = jest.fn();
const mockFindAccountById = jest.fn();
const mockFindTransactionsByAccountId = jest.fn();
const mockCreateCompteRecord = jest.fn();
const mockFindClientById = jest.fn();
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/comptes.data.js", () => ({
  findAccountsByUserId: mockFindAccountsByUserId,
  findAllAccounts: mockFindAllAccounts,
  findAnyAccountById: mockFindAnyAccountById,
  findOwnedAccountById: mockFindOwnedAccountById,
  findOwnedAccountAccess: mockFindOwnedAccountAccess,
  findAccountById: mockFindAccountById,
  findTransactionsByAccountId: mockFindTransactionsByAccountId,
  createCompte: mockCreateCompteRecord,
}));
await jest.unstable_mockModule("../../server/data/clients.data.js", () => ({
  findClientById: mockFindClientById,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const comptes = await import("../../server/controllers/comptes.controller.js");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  return { session: { user: { id: 1 } }, params: {}, query: {}, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
});

describe("Comptes Controller", () => {
  describe("getAccountTypes", () => {
    it("retourne les types CHEQUES, EPARGNE, CREDIT", async () => {
      const req = mockReq();
      const res = mockRes();
      await comptes.getAccountTypes(req, res);
      expect(res.json).toHaveBeenCalledWith({ data: ["CHEQUES", "EPARGNE", "CREDIT"] });
    });
  });

  describe("getMyAccounts", () => {
    it("retourne les comptes de l'utilisateur connecte", async () => {
      const rows = [{ id: 10, type_compte: "CHEQUES" }];
      mockFindAccountsByUserId.mockResolvedValueOnce(rows);
      const req = mockReq();
      const res = mockRes();
      await comptes.getMyAccounts(req, res);
      expect(mockFindAccountsByUserId).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("retourne tous les comptes pour un moderateur", async () => {
      const rows = [{ id: 10, type_compte: "CHEQUES" }];
      mockFindAllAccounts.mockResolvedValueOnce(rows);
      const req = mockReq({ session: { user: { id: 2, role: "MODERATEUR" } } });
      const res = mockRes();
      await comptes.getMyAccounts(req, res);
      expect(mockFindAllAccounts).toHaveBeenCalledWith("");
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("passe le terme de recherche a findAllAccounts pour un admin", async () => {
      mockFindAllAccounts.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: { search: "Clark" },
      });
      const res = mockRes();
      await comptes.getMyAccounts(req, res);
      expect(mockFindAllAccounts).toHaveBeenCalledWith("Clark");
    });

    it("cree un audit log pour un admin", async () => {
      mockFindAllAccounts.mockResolvedValueOnce([]);
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, query: {} });
      const res = mockRes();
      await comptes.getMyAccounts(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "VIEW_GLOBAL_ACCOUNTS" })
      );
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAccountsByUserId.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq();
      const res = mockRes();
      await comptes.getMyAccounts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Erreur serveur" }));
    });
  });

  describe("getAccountById", () => {
    it("retourne 400 si id invalide", async () => {
      const req = mockReq({ params: { id: "abc" } });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindAnyAccountById).not.toHaveBeenCalled();
    });

    it("retourne le compte si admin", async () => {
      const account = { id: 10, type_compte: "CHEQUES" };
      mockFindAnyAccountById.mockResolvedValueOnce(account);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "10" },
      });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(mockFindAnyAccountById).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith({ data: account });
    });

    it("retourne 404 si compte inexistant pour un admin", async () => {
      mockFindAnyAccountById.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "10" },
      });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne le compte si l'utilisateur en est proprietaire", async () => {
      const account = { id: 10, type_compte: "CHEQUES" };
      mockFindOwnedAccountById.mockResolvedValueOnce(account);
      const req = mockReq({ params: { id: "10" } });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(mockFindOwnedAccountById).toHaveBeenCalledWith(1, 10);
      expect(res.json).toHaveBeenCalledWith({ data: account });
    });

    it("retourne 404 si le compte n'existe pas pour un utilisateur", async () => {
      mockFindOwnedAccountById.mockResolvedValueOnce(null);
      mockFindAccountById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "10" } });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne 403 si le compte existe mais appartient a un autre", async () => {
      mockFindOwnedAccountById.mockResolvedValueOnce(null);
      mockFindAccountById.mockResolvedValueOnce({ id: 10 });
      const req = mockReq({ params: { id: "10" } });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Acces refuse" });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAccountsByUserId.mockRejectedValueOnce(new Error("DB error"));
      mockFindOwnedAccountById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "10" } });
      const res = mockRes();
      await comptes.getAccountById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getAccountTransactions", () => {
    it("retourne 400 si id invalide", async () => {
      const req = mockReq({ params: { id: "0" } });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockFindTransactionsByAccountId).not.toHaveBeenCalled();
    });

    it("retourne les transactions pour un admin", async () => {
      const tx = [{ id: 100, montant: 50 }];
      mockFindAccountById.mockResolvedValueOnce({ id: 10 });
      mockFindTransactionsByAccountId.mockResolvedValueOnce(tx);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "10" },
      });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(mockFindTransactionsByAccountId).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith({ data: tx });
    });

    it("retourne 404 si compte inexistant pour un admin", async () => {
      mockFindAccountById.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "77" },
      });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne 403 si compte non autorise pour un utilisateur", async () => {
      mockFindOwnedAccountAccess.mockResolvedValueOnce(null);
      mockFindAccountById.mockResolvedValueOnce({ id: 77 });
      const req = mockReq({ params: { id: "77" } });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("retourne 404 si compte inexistant pour un utilisateur", async () => {
      mockFindOwnedAccountAccess.mockResolvedValueOnce(null);
      mockFindAccountById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "77" } });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne les transactions si le compte est autorise pour un utilisateur", async () => {
      const tx = [{ id: 100, montant: 50 }];
      mockFindOwnedAccountAccess.mockResolvedValueOnce({ id: 10 });
      mockFindTransactionsByAccountId.mockResolvedValueOnce(tx);
      const req = mockReq({ params: { id: "10" } });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(mockFindTransactionsByAccountId).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith({ data: tx });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindOwnedAccountAccess.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "10" } });
      const res = mockRes();
      await comptes.getAccountTransactions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createCompte", () => {
    it("retourne 400 si des champs sont manquants", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 1 },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
      expect(mockCreateCompteRecord).not.toHaveBeenCalled();
    });

    it("retourne 400 si client_id est invalide", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 0, type_compte: "CHEQUES" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "client_id invalide" });
    });

    it("retourne 400 si client_id est negatif", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: -5, type_compte: "CHEQUES" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "client_id invalide" });
    });

    it("retourne 400 si le type de compte est invalide", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 1, type_compte: "INVALIDE" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Type de compte invalide" });
    });

    it("retourne 400 si last_four est fourni mais invalide", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 1, type_compte: "CHEQUES", last_four: "12" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "last_four doit etre 4 chiffres" });
    });

    it("retourne 404 si le client n'existe pas", async () => {
      mockFindClientById.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 99, type_compte: "CHEQUES" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Client introuvable" });
    });

    it("cree un compte CHEQUES et retourne 201", async () => {
      mockFindClientById.mockResolvedValueOnce({ id: 1 });
      mockCreateCompteRecord.mockResolvedValueOnce(20);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 1, type_compte: "CHEQUES", last_four: "4567" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(mockCreateCompteRecord).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 1, typeCompte: "CHEQUES", numeroCompte: expect.stringMatching(/\d{4} \d{4} 4567/) })
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_COMPTE" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }));
    });

    it("cree un compte pour un moderateur", async () => {
      mockFindClientById.mockResolvedValueOnce({ id: 2 });
      mockCreateCompteRecord.mockResolvedValueOnce(21);
      const req = mockReq({
        session: { user: { id: 2, role: "MODERATEUR" } },
        body: { client_id: 2, type_compte: "EPARGNE", last_four: "1234" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 21 }));
    });

    it("genere numero_compte automatiquement si last_four absent", async () => {
      mockFindClientById.mockResolvedValueOnce({ id: 1 });
      mockCreateCompteRecord.mockResolvedValueOnce(22);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 1, type_compte: "CREDIT" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(mockCreateCompteRecord).toHaveBeenCalledWith(
        expect.objectContaining({ typeCompte: "CREDIT" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindClientById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { client_id: 1, type_compte: "CHEQUES" },
      });
      const res = mockRes();
      await comptes.createCompte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
