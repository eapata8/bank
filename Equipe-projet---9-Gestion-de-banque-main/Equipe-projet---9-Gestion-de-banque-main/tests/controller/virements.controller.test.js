import { jest } from "@jest/globals";

const mockFindVirements = jest.fn();
const mockFindAuthorizedSourceAccount = jest.fn();
const mockFindAccountById = jest.fn();
const mockFindAccountByCoords = jest.fn();
const mockFindAuthorizedDestinationAccount = jest.fn();
const mockExecuteVirementAtomique = jest.fn();
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/virements.data.js", () => ({
  findVirements: mockFindVirements,
  findAuthorizedSourceAccount: mockFindAuthorizedSourceAccount,
  findAccountById: mockFindAccountById,
  findAccountByCoords: mockFindAccountByCoords,
  findAuthorizedDestinationAccount: mockFindAuthorizedDestinationAccount,
  executeVirementAtomique: mockExecuteVirementAtomique,
  // conservées pour compatibilité avec d'autres modules importés
  createVirementRecord: jest.fn(),
  decrementAccountBalance: jest.fn(),
  incrementAccountBalance: jest.fn(),
  createTransferTransactions: jest.fn(),
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const virements = await import("../../server/controllers/virements.controller.js");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  return { session: { user: { id: 1 } }, body: {}, query: {}, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockExecuteVirementAtomique.mockResolvedValue(12);
  mockFindAccountByCoords.mockResolvedValue(null);
});

describe("Virements Controller", () => {
  describe("getVirements", () => {
    it("retourne les virements de l'utilisateur connecte", async () => {
      const rows = [{ id: 1, montant: 100 }];
      mockFindVirements.mockResolvedValueOnce(rows);
      const req = mockReq({ query: {} });
      const res = mockRes();
      await virements.getVirements(req, res);
      expect(mockFindVirements).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, isAdmin: false, search: "" })
      );
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("passe le terme de recherche a findVirements pour un admin", async () => {
      mockFindVirements.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: { search: "Ottawa" },
      });
      const res = mockRes();
      await virements.getVirements(req, res);
      expect(mockFindVirements).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true, search: "Ottawa" })
      );
    });

    it("cree un audit log pour un admin", async () => {
      mockFindVirements.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: {},
      });
      const res = mockRes();
      await virements.getVirements(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "VIEW_GLOBAL_VIREMENTS" })
      );
    });

    it("cree un audit log pour un moderateur", async () => {
      mockFindVirements.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 3, role: "MODERATEUR" } },
        query: {},
      });
      const res = mockRes();
      await virements.getVirements(req, res);
      expect(mockFindVirements).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true })
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "VIEW_GLOBAL_VIREMENTS" })
      );
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindVirements.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ query: {} });
      const res = mockRes();
      await virements.getVirements(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createVirement", () => {
    it("retourne 400 si champs manquants", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
      expect(mockFindAuthorizedSourceAccount).not.toHaveBeenCalled();
    });

    it("retourne 400 si montant <= 0", async () => {
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: -1 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le montant doit etre positif" });
      expect(mockFindAuthorizedSourceAccount).not.toHaveBeenCalled();
    });

    it("retourne 400 si source et destination identiques", async () => {
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 1, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Les comptes doivent etre differents" });
    });

    it("retourne 403 si compte source non autorise", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce(null);
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte source non autorise" });
    });

    it("retourne 404 si compte source introuvable pour un admin", async () => {
      mockFindAccountById.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { compte_source_id: 99, compte_destination_id: 2, montant: 100 },
      });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte source introuvable" });
    });

    it("retourne 400 si solde insuffisant (vérification préliminaire)", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 50 });
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
    });

    it("retourne 404 si compte destination inexistant", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountById.mockResolvedValueOnce(null);
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte destination inexistant" });
    });

    it("retourne 403 si compte destination non autorise pour un utilisateur", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountById.mockResolvedValueOnce({ id: 2 });
      mockFindAuthorizedDestinationAccount.mockResolvedValueOnce(null);
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte destination non autorise" });
    });

    it("cree le virement de facon atomique et retourne 201", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountById.mockResolvedValueOnce({ id: 2 });
      mockFindAuthorizedDestinationAccount.mockResolvedValueOnce({ id: 2 });
      mockExecuteVirementAtomique.mockResolvedValueOnce(12);

      const req = mockReq({
        body: { compte_source_id: 1, compte_destination_id: 2, montant: 100, description: "Test" },
      });
      const res = mockRes();
      await virements.createVirement(req, res);

      expect(mockExecuteVirementAtomique).toHaveBeenCalledWith(
        expect.objectContaining({ compteSourceId: 1, compteDestinationId: 2, montant: 100, description: "Test" })
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_VIREMENT" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Virement cree avec succes", id: 12 });
    });

    it("retourne 400 si executeVirementAtomique echoue avec SOLDE_INSUFFISANT (race condition)", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountById.mockResolvedValueOnce({ id: 2 });
      mockFindAuthorizedDestinationAccount.mockResolvedValueOnce({ id: 2 });
      const raceErr = new Error("Solde insuffisant");
      raceErr.code = "SOLDE_INSUFFISANT";
      mockExecuteVirementAtomique.mockRejectedValueOnce(raceErr);

      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
    });

    it("cree le virement en tant qu'admin sans filtrer le compte destination", async () => {
      mockFindAccountById
        .mockResolvedValueOnce({ id: 1, solde: 500 })
        .mockResolvedValueOnce({ id: 2 });
      mockExecuteVirementAtomique.mockResolvedValueOnce(50);

      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { compte_source_id: 1, compte_destination_id: 2, montant: 100, description: "Test admin" },
      });
      const res = mockRes();
      await virements.createVirement(req, res);

      expect(mockFindAuthorizedDestinationAccount).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("retourne 500 en cas d'erreur DB inattendue", async () => {
      mockFindAuthorizedSourceAccount.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ body: { compte_source_id: 1, compte_destination_id: 2, montant: 100 } });
      const res = mockRes();
      await virements.createVirement(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createVirementExterne", () => {
    const validBody = {
      compte_source_id: 1,
      numero_compte_dest: "6214 8820 1104",
      numero_institution_dest: "621",
      numero_transit_dest: "23815",
      swift_bic_dest: "NXBKCA2TXXX",
      montant: 200,
      description: "Remboursement",
    };

    it("retourne 400 si champs manquants", async () => {
      const req = mockReq({ body: { compte_source_id: 1 } });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
    });

    it("retourne 400 si montant <= 0", async () => {
      const req = mockReq({ body: { ...validBody, montant: -50 } });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le montant doit etre positif" });
    });

    it("retourne 403 si compte source non autorise", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce(null);
      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte source non autorise" });
    });

    it("retourne 400 si solde insuffisant", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 50 });
      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
    });

    it("retourne 404 si compte destination introuvable par coordonnees", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountByCoords.mockResolvedValueOnce(null);
      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("introuvable") })
      );
    });

    it("retourne 400 si source et destination identiques", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountByCoords.mockResolvedValueOnce({ id: 1, solde: 300 });
      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Les comptes doivent etre differents" });
    });

    it("cree le virement externe de facon atomique et retourne 201", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountByCoords.mockResolvedValueOnce({ id: 4, solde: 200 });
      mockExecuteVirementAtomique.mockResolvedValueOnce(20);

      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);

      expect(mockFindAccountByCoords).toHaveBeenCalledWith(
        expect.objectContaining({
          numeroCompte: "6214 8820 1104",
          numeroInstitution: "621",
          numeroTransit: "23815",
        })
      );
      expect(mockExecuteVirementAtomique).toHaveBeenCalledWith(
        expect.objectContaining({ compteSourceId: 1, compteDestinationId: 4, montant: 200 })
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_VIREMENT_EXTERNE" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Virement externe effectue avec succes", id: 20 });
    });

    it("retourne 400 si SOLDE_INSUFFISANT au moment atomique (race condition)", async () => {
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountByCoords.mockResolvedValueOnce({ id: 4, solde: 200 });
      const raceErr = new Error("Solde insuffisant");
      raceErr.code = "SOLDE_INSUFFISANT";
      mockExecuteVirementAtomique.mockRejectedValueOnce(raceErr);

      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 404 si compte source admin introuvable", async () => {
      mockFindAccountById.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: validBody,
      });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte source introuvable" });
    });

    it("retourne 500 en cas d'erreur DB inattendue", async () => {
      mockFindAuthorizedSourceAccount.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ body: validBody });
      const res = mockRes();
      await virements.createVirementExterne(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("passe swiftBic=null si swift_bic_dest est absent", async () => {
      const { swift_bic_dest: _s, ...bodyNoSwift } = validBody;
      mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 500 });
      mockFindAccountByCoords.mockResolvedValueOnce({ id: 4, solde: 200 });
      mockExecuteVirementAtomique.mockResolvedValueOnce(55);

      const req = mockReq({ body: bodyNoSwift });
      const res = mockRes();
      await virements.createVirementExterne(req, res);

      expect(mockFindAccountByCoords).toHaveBeenCalledWith(
        expect.objectContaining({ swiftBic: null })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
