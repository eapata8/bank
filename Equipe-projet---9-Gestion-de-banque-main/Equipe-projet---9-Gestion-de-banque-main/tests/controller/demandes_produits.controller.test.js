import { jest } from "@jest/globals";

/* ── Mocks ────────────────────────────────────────── */
const mockFindAllDemandes  = jest.fn();
const mockFindDemandeById  = jest.fn();
const mockHasPendingDemande = jest.fn();
const mockCreateDemande    = jest.fn();
const mockApprouverDemande = jest.fn().mockResolvedValue(undefined);
const mockRefuserDemande   = jest.fn().mockResolvedValue(undefined);
const mockAnnulerDemande   = jest.fn();
const mockIsDemandeOwner   = jest.fn();
const mockFindUserAutoValidation = jest.fn().mockResolvedValue(0);
const mockCreateAuditLog   = jest.fn().mockResolvedValue(undefined);

// Mock de la DB (utilisée pour récupérer le client_id dans createDemande)
const mockDbQuery = jest.fn();
await jest.unstable_mockModule("../../server/db.js", () => ({ default: { query: mockDbQuery } }));

await jest.unstable_mockModule("../../server/data/demandes_produits.data.js", () => ({
  findAllDemandes:   mockFindAllDemandes,
  findDemandeById:   mockFindDemandeById,
  hasPendingDemande: mockHasPendingDemande,
  createDemande:     mockCreateDemande,
  approuverDemande:  mockApprouverDemande,
  refuserDemande:    mockRefuserDemande,
  annulerDemande:    mockAnnulerDemande,
  isDemandeOwner:    mockIsDemandeOwner,
  findUserAutoValidation: mockFindUserAutoValidation,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const ctrl = await import("../../server/controllers/demandes_produits.controller.js");

/* ── Helpers ──────────────────────────────────────── */
const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

const mockReq = (overrides = {}) => ({
  session: { user: { id: 1, role: "ADMIN" } },
  params:  {},
  query:   {},
  body:    {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockApprouverDemande.mockResolvedValue(undefined);
  mockRefuserDemande.mockResolvedValue(undefined);
  mockFindUserAutoValidation.mockResolvedValue(0);
});

/* ── getDemandes ──────────────────────────────────── */
describe("getDemandes", () => {
  it("retourne toutes les demandes pour un ADMIN", async () => {
    const demandes = [{ id: 1, type_produit: "CARTE_VISA", statut: "EN_ATTENTE" }];
    mockFindAllDemandes.mockResolvedValueOnce(demandes);
    const req = mockReq();
    const res = mockRes();

    await ctrl.getDemandes(req, res);

    expect(mockFindAllDemandes).toHaveBeenCalledWith({ userId: 1, canReadAll: true });
    expect(res.json).toHaveBeenCalledWith({ data: demandes });
  });

  it("canReadAll=true pour un MODERATEUR", async () => {
    mockFindAllDemandes.mockResolvedValueOnce([]);
    const req = mockReq({ session: { user: { id: 2, role: "MODERATEUR" } } });
    const res = mockRes();

    await ctrl.getDemandes(req, res);

    expect(mockFindAllDemandes).toHaveBeenCalledWith({ userId: 2, canReadAll: true });
  });

  it("canReadAll=false pour un UTILISATEUR", async () => {
    mockFindAllDemandes.mockResolvedValueOnce([]);
    const req = mockReq({ session: { user: { id: 3, role: "UTILISATEUR" } } });
    const res = mockRes();

    await ctrl.getDemandes(req, res);

    expect(mockFindAllDemandes).toHaveBeenCalledWith({ userId: 3, canReadAll: false });
  });

  it("retourne 500 si erreur serveur", async () => {
    mockFindAllDemandes.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq();
    const res = mockRes();

    await ctrl.getDemandes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

/* ── getDemandeById ───────────────────────────────── */
describe("getDemandeById", () => {
  it("retourne la demande si trouvee", async () => {
    const demande = { id: 5, type_produit: "COMPTE_CHEQUES", statut: "EN_ATTENTE" };
    mockFindDemandeById.mockResolvedValueOnce(demande);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.getDemandeById(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: demande });
  });

  it("retourne 404 si demande introuvable", async () => {
    mockFindDemandeById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();

    await ctrl.getDemandeById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("retourne 400 si id invalide", async () => {
    const req = mockReq({ params: { id: "abc" } });
    const res = mockRes();

    await ctrl.getDemandeById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockFindDemandeById.mockRejectedValueOnce(new Error("DB"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.getDemandeById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── createDemande ────────────────────────────────── */
describe("createDemande", () => {
  it("cree une demande avec succes (201)", async () => {
    mockDbQuery.mockResolvedValueOnce([[{ client_id: 3 }]]);
    mockHasPendingDemande.mockResolvedValueOnce(false);
    mockCreateDemande.mockResolvedValueOnce(42);
    const req = mockReq({
      session: { user: { id: 10, role: "UTILISATEUR" } },
      body: { type_produit: "CARTE_VISA" },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(mockCreateDemande).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 3,
      type_produit: "CARTE_VISA",
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_DEMANDE_PRODUIT" })
    );
  });

  it("retourne 409 si demande EN_ATTENTE existe deja", async () => {
    mockDbQuery.mockResolvedValueOnce([[{ client_id: 3 }]]);
    mockHasPendingDemande.mockResolvedValueOnce(true);
    const req = mockReq({
      session: { user: { id: 10, role: "UTILISATEUR" } },
      body: { type_produit: "CARTE_VISA" },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockCreateDemande).not.toHaveBeenCalled();
  });

  it("retourne 403 si aucun client associe", async () => {
    mockDbQuery.mockResolvedValueOnce([[]]);
    const req = mockReq({
      session: { user: { id: 99, role: "ADMIN" } },
      body: { type_produit: "COMPTE_EPARGNE" },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("accepte limite_credit optionnel", async () => {
    mockDbQuery.mockResolvedValueOnce([[{ client_id: 4 }]]);
    mockHasPendingDemande.mockResolvedValueOnce(false);
    mockCreateDemande.mockResolvedValueOnce(10);
    const req = mockReq({
      session: { user: { id: 7, role: "UTILISATEUR" } },
      body: { type_produit: "CARTE_MASTERCARD", limite_credit: "8000", notes: "Merci" },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(mockCreateDemande).toHaveBeenCalledWith(expect.objectContaining({
      limite_credit: 8000,
      notes: "Merci",
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockDbQuery.mockRejectedValueOnce(new Error("DB"));
    const req = mockReq({
      session: { user: { id: 1, role: "UTILISATEUR" } },
      body: { type_produit: "CARTE_VISA" },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("auto-approuve la demande si auto_validation est activée", async () => {
    mockDbQuery.mockResolvedValueOnce([[{ client_id: 7 }]]);
    mockHasPendingDemande.mockResolvedValueOnce(false);
    mockCreateDemande.mockResolvedValueOnce(99);
    mockFindUserAutoValidation.mockResolvedValueOnce(1);
    const req = mockReq({
      session: { user: { id: 15, role: "UTILISATEUR" } },
      body: { type_produit: "CARTE_VISA", limite_credit: 3000 },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(mockApprouverDemande).toHaveBeenCalledWith(99, 15, expect.objectContaining({
      client_id: 7, type_produit: "CARTE_VISA", limite_credit: 3000,
    }));
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_DEMANDE_PRODUIT" })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROUVER_DEMANDE_PRODUIT" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 99,
      auto_valide: true,
    }));
  });

  it("ne déclenche PAS l'auto-approbation si auto_validation est désactivée", async () => {
    mockDbQuery.mockResolvedValueOnce([[{ client_id: 7 }]]);
    mockHasPendingDemande.mockResolvedValueOnce(false);
    mockCreateDemande.mockResolvedValueOnce(55);
    mockFindUserAutoValidation.mockResolvedValueOnce(0);
    const req = mockReq({
      session: { user: { id: 15, role: "UTILISATEUR" } },
      body: { type_produit: "COMPTE_EPARGNE" },
    });
    const res = mockRes();

    await ctrl.createDemande(req, res);

    expect(mockApprouverDemande).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 55,
      message: "Demande soumise avec succès",
    }));
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ auto_valide: true }));
  });
});

/* ── approuverDemande ─────────────────────────────── */
describe("approuverDemande", () => {
  it("approuve une demande EN_ATTENTE et retourne 200", async () => {
    const demande = { id: 1, client_id: 5, type_produit: "CARTE_VISA", statut: "EN_ATTENTE" };
    mockFindDemandeById.mockResolvedValueOnce(demande);
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.approuverDemande(req, res);

    expect(mockApprouverDemande).toHaveBeenCalledWith(1, 1, demande);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROUVER_DEMANDE_PRODUIT" })
    );
  });

  it("retourne 404 si demande introuvable", async () => {
    mockFindDemandeById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();

    await ctrl.approuverDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockApprouverDemande).not.toHaveBeenCalled();
  });

  it("retourne 400 si statut n'est pas EN_ATTENTE", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 1, statut: "APPROUVEE", type_produit: "CARTE_VISA" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.approuverDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockApprouverDemande).not.toHaveBeenCalled();
  });

  it("retourne 400 si id invalide", async () => {
    const req = mockReq({ params: { id: "0" } });
    const res = mockRes();

    await ctrl.approuverDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 1, statut: "EN_ATTENTE", type_produit: "CARTE_VISA" });
    mockApprouverDemande.mockRejectedValueOnce(new Error("DB"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.approuverDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── refuserDemande ───────────────────────────────── */
describe("refuserDemande", () => {
  it("refuse une demande EN_ATTENTE et retourne 200", async () => {
    const demande = { id: 2, statut: "EN_ATTENTE", type_produit: "COMPTE_CHEQUES" };
    mockFindDemandeById.mockResolvedValueOnce(demande);
    const req = mockReq({ params: { id: "2" }, body: { notes: "Dossier incomplet" } });
    const res = mockRes();

    await ctrl.refuserDemande(req, res);

    expect(mockRefuserDemande).toHaveBeenCalledWith(2, 1, "Dossier incomplet");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REFUSER_DEMANDE_PRODUIT" })
    );
  });

  it("refuse sans notes (notes undefined)", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 3, statut: "EN_ATTENTE", type_produit: "CARTE_VISA" });
    const req = mockReq({ params: { id: "3" }, body: {} });
    const res = mockRes();

    await ctrl.refuserDemande(req, res);

    expect(mockRefuserDemande).toHaveBeenCalledWith(3, 1, null);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it("retourne 404 si demande introuvable", async () => {
    mockFindDemandeById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();

    await ctrl.refuserDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockRefuserDemande).not.toHaveBeenCalled();
  });

  it("retourne 400 si statut n'est pas EN_ATTENTE", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 2, statut: "REFUSEE", type_produit: "CARTE_VISA" });
    const req = mockReq({ params: { id: "2" } });
    const res = mockRes();

    await ctrl.refuserDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockRefuserDemande).not.toHaveBeenCalled();
  });

  it("retourne 400 si id invalide", async () => {
    const req = mockReq({ params: { id: "xyz" } });
    const res = mockRes();

    await ctrl.refuserDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 1, statut: "EN_ATTENTE", type_produit: "CARTE_VISA" });
    mockRefuserDemande.mockRejectedValueOnce(new Error("DB"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.refuserDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ── annulerDemande ───────────────────────────────── */
describe("annulerDemande", () => {
  it("ADMIN annule une demande EN_ATTENTE sans verifier la propriete", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 5, statut: "EN_ATTENTE", type_produit: "CARTE_VISA", client_id: 3 });
    mockAnnulerDemande.mockResolvedValueOnce(1);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(mockIsDemandeOwner).not.toHaveBeenCalled();
    expect(mockAnnulerDemande).toHaveBeenCalledWith(5);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ANNULER_DEMANDE_PRODUIT" })
    );
  });

  it("MODERATEUR peut annuler sans etre proprietaire", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 6, statut: "EN_ATTENTE", type_produit: "COMPTE_CHEQUES", client_id: 4 });
    mockAnnulerDemande.mockResolvedValueOnce(1);
    const req = mockReq({
      session: { user: { id: 2, role: "MODERATEUR" } },
      params: { id: "6" },
    });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(mockIsDemandeOwner).not.toHaveBeenCalled();
    expect(mockAnnulerDemande).toHaveBeenCalledWith(6);
  });

  it("UTILISATEUR proprietaire peut annuler sa demande", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 7, statut: "EN_ATTENTE", type_produit: "CARTE_VISA", client_id: 3 });
    mockIsDemandeOwner.mockResolvedValueOnce(true);
    mockAnnulerDemande.mockResolvedValueOnce(1);
    const req = mockReq({
      session: { user: { id: 10, role: "UTILISATEUR" } },
      params: { id: "7" },
    });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(mockIsDemandeOwner).toHaveBeenCalledWith(7, 10);
    expect(mockAnnulerDemande).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it("retourne 403 si UTILISATEUR n'est pas proprietaire", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 8, statut: "EN_ATTENTE", type_produit: "CARTE_VISA", client_id: 99 });
    mockIsDemandeOwner.mockResolvedValueOnce(false);
    const req = mockReq({
      session: { user: { id: 10, role: "UTILISATEUR" } },
      params: { id: "8" },
    });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockAnnulerDemande).not.toHaveBeenCalled();
  });

  it("retourne 404 si demande introuvable", async () => {
    mockFindDemandeById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockAnnulerDemande).not.toHaveBeenCalled();
  });

  it("retourne 400 si statut n'est pas EN_ATTENTE", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 9, statut: "APPROUVEE", type_produit: "CARTE_VISA", client_id: 3 });
    const req = mockReq({ params: { id: "9" } });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockAnnulerDemande).not.toHaveBeenCalled();
  });

  it("retourne 400 si id invalide", async () => {
    const req = mockReq({ params: { id: "abc" } });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si la suppression a echoue (race condition)", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 10, statut: "EN_ATTENTE", type_produit: "CARTE_VISA", client_id: 3 });
    mockAnnulerDemande.mockResolvedValueOnce(0);
    const req = mockReq({ params: { id: "10" } });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockFindDemandeById.mockResolvedValueOnce({ id: 11, statut: "EN_ATTENTE", type_produit: "CARTE_VISA", client_id: 3 });
    mockAnnulerDemande.mockRejectedValueOnce(new Error("DB"));
    const req = mockReq({ params: { id: "11" } });
    const res = mockRes();

    await ctrl.annulerDemande(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
