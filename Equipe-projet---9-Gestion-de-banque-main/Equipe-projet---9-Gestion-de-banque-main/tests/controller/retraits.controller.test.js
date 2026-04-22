import { jest } from "@jest/globals";

const mockFindRetraits = jest.fn();
const mockFindRetraitById = jest.fn();
const mockFindCompteForRetrait = jest.fn();
const mockFindCompteForRetraitAdmin = jest.fn();
const mockCreateRetrait = jest.fn();
const mockRejeterRetrait = jest.fn().mockResolvedValue(undefined);
const mockFindUserAutoValidation = jest.fn().mockResolvedValue(null);
const mockExecuteApprouvementRetraitAtomique = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/retraits.data.js", () => ({
  findRetraits: mockFindRetraits,
  findRetraitById: mockFindRetraitById,
  findCompteForRetrait: mockFindCompteForRetrait,
  findCompteForRetraitAdmin: mockFindCompteForRetraitAdmin,
  createRetrait: mockCreateRetrait,
  rejeterRetrait: mockRejeterRetrait,
  findUserAutoValidation: mockFindUserAutoValidation,
  executeApprouvementRetraitAtomique: mockExecuteApprouvementRetraitAtomique,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const ctrl = await import("../../server/controllers/retraits.controller.js");

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
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockRejeterRetrait.mockResolvedValue(undefined);
  mockExecuteApprouvementRetraitAtomique.mockResolvedValue(undefined);
});

/* ── getRetraits ────────────────────────────────── */
describe("getRetraits", () => {
  it("retourne les retraits de l'utilisateur connecte (UTILISATEUR)", async () => {
    const retraits = [{ id: 1, montant: 200, statut: "EN_ATTENTE" }];
    mockFindRetraits.mockResolvedValueOnce(retraits);
    const req = mockReq({ session: { user: { id: 2, role: "UTILISATEUR" } }, query: {} });
    const res = mockRes();
    await ctrl.getRetraits(req, res);
    expect(mockFindRetraits).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, canReadAll: false })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: retraits }));
  });

  it("retourne tous les retraits pour un admin et cree un audit log", async () => {
    mockFindRetraits.mockResolvedValueOnce([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.getRetraits(req, res);
    expect(mockFindRetraits).toHaveBeenCalledWith(
      expect.objectContaining({ canReadAll: true })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VIEW_GLOBAL_RETRAITS" })
    );
  });

  it("retourne tous les retraits pour un MODERATEUR", async () => {
    mockFindRetraits.mockResolvedValueOnce([]);
    const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } }, query: {} });
    const res = mockRes();
    await ctrl.getRetraits(req, res);
    expect(mockFindRetraits).toHaveBeenCalledWith(
      expect.objectContaining({ canReadAll: true })
    );
  });

  it("inclut le terme de recherche dans la requete", async () => {
    mockFindRetraits.mockResolvedValueOnce([]);
    const req = mockReq({ query: { search: "espèces" } });
    const res = mockRes();
    await ctrl.getRetraits(req, res);
    expect(mockFindRetraits).toHaveBeenCalledWith(
      expect.objectContaining({ search: "espèces" })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("espèces") })
    );
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindRetraits.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.getRetraits(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── getRetraitById ─────────────────────────────── */
describe("getRetraitById", () => {
  it("retourne 400 si l'id est invalide", async () => {
    const req = mockReq({ params: { id: "0" } });
    const res = mockRes();
    await ctrl.getRetraitById(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Identifiant invalide" });
    expect(mockFindRetraitById).not.toHaveBeenCalled();
  });

  it("retourne le retrait si trouve", async () => {
    const retrait = { id: 1, montant: 200, statut: "EN_ATTENTE" };
    mockFindRetraitById.mockResolvedValueOnce(retrait);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.getRetraitById(req, res);
    expect(mockFindRetraitById).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({ data: retrait });
  });

  it("retourne 404 si le retrait est introuvable", async () => {
    mockFindRetraitById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();
    await ctrl.getRetraitById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Retrait introuvable" });
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindRetraitById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.getRetraitById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── createRetrait ──────────────────────────────── */
describe("createRetrait", () => {
  it("retourne 403 si le role est MODERATEUR", async () => {
    const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindCompteForRetraitAdmin).not.toHaveBeenCalled();
    expect(mockFindCompteForRetrait).not.toHaveBeenCalled();
  });

  it("retourne 400 si des champs sont manquants", async () => {
    const req = mockReq({ body: { compte_id: 1 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("compte_id") })
    );
  });

  it("retourne 400 si le montant est invalide (negatif)", async () => {
    const req = mockReq({ body: { compte_id: 1, montant: -50 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si le montant est superieur a 1000", async () => {
    const req = mockReq({ body: { compte_id: 1, montant: 1001 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("1000") })
    );
  });

  it("retourne 400 si le montant est 0", async () => {
    const req = mockReq({ body: { compte_id: 1, montant: 0 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 403 si le compte est introuvable pour un ADMIN", async () => {
    mockFindCompteForRetraitAdmin.mockResolvedValueOnce(null);
    const req = mockReq({ body: { compte_id: 99, montant: 500 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 403 si le compte est introuvable pour un UTILISATEUR", async () => {
    mockFindCompteForRetrait.mockResolvedValueOnce(null);
    const req = mockReq({
      session: { user: { id: 5, role: "UTILISATEUR" } },
      body: { compte_id: 99, montant: 200 },
    });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 400 si le solde est insuffisant", async () => {
    mockFindCompteForRetraitAdmin.mockResolvedValueOnce({
      id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1, solde: 100,
    });
    const req = mockReq({ body: { compte_id: 1, montant: 500 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
  });

  it("cree un retrait avec succes pour un ADMIN", async () => {
    mockFindCompteForRetraitAdmin.mockResolvedValueOnce({
      id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1, solde: 1000,
    });
    mockCreateRetrait.mockResolvedValueOnce(10);
    const req = mockReq({ body: { compte_id: 1, montant: 500, description: "Retrait guichet" } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(mockCreateRetrait).toHaveBeenCalledWith(
      expect.objectContaining({ montant: 500, compte_id: 1, client_id: 2 })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_RETRAIT" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it("cree un retrait avec succes pour un UTILISATEUR", async () => {
    mockFindCompteForRetrait.mockResolvedValueOnce({
      id: 2, client_id: 3, type_compte: "EPARGNE", est_actif: 1, solde: 800,
    });
    mockCreateRetrait.mockResolvedValueOnce(11);
    const req = mockReq({
      session: { user: { id: 5, role: "UTILISATEUR" } },
      body: { compte_id: 2, montant: 250 },
    });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(mockFindCompteForRetrait).toHaveBeenCalledWith(2, 5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindCompteForRetraitAdmin.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ body: { compte_id: 1, montant: 100 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── createRetrait (auto-validation) ───────────── */
describe("createRetrait (auto-validation)", () => {
  it("approuve immédiatement le retrait si auto_validation est activée", async () => {
    mockFindCompteForRetraitAdmin.mockResolvedValueOnce({
      id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1, solde: 1000,
    });
    mockCreateRetrait.mockResolvedValueOnce(30);
    mockFindUserAutoValidation.mockResolvedValueOnce(1);
    const req = mockReq({ body: { compte_id: 1, montant: 200, description: "Auto" } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(mockExecuteApprouvementRetraitAtomique).toHaveBeenCalledWith(30, 1, 1, 200, "Auto");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROUVER_RETRAIT", details: expect.stringContaining("auto_validation") })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ auto_valide: true, id: 30 }));
  });

  it("ne fait pas d'auto-validation si le flag est désactivé", async () => {
    mockFindCompteForRetraitAdmin.mockResolvedValueOnce({
      id: 1, client_id: 2, type_compte: "CHEQUES", est_actif: 1, solde: 800,
    });
    mockCreateRetrait.mockResolvedValueOnce(31);
    mockFindUserAutoValidation.mockResolvedValueOnce(0);
    const req = mockReq({ body: { compte_id: 1, montant: 150 } });
    const res = mockRes();
    await ctrl.createRetrait(req, res);
    expect(mockExecuteApprouvementRetraitAtomique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 31 }));
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ auto_valide: true }));
  });
});

/* ── approuverRetrait ───────────────────────────── */
describe("approuverRetrait", () => {
  it("retourne 403 pour un utilisateur standard", async () => {
    const req = mockReq({ session: { user: { id: 2, role: "UTILISATEUR" } }, params: { id: "1" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindRetraitById).not.toHaveBeenCalled();
  });

  it("retourne 400 si l'id est invalide", async () => {
    const req = mockReq({ params: { id: "0" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si le retrait n'existe pas", async () => {
    mockFindRetraitById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Retrait introuvable" });
  });

  it("retourne 400 si le retrait n'est pas EN_ATTENTE (APPROUVE)", async () => {
    mockFindRetraitById.mockResolvedValueOnce({
      id: 1, statut: "APPROUVE", compte_id: 1, montant: 200,
    });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("APPROUVE") })
    );
  });

  it("retourne 400 si le retrait a deja ete rejete", async () => {
    mockFindRetraitById.mockResolvedValueOnce({
      id: 2, statut: "REJETE", compte_id: 1, montant: 100,
    });
    const req = mockReq({ params: { id: "2" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("approuve un retrait de façon atomique", async () => {
    const retrait = {
      id: 1, statut: "EN_ATTENTE", compte_id: 2, montant: 300, description: "Retrait",
    };
    mockFindRetraitById.mockResolvedValueOnce(retrait);
    const req = mockReq({ params: { id: "1" }, session: { user: { id: 1, role: "MODERATEUR" } } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(mockExecuteApprouvementRetraitAtomique).toHaveBeenCalledWith(1, 1, 2, 300, "Retrait");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROUVER_RETRAIT" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("permet a un ADMIN d'approuver un retrait", async () => {
    const retrait = { id: 5, statut: "EN_ATTENTE", compte_id: 3, montant: 100, description: null };
    mockFindRetraitById.mockResolvedValueOnce(retrait);
    const req = mockReq({ params: { id: "5" }, session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(mockExecuteApprouvementRetraitAtomique).toHaveBeenCalledWith(5, 1, 3, 100, null);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it("retourne 400 si le solde est insuffisant au moment de l'approbation", async () => {
    const retrait = { id: 3, statut: "EN_ATTENTE", compte_id: 4, montant: 500, description: null };
    mockFindRetraitById.mockResolvedValueOnce(retrait);
    const err = new Error("Solde insuffisant");
    err.code = "SOLDE_INSUFFISANT";
    mockExecuteApprouvementRetraitAtomique.mockRejectedValueOnce(err);
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Solde insuffisant") })
    );
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindRetraitById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();
    await ctrl.approuverRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── rejeterRetrait ─────────────────────────────── */
describe("rejeterRetrait", () => {
  it("retourne 403 pour un utilisateur standard", async () => {
    const req = mockReq({ session: { user: { id: 2, role: "UTILISATEUR" } }, params: { id: "1" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFindRetraitById).not.toHaveBeenCalled();
  });

  it("retourne 400 si l'id est invalide", async () => {
    const req = mockReq({ params: { id: "0" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si le retrait n'existe pas", async () => {
    mockFindRetraitById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Retrait introuvable" });
  });

  it("retourne 400 si le retrait est deja traite (APPROUVE)", async () => {
    mockFindRetraitById.mockResolvedValueOnce({ id: 2, statut: "APPROUVE", compte_id: 1, montant: 200 });
    const req = mockReq({ params: { id: "2" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si le retrait est deja rejete", async () => {
    mockFindRetraitById.mockResolvedValueOnce({ id: 3, statut: "REJETE", compte_id: 1, montant: 100 });
    const req = mockReq({ params: { id: "3" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejette un retrait avec une note et cree un audit log", async () => {
    mockFindRetraitById.mockResolvedValueOnce({ id: 3, statut: "EN_ATTENTE", compte_id: 1, montant: 300 });
    const req = mockReq({ params: { id: "3" }, body: { notes: "Motif de rejet" } });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(mockRejeterRetrait).toHaveBeenCalledWith(3, 1, "Motif de rejet");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REJETER_RETRAIT" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it("rejette un retrait sans note", async () => {
    mockFindRetraitById.mockResolvedValueOnce({ id: 4, statut: "EN_ATTENTE", compte_id: 1, montant: 50 });
    const req = mockReq({
      params: { id: "4" },
      body: {},
      session: { user: { id: 1, role: "MODERATEUR" } },
    });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(mockRejeterRetrait).toHaveBeenCalledWith(4, 1, undefined);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });

  it("retourne 500 en cas d'erreur du repository", async () => {
    mockFindRetraitById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" }, body: {} });
    const res = mockRes();
    await ctrl.rejeterRetrait(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
