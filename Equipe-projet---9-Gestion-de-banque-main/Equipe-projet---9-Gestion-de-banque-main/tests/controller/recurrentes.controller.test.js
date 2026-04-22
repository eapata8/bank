import { jest } from "@jest/globals";

// ─── Mocks des dépendances ────────────────────────────────────────────────────

const mockFindRecurrentes = jest.fn();
const mockFindRecurrenteById = jest.fn();
const mockCreateRecurrente = jest.fn();
const mockUpdateStatutRecurrente = jest.fn().mockResolvedValue(undefined);
const mockResetNbEchecsRecurrente = jest.fn().mockResolvedValue(undefined);
const mockFindAuthorizedSourceAccount = jest.fn();
const mockFindAccountById = jest.fn();
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
const mockFindCompteByNumero = jest.fn();
const mockExecuterTransactionsRecurrentes = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/recurrentes.data.js", () => ({
  findRecurrentes: mockFindRecurrentes,
  findRecurrenteById: mockFindRecurrenteById,
  createRecurrente: mockCreateRecurrente,
  updateStatutRecurrente: mockUpdateStatutRecurrente,
  resetNbEchecsRecurrente: mockResetNbEchecsRecurrente,
  findRecurrentesEchues: jest.fn(),
  updateApresExecution: jest.fn(),
  findCompteByNumero: mockFindCompteByNumero,
}));

await jest.unstable_mockModule("../../server/scheduler.js", () => ({
  executerTransactionsRecurrentes: mockExecuterTransactionsRecurrentes,
}));

await jest.unstable_mockModule("../../server/data/virements.data.js", () => ({
  findAuthorizedSourceAccount: mockFindAuthorizedSourceAccount,
  findAccountById: mockFindAccountById,
  findVirements: jest.fn(),
  findAuthorizedDestinationAccount: jest.fn(),
  findAccountByCoords: jest.fn(),
  createVirementRecord: jest.fn(),
  decrementAccountBalance: jest.fn(),
  incrementAccountBalance: jest.fn(),
  createTransferTransactions: jest.fn(),
}));

await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const ctrl = await import("../../server/controllers/recurrentes.controller.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  return {
    session: { user: { id: 1, role: "UTILISATEUR" } },
    body: {},
    query: {},
    params: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateStatutRecurrente.mockResolvedValue(undefined);
  mockResetNbEchecsRecurrente.mockResolvedValue(undefined);
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockExecuterTransactionsRecurrentes.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// calculerProchaine (helper pur)
// ─────────────────────────────────────────────────────────────────────────────

describe("calculerProchaine", () => {
  it("HEBDOMADAIRE ajoute 7 jours", () => {
    expect(ctrl.calculerProchaine("HEBDOMADAIRE", "2026-04-15")).toBe("2026-04-22");
  });

  it("MENSUEL ajoute un mois", () => {
    expect(ctrl.calculerProchaine("MENSUEL", "2026-03-15")).toBe("2026-04-15");
  });

  it("MENSUEL gère la fin de mois (31 jan → 28 fev en année non-bissextile)", () => {
    // 31 jan + 1 mois → dernier jour de fev (28 en 2025)
    const result = ctrl.calculerProchaine("MENSUEL", "2025-01-31");
    expect(result).toBe("2025-02-28");
  });

  it("MENSUEL gère la fin de mois (31 jan → 29 fev en année bissextile)", () => {
    const result = ctrl.calculerProchaine("MENSUEL", "2024-01-31");
    expect(result).toBe("2024-02-29");
  });

  it("ANNUEL ajoute un an", () => {
    expect(ctrl.calculerProchaine("ANNUEL", "2026-04-15")).toBe("2027-04-15");
  });

  it("ANNUEL gère le 29 fev en année non-bissextile", () => {
    // 29 fév 2024 + 1 an → 28 fév 2025
    const result = ctrl.calculerProchaine("ANNUEL", "2024-02-29");
    expect(result).toBe("2025-02-28");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRecurrentes
// ─────────────────────────────────────────────────────────────────────────────

describe("getRecurrentes", () => {
  it("retourne les récurrentes de l'utilisateur avec prochaines_executions", async () => {
    const row = {
      id: 1,
      frequence: "MENSUEL",
      prochaine_execution: "2026-05-15",
      statut: "ACTIVE",
    };
    mockFindRecurrentes.mockResolvedValueOnce([row]);

    const req = mockReq();
    const res = mockRes();

    await ctrl.getRecurrentes(req, res);

    expect(mockFindRecurrentes).toHaveBeenCalledWith({ userId: 1, isAdmin: false });
    expect(res.json).toHaveBeenCalledWith({
      data: [expect.objectContaining({ prochaines_executions: expect.any(Array) })],
    });
    const data = res.json.mock.calls[0][0].data[0];
    expect(data.prochaines_executions).toHaveLength(5);
    expect(data.prochaines_executions[0]).toBe("2026-05-15");
  });

  it("toDateStr retourne '' si prochaine_execution est null (branche !val) — produit 500 dans calculerProchaine", async () => {
    // Couvre la branche `if (!val) return ""` de toDateStr.
    // calculerProchaine("MENSUEL", "") → Date invalide → toISOString throw → catch → 500.
    const row = { id: 11, frequence: "MENSUEL", prochaine_execution: null, statut: "ACTIVE" };
    mockFindRecurrentes.mockResolvedValueOnce([row]);
    const req = mockReq();
    const res = mockRes();

    await ctrl.getRecurrentes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("normalise prochaine_execution lorsque MySQL renvoie un objet Date", async () => {
    // Couvre toDateStr → branche `val instanceof Date`
    const row = {
      id: 9,
      frequence: "HEBDOMADAIRE",
      prochaine_execution: new Date("2026-04-22T00:00:00.000Z"),
      statut: "ACTIVE",
    };
    mockFindRecurrentes.mockResolvedValueOnce([row]);

    const req = mockReq();
    const res = mockRes();

    await ctrl.getRecurrentes(req, res);

    const data = res.json.mock.calls[0][0].data[0];
    expect(data.prochaines_executions[0]).toBe("2026-04-22");
  });

  it("passe isAdmin=true pour un ADMIN", async () => {
    mockFindRecurrentes.mockResolvedValueOnce([]);
    const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.getRecurrentes(req, res);

    expect(mockFindRecurrentes).toHaveBeenCalledWith({ userId: 2, isAdmin: true });
    expect(res.json).toHaveBeenCalledWith({ data: [] });
  });

  it("retourne 500 si findRecurrentes lance une erreur", async () => {
    mockFindRecurrentes.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq();
    const res = mockRes();

    await ctrl.getRecurrentes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("createRecurrente", () => {
  const validBody = {
    compte_source_id: 1,
    compte_destination_id: 2,
    montant: 500,
    frequence: "MENSUEL",
  };

  it("retourne 400 si des champs obligatoires sont manquants", async () => {
    const req = mockReq({ body: { compte_source_id: 1 } });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Champs manquants") }));
  });

  it("retourne 400 si la fréquence est invalide", async () => {
    const req = mockReq({ body: { ...validBody, frequence: "QUOTIDIEN" } });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Frequence invalide") }));
  });

  it("retourne 400 si le montant est négatif ou nul", async () => {
    const req = mockReq({ body: { ...validBody, montant: -10 } });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("montant") }));
  });

  it("retourne 400 si compte source et destination sont identiques", async () => {
    const req = mockReq({ body: { ...validBody, compte_source_id: 5, compte_destination_id: 5 } });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("differents") }));
  });

  it("retourne 403 si le compte source n'appartient pas à l'utilisateur", async () => {
    mockFindAuthorizedSourceAccount.mockResolvedValueOnce(null);
    const req = mockReq({ body: validBody });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 404 si le compte destination n'existe pas", async () => {
    mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 2000 });
    mockFindAccountById.mockResolvedValueOnce(null);
    const req = mockReq({ body: validBody });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("crée la récurrente avec succès (201) sans date_debut", async () => {
    mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 2000 });
    mockFindAccountById.mockResolvedValueOnce({ id: 2 });
    mockCreateRecurrente.mockResolvedValueOnce({ insertId: 7 });

    const req = mockReq({ body: validBody });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(mockCreateRecurrente).toHaveBeenCalledWith(
      expect.objectContaining({
        utilisateurId: 1,
        compteSourceId: 1,
        compteDestinationId: 2,
        montant: 500,
        frequence: "MENSUEL",
      })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RECURRENTE_CREEE" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 })
    );
  });

  it("crée la récurrente avec date_debut fournie comme prochaine_execution", async () => {
    mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 1000 });
    mockFindAccountById.mockResolvedValueOnce({ id: 2 });
    mockCreateRecurrente.mockResolvedValueOnce({ insertId: 8 });

    const req = mockReq({ body: { ...validBody, date_debut: "2026-06-01" } });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(mockCreateRecurrente).toHaveBeenCalledWith(
      expect.objectContaining({ prochaineExecution: "2026-06-01" })
    );
  });

  it("retourne 500 si erreur DB", async () => {
    mockFindAuthorizedSourceAccount.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ body: validBody });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("crée la récurrente avec description", async () => {
    mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 2000 });
    mockFindAccountById.mockResolvedValueOnce({ id: 2 });
    mockCreateRecurrente.mockResolvedValueOnce({ insertId: 9 });

    const req = mockReq({
      body: { ...validBody, description: "Paiement loyer", date_fin: "2027-01-01" },
    });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(mockCreateRecurrente).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Paiement loyer",
        dateFin: "2027-01-01",
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("retourne 500 si createAuditLog échoue", async () => {
    mockFindAuthorizedSourceAccount.mockResolvedValueOnce({ id: 1, solde: 2000 });
    mockFindAccountById.mockResolvedValueOnce({ id: 2 });
    mockCreateRecurrente.mockResolvedValueOnce({ insertId: 10 });
    mockCreateAuditLog.mockRejectedValueOnce(new Error("Audit DB error"));

    const req = mockReq({ body: validBody });
    const res = mockRes();

    await ctrl.createRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// suspendreRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("suspendreRecurrente", () => {
  it("retourne 404 si la récurrente n'existe pas", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();

    await ctrl.suspendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 403 si l'utilisateur n'est pas propriétaire", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 1, utilisateur_id: 99, statut: "ACTIVE" });
    const req = mockReq({ params: { id: "1" }, session: { user: { id: 1, role: "UTILISATEUR" } } });
    const res = mockRes();

    await ctrl.suspendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 400 si la récurrente n'est pas ACTIVE", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 1, utilisateur_id: 1, statut: "SUSPENDUE" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.suspendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("suspend la récurrente avec succès (200)", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 1, utilisateur_id: 1, statut: "ACTIVE" });
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.suspendreRecurrente(req, res);

    expect(mockUpdateStatutRecurrente).toHaveBeenCalledWith(1, "SUSPENDUE");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RECURRENTE_SUSPENDUE" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("un ADMIN peut suspendre la récurrente d'un autre utilisateur", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 1, utilisateur_id: 99, statut: "ACTIVE" });
    const req = mockReq({ params: { id: "1" }, session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.suspendreRecurrente(req, res);

    expect(mockUpdateStatutRecurrente).toHaveBeenCalledWith(1, "SUSPENDUE");
  });

  it("retourne 500 si erreur DB", async () => {
    mockFindRecurrenteById.mockRejectedValueOnce(new Error("DB error"));
    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.suspendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reprendreRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("reprendreRecurrente", () => {
  it("retourne 404 si la récurrente n'existe pas", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.reprendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 403 si l'utilisateur n'est pas propriétaire", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 5, utilisateur_id: 77, statut: "SUSPENDUE" });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.reprendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 400 si la récurrente n'est pas SUSPENDUE", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 5, utilisateur_id: 1, statut: "ACTIVE" });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.reprendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("reprend la récurrente avec succès (200), passe à ACTIVE et reset nb_echecs", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 5, utilisateur_id: 1, statut: "SUSPENDUE" });
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.reprendreRecurrente(req, res);

    // Doit utiliser resetNbEchecsRecurrente (reset compteur + statut ACTIVE en un appel)
    expect(mockResetNbEchecsRecurrente).toHaveBeenCalledWith(5);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RECURRENTE_REPRISE" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("retourne 500 si erreur DB", async () => {
    mockFindRecurrenteById.mockRejectedValueOnce(new Error("fail"));
    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.reprendreRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// annulerRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("annulerRecurrente", () => {
  it("retourne 404 si la récurrente n'existe pas", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 403 si l'utilisateur n'est pas propriétaire", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 3, utilisateur_id: 88, statut: "ACTIVE" });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 400 si la récurrente est déjà ANNULEE", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 3, utilisateur_id: 1, statut: "ANNULEE" });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si la récurrente est TERMINEE", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 3, utilisateur_id: 1, statut: "TERMINEE" });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("annule une récurrente ACTIVE avec succès (200)", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 3, utilisateur_id: 1, statut: "ACTIVE" });
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(mockUpdateStatutRecurrente).toHaveBeenCalledWith(3, "ANNULEE");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RECURRENTE_ANNULEE" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("annule une récurrente SUSPENDUE avec succès (200)", async () => {
    mockFindRecurrenteById.mockResolvedValueOnce({ id: 4, utilisateur_id: 1, statut: "SUSPENDUE" });
    const req = mockReq({ params: { id: "4" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(mockUpdateStatutRecurrente).toHaveBeenCalledWith(4, "ANNULEE");
  });

  it("retourne 500 si erreur DB", async () => {
    mockFindRecurrenteById.mockRejectedValueOnce(new Error("crash"));
    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.annulerRecurrente(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifierCompte
// ─────────────────────────────────────────────────────────────────────────────

describe("verifierCompte", () => {
  it("retourne 400 si le paramètre numero est absent", async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si le paramètre numero est une chaîne vide", async () => {
    const req = mockReq({ query: { numero: "   " } });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 404 si aucun compte ne correspond au numéro", async () => {
    mockFindCompteByNumero.mockResolvedValueOnce(null);
    const req = mockReq({ query: { numero: "CA0099999" } });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(mockFindCompteByNumero).toHaveBeenCalledWith("CA0099999");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 400 si le compte trouvé est inactif", async () => {
    mockFindCompteByNumero.mockResolvedValueOnce({ id: 7, type_compte: "CHEQUES", est_actif: 0, client_nom: "Alice" });
    const req = mockReq({ query: { numero: "CA0077777" } });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain("inactif");
  });

  it("retourne 200 avec id, type_compte et client_nom — sans solde", async () => {
    mockFindCompteByNumero.mockResolvedValueOnce({ id: 3, type_compte: "EPARGNE", est_actif: 1, client_nom: "Jean Dupont" });
    const req = mockReq({ query: { numero: "CA0033333" } });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      id: 3,
      type_compte: "EPARGNE",
      client_nom: "Jean Dupont",
    });
    // Le solde ne doit jamais être exposé
    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty("solde");
    expect(body).not.toHaveProperty("est_actif");
  });

  it("trim le numéro de compte avant la recherche", async () => {
    mockFindCompteByNumero.mockResolvedValueOnce({ id: 5, type_compte: "CHEQUES", est_actif: 1, client_nom: "Bob" });
    const req = mockReq({ query: { numero: "  CA0055555  " } });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(mockFindCompteByNumero).toHaveBeenCalledWith("CA0055555");
  });

  it("retourne 500 si findCompteByNumero lance une erreur", async () => {
    mockFindCompteByNumero.mockRejectedValueOnce(new Error("DB crash"));
    const req = mockReq({ query: { numero: "CA0011111" } });
    const res = mockRes();

    await ctrl.verifierCompte(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// adminExecuterRecurrentes
// ─────────────────────────────────────────────────────────────────────────────

describe("adminExecuterRecurrentes", () => {
  it("appelle executerTransactionsRecurrentes et retourne 200 avec message", async () => {
    const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.adminExecuterRecurrentes(req, res);

    expect(mockExecuterTransactionsRecurrentes).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("retourne 500 si le scheduler lance une erreur", async () => {
    mockExecuterTransactionsRecurrentes.mockRejectedValueOnce(new Error("Scheduler crash"));
    const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.adminExecuterRecurrentes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("n'appelle pas le scheduler plus d'une fois par appel", async () => {
    const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.adminExecuterRecurrentes(req, res);

    expect(mockExecuterTransactionsRecurrentes).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// adminGetRecurrentes
// ─────────────────────────────────────────────────────────────────────────────

describe("adminGetRecurrentes", () => {
  it("retourne toutes les récurrentes avec prochaines_executions", async () => {
    const rows = [
      { id: 1, frequence: "HEBDOMADAIRE", prochaine_execution: "2026-04-22", statut: "ACTIVE" },
      { id: 2, frequence: "ANNUEL", prochaine_execution: "2027-01-01", statut: "SUSPENDUE" },
    ];
    mockFindRecurrentes.mockResolvedValueOnce(rows);

    const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.adminGetRecurrentes(req, res);

    expect(mockFindRecurrentes).toHaveBeenCalledWith({ userId: null, isAdmin: true });
    const response = res.json.mock.calls[0][0];
    expect(response.data).toHaveLength(2);
    expect(response.data[0].prochaines_executions).toHaveLength(5);
  });

  it("retourne 500 si erreur DB", async () => {
    mockFindRecurrentes.mockRejectedValueOnce(new Error("DB fail"));
    const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } } });
    const res = mockRes();

    await ctrl.adminGetRecurrentes(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
