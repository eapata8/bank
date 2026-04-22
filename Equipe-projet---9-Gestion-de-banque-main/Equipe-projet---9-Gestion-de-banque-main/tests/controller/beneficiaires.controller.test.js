import { jest } from "@jest/globals";

// ─── Mocks des dépendances ────────────────────────────────────────────────────

const mockFindBeneficiaires          = jest.fn();
const mockFindBeneficiaireById       = jest.fn();
const mockCreateBeneficiaire         = jest.fn();
const mockDeleteBeneficiaire         = jest.fn().mockResolvedValue(undefined);
const mockEmailExistsDansLeSysteme   = jest.fn().mockResolvedValue(true);
const mockCreateAuditLog             = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/beneficiaires.data.js", () => ({
  findBeneficiaires:          mockFindBeneficiaires,
  findBeneficiaireById:       mockFindBeneficiaireById,
  createBeneficiaire:         mockCreateBeneficiaire,
  deleteBeneficiaire:         mockDeleteBeneficiaire,
  emailExistsDansLeSysteme:   mockEmailExistsDansLeSysteme,
}));

await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const ctrl = await import("../../server/controllers/beneficiaires.controller.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json   = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  return {
    session: { user: { id: 1, role: "UTILISATEUR" } },
    body: {},
    params: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteBeneficiaire.mockResolvedValue(undefined);
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockEmailExistsDansLeSysteme.mockResolvedValue(true); // par défaut : email connu
});

// ─────────────────────────────────────────────────────────────────────────────
// getBeneficiaires
// ─────────────────────────────────────────────────────────────────────────────

describe("getBeneficiaires", () => {
  it("retourne 200 avec la liste des bénéficiaires", async () => {
    const rows = [{ id: 1, alias: "Maman", email_interac: "maman@exemple.com" }];
    mockFindBeneficiaires.mockResolvedValueOnce(rows);

    const req = mockReq();
    const res = mockRes();

    await ctrl.getBeneficiaires(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: rows });
  });

  it("retourne 200 avec un tableau vide si aucun bénéficiaire", async () => {
    mockFindBeneficiaires.mockResolvedValueOnce([]);

    const req = mockReq();
    const res = mockRes();

    await ctrl.getBeneficiaires(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: [] });
  });

  it("retourne 500 si la base de données lève une erreur", async () => {
    mockFindBeneficiaires.mockRejectedValueOnce(new Error("DB error"));

    const req = mockReq();
    const res = mockRes();

    await ctrl.getBeneficiaires(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Erreur serveur" })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createBeneficiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("createBeneficiaire", () => {
  it("retourne 400 si alias manquant", async () => {
    const req = mockReq({ body: { alias: "", email_interac: "test@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("alias") })
    );
  });

  it("retourne 400 si alias uniquement des espaces", async () => {
    const req = mockReq({ body: { alias: "   ", email_interac: "test@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si alias dépasse 100 caractères", async () => {
    const req = mockReq({ body: { alias: "A".repeat(101), email_interac: "test@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("100") })
    );
  });

  it("retourne 400 si email_interac manquant", async () => {
    const req = mockReq({ body: { alias: "Maman", email_interac: "" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("courriel") })
    );
  });

  it("retourne 400 si email_interac invalide (sans @)", async () => {
    const req = mockReq({ body: { alias: "Maman", email_interac: "pasuncourriel" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("invalide") })
    );
  });

  it("retourne 400 si email_interac invalide (sans domaine)", async () => {
    const req = mockReq({ body: { alias: "Maman", email_interac: "test@" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si le courriel n'est pas enregistré dans le système", async () => {
    mockEmailExistsDansLeSysteme.mockResolvedValueOnce(false);

    const req = mockReq({ body: { alias: "Inconnu", email_interac: "inconnu@test.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Aucun utilisateur") })
    );
    expect(mockCreateBeneficiaire).not.toHaveBeenCalled();
  });

  it("retourne 409 si le courriel est déjà dans les bénéficiaires (MySQL 1062)", async () => {
    const dupErr = new Error("Duplicate entry");
    dupErr.errno = 1062;
    mockCreateBeneficiaire.mockRejectedValueOnce(dupErr);

    const req = mockReq({ body: { alias: "Maman", email_interac: "maman@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("déjà") })
    );
  });

  it("relance l'erreur DB si ce n'est pas une erreur 1062", async () => {
    const dbErr = new Error("Connection lost");
    dbErr.errno = 2006;
    mockCreateBeneficiaire.mockRejectedValueOnce(dbErr);

    const req = mockReq({ body: { alias: "Maman", email_interac: "maman@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 201 avec message et id en cas de succès", async () => {
    mockCreateBeneficiaire.mockResolvedValueOnce({ insertId: 12 });

    const req = mockReq({ body: { alias: "Maman", email_interac: "maman@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String), id: 12 })
    );
  });

  it("crée un log d'audit BENEFICIAIRE_AJOUTE en cas de succès", async () => {
    mockCreateBeneficiaire.mockResolvedValueOnce({ insertId: 15 });

    const req = mockReq({ body: { alias: "Papa", email_interac: "papa@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BENEFICIAIRE_AJOUTE" })
    );
  });

  it("retourne 500 si createAuditLog lève une erreur", async () => {
    mockCreateBeneficiaire.mockResolvedValueOnce({ insertId: 20 });
    mockCreateAuditLog.mockRejectedValueOnce(new Error("Audit DB error"));

    const req = mockReq({ body: { alias: "Maman", email_interac: "maman@exemple.com" } });
    const res = mockRes();

    await ctrl.createBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteBeneficiaire
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteBeneficiaire", () => {
  it("retourne 404 si le bénéficiaire est introuvable", async () => {
    mockFindBeneficiaireById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();

    await ctrl.deleteBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("introuvable") })
    );
  });

  it("retourne 403 si le bénéficiaire n'appartient pas à l'utilisateur connecté", async () => {
    mockFindBeneficiaireById.mockResolvedValueOnce({ id: 5, utilisateur_id: 99, alias: "X", email_interac: "x@x.com" });

    const req = mockReq({ params: { id: "5" } }); // user id = 1, bénéficiaire appartient à 99
    const res = mockRes();

    await ctrl.deleteBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("autorisé") })
    );
  });

  it("retourne 200 et crée un audit log en cas de succès", async () => {
    mockFindBeneficiaireById.mockResolvedValueOnce({ id: 5, utilisateur_id: 1, alias: "Maman", email_interac: "maman@exemple.com" });

    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.deleteBeneficiaire(req, res);

    expect(mockDeleteBeneficiaire).toHaveBeenCalledWith(5);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BENEFICIAIRE_SUPPRIME" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("supprimé") })
    );
  });

  it("retourne 500 si la base de données lève une erreur lors de la recherche", async () => {
    mockFindBeneficiaireById.mockRejectedValueOnce(new Error("DB error"));

    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.deleteBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Erreur serveur" })
    );
  });

  it("retourne 500 si deleteBeneficiaire lève une erreur", async () => {
    mockFindBeneficiaireById.mockResolvedValueOnce({ id: 5, utilisateur_id: 1, alias: "Maman", email_interac: "maman@exemple.com" });
    mockDeleteBeneficiaire.mockRejectedValueOnce(new Error("Delete failed"));

    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.deleteBeneficiaire(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
