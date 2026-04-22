import { jest } from "@jest/globals";

const mockFindDepots = jest.fn();
const mockFindDepotById = jest.fn();
const mockFindCompteForDepot = jest.fn();
const mockFindCompteForDepotAdmin = jest.fn();
const mockCreateDepot = jest.fn();
const mockRejeterDepot = jest.fn().mockResolvedValue(undefined);
const mockFindUserAutoValidation = jest.fn().mockResolvedValue(null);
const mockExecuteApprouvementDepotAtomique = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/depots.data.js", () => ({
  findDepots: mockFindDepots,
  findDepotById: mockFindDepotById,
  findCompteForDepot: mockFindCompteForDepot,
  findCompteForDepotAdmin: mockFindCompteForDepotAdmin,
  createDepot: mockCreateDepot,
  rejeterDepot: mockRejeterDepot,
  findUserAutoValidation: mockFindUserAutoValidation,
  executeApprouvementDepotAtomique: mockExecuteApprouvementDepotAtomique,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const ctrl = await import("../../server/controllers/depots.controller.js");

const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

const mockReq = (overrides = {}) => ({
  session: { user: { id: 1, role: "ADMIN" } },
  params: {},
  query: {},
  body: {},
  file: { filename: "cheque-123456.png" },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockRejeterDepot.mockResolvedValue(undefined);
  mockExecuteApprouvementDepotAtomique.mockResolvedValue(undefined);
});

describe("getDepotById", () => {
  it("retourne 400 si l'id est invalide", async () => {
    const req = mockReq({ params: { id: "0" } });
    const res = mockRes();
    await ctrl.getDepotById(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Identifiant invalide" });
    expect(mockFindDepotById).not.toHaveBeenCalled();
  });

  it("retourne le depot si trouve", async () => {
    const depot = { id: 1, numero_cheque: "CHQ-001", statut: "EN_ATTENTE" };
    mockFindDepotById.mockResolvedValueOnce(depot);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.getDepotById(req, res);
    expect(mockFindDepotById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ data: depot });
  });

  it("retourne 404 si le depot est introuvable", async () => {
    mockFindDepotById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();
    await ctrl.getDepotById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Dépôt introuvable" });
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindDepotById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.getDepotById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("getDepots", () => {
  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindDepots.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ session: { user: { id: 1, role: "UTILISATEUR" } }, query: {} });
    const res = mockRes();
    await ctrl.getDepots(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne les depots de l'utilisateur connecte", async () => {
    const depots = [{ id: 1, numero_cheque: "CHQ-001", statut: "EN_ATTENTE" }];
    mockFindDepots.mockResolvedValueOnce(depots);
    const req = mockReq({ session: { user: { id: 2, role: "UTILISATEUR" } }, query: {} });
    const res = mockRes();
    await ctrl.getDepots(req, res);
    expect(mockFindDepots).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, canReadAll: false })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: depots }));
  });

  it("cree un audit log pour un admin", async () => {
    mockFindDepots.mockResolvedValueOnce([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.getDepots(req, res);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VIEW_GLOBAL_DEPOTS" })
    );
  });

  it("cree un audit log pour un moderateur", async () => {
    mockFindDepots.mockResolvedValueOnce([]);
    const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } }, query: {} });
    const res = mockRes();
    await ctrl.getDepots(req, res);
    expect(mockFindDepots).toHaveBeenCalledWith(
      expect.objectContaining({ canReadAll: true })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VIEW_GLOBAL_DEPOTS" })
    );
  });

  it("passe le terme de recherche dans les détails d'audit pour un admin", async () => {
    mockFindDepots.mockResolvedValueOnce([]);
    const req = mockReq({ query: { search: "CHQ-001" } });
    const res = mockRes();
    await ctrl.getDepots(req, res);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VIEW_GLOBAL_DEPOTS",
        details: "Recherche: CHQ-001",
      })
    );
  });
});

describe("createDepot", () => {
  it("retourne 403 si le role est MODERATEUR", async () => {
    const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } } });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindCompteForDepotAdmin).not.toHaveBeenCalled();
  });

  it("retourne 400 si des champs sont manquants", async () => {
    const req = mockReq({ body: { compte_id: 1, montant: 200 } });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si le montant est invalide", async () => {
    const req = mockReq({
      body: { compte_id: 1, montant: -50, numero_cheque: "CHQ-001", banque_emettrice: "TD" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si la photo du cheque est absente", async () => {
    const req = mockReq({
      body: { compte_id: 1, montant: 500, numero_cheque: "CHQ-001", banque_emettrice: "TD" },
      file: undefined,
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("photo") }));
  });

  it("retourne 403 si le compte est introuvable ou non autorise", async () => {
    mockFindCompteForDepotAdmin.mockResolvedValueOnce(null);
    const req = mockReq({
      body: { compte_id: 99, montant: 500, numero_cheque: "CHQ-001", banque_emettrice: "TD" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindCompteForDepotAdmin.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({
      body: { compte_id: 1, montant: 500, numero_cheque: "CHQ-001", banque_emettrice: "TD" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("cree un depot avec photo pour un admin", async () => {
    mockFindCompteForDepotAdmin.mockResolvedValueOnce({ id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1 });
    mockCreateDepot.mockResolvedValueOnce(10);
    const req = mockReq({
      body: { compte_id: 1, montant: 500, numero_cheque: "CHQ-001", banque_emettrice: "TD Canada Trust" },
      file: { filename: "cheque-1234567890.png" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(mockCreateDepot).toHaveBeenCalledWith(
      expect.objectContaining({ fichier_chemin: "cheque-1234567890.png", montant: 500 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it("cree un depot pour un utilisateur", async () => {
    mockFindCompteForDepot.mockResolvedValueOnce({ id: 2, client_id: 3, type_compte: "EPARGNE", est_actif: 1 });
    mockCreateDepot.mockResolvedValueOnce(11);
    const req = mockReq({
      session: { user: { id: 5, role: "UTILISATEUR" } },
      body: { compte_id: 2, montant: 250, numero_cheque: "CHQ-002", banque_emettrice: "RBC" },
      file: { filename: "cheque-9876543210.jpg" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(mockFindCompteForDepot).toHaveBeenCalledWith(2, 5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));
  });
});

describe("createDepot (auto-validation)", () => {
  it("approuve immédiatement le dépôt si auto_validation est activée", async () => {
    mockFindCompteForDepotAdmin.mockResolvedValueOnce({ id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1 });
    mockCreateDepot.mockResolvedValueOnce(20);
    mockFindUserAutoValidation.mockResolvedValueOnce(1);
    const req = mockReq({
      body: { compte_id: 1, montant: 300, numero_cheque: "CHQ-AUTO", banque_emettrice: "TD" },
      file: { filename: "cheque-auto.png" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(mockExecuteApprouvementDepotAtomique).toHaveBeenCalledWith(20, 1, 1, 300, "CHQ-AUTO");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROUVER_DEPOT", details: expect.stringContaining("auto_validation") })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ auto_valide: true, id: 20 }));
  });

  it("ne fait pas d'auto-validation si le flag est désactivé", async () => {
    mockFindCompteForDepotAdmin.mockResolvedValueOnce({ id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1 });
    mockCreateDepot.mockResolvedValueOnce(21);
    mockFindUserAutoValidation.mockResolvedValueOnce(0);
    const req = mockReq({
      body: { compte_id: 1, montant: 100, numero_cheque: "CHQ-WAIT", banque_emettrice: "RBC" },
      file: { filename: "cheque-wait.png" },
    });
    const res = mockRes();
    await ctrl.createDepot(req, res);
    expect(mockExecuteApprouvementDepotAtomique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 21 }));
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ auto_valide: true }));
  });
});

describe("approuverDepot", () => {
  it("retourne 403 pour un utilisateur standard", async () => {
    const req = mockReq({ session: { user: { id: 2, role: "UTILISATEUR" } }, params: { id: "1" } });
    const res = mockRes();
    await ctrl.approuverDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindDepotById).not.toHaveBeenCalled();
  });

  it("retourne 400 si l'id est invalide", async () => {
    const req = mockReq({ params: { id: "0" } });
    const res = mockRes();
    await ctrl.approuverDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si le depot n'existe pas", async () => {
    mockFindDepotById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();
    await ctrl.approuverDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Dépôt introuvable" });
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindDepotById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.approuverDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 400 si le depot n'est pas EN_ATTENTE", async () => {
    mockFindDepotById.mockResolvedValueOnce({ id: 1, statut: "APPROUVE", compte_id: 1, montant: 500 });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.approuverDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("approuve un depot de façon atomique", async () => {
    const depot = { id: 1, statut: "EN_ATTENTE", compte_id: 2, montant: 500, numero_cheque: "CHQ-001", client_id: 1 };
    mockFindDepotById.mockResolvedValueOnce(depot);
    const req = mockReq({ params: { id: "1" }, session: { user: { id: 1, role: "MODERATEUR" } } });
    const res = mockRes();
    await ctrl.approuverDepot(req, res);
    expect(mockExecuteApprouvementDepotAtomique).toHaveBeenCalledWith(1, 1, 2, 500, "CHQ-001");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "APPROUVER_DEPOT" }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe("rejeterDepot", () => {
  it("retourne 403 pour un utilisateur standard", async () => {
    const req = mockReq({ session: { user: { id: 2, role: "UTILISATEUR" } }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindDepotById).not.toHaveBeenCalled();
  });

  it("retourne 400 si l'id est invalide", async () => {
    const req = mockReq({ params: { id: "0" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si le depot n'existe pas", async () => {
    mockFindDepotById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Dépôt introuvable" });
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindDepotById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 400 si le depot est deja traite", async () => {
    mockFindDepotById.mockResolvedValueOnce({ id: 2, statut: "REJETE", compte_id: 1, montant: 200 });
    const req = mockReq({ params: { id: "2" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejette un depot avec une note et cree un audit log", async () => {
    mockFindDepotById.mockResolvedValueOnce({ id: 3, statut: "EN_ATTENTE", compte_id: 1, montant: 300, numero_cheque: "CHQ-003" });
    const req = mockReq({ params: { id: "3" }, body: { notes: "Chèque illisible" } });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(mockRejeterDepot).toHaveBeenCalledWith(3, 1, "Chèque illisible");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "REJETER_DEPOT" }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it("rejette un depot sans note (branche notes falsy)", async () => {
    mockFindDepotById.mockResolvedValueOnce({ id: 4, statut: "EN_ATTENTE", compte_id: 2, montant: 150, numero_cheque: "CHQ-004" });
    const req = mockReq({ params: { id: "4" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterDepot(req, res);
    expect(mockRejeterDepot).toHaveBeenCalledWith(4, 1, undefined);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REJETER_DEPOT" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });
});
