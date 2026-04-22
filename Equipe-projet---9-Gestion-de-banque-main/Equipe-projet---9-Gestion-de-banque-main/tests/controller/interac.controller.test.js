import { jest } from "@jest/globals";

/* ── Mocks des dépendances ─────────────────────────────────────── */

const mockFindAutoDeposit                       = jest.fn();
const mockFindActiveAutoDepositByEmail          = jest.fn();
const mockActiverAutoDepositDirectement         = jest.fn().mockResolvedValue({ insertId: 1 });
const mockDeactivateAutoDeposit                 = jest.fn().mockResolvedValue(undefined);
const mockGetTotalEnvoyeAujourdhui              = jest.fn();
const mockGetTotalEnvoye7Jours                  = jest.fn();
const mockGetTotalEnvoye30Jours                 = jest.fn();
const mockFindInteracTransferts                 = jest.fn();
const mockFindTransfertsParClient               = jest.fn();
const mockFindAutoDepositParClient              = jest.fn();
const mockGetStatsInteracParClient              = jest.fn();
const mockForceActiverAutoDepositParClient      = jest.fn().mockResolvedValue(undefined);
const mockFindUserIdByClientId                  = jest.fn().mockResolvedValue(null);
const mockDesactiverAutoDepositParClient        = jest.fn().mockResolvedValue(undefined);
const mockGetLimitesInteracParClient            = jest.fn();
const mockSetLimitesInteracParClient            = jest.fn().mockResolvedValue(true);
const mockGetLimitesInteracParUtilisateur       = jest.fn();
const mockFindTransfertsEnAttentePourDestinataire = jest.fn();
const mockFindTransfertById                     = jest.fn();
const mockCreateInteracTransfert                = jest.fn();
const mockAccepterTransfert                     = jest.fn().mockResolvedValue(undefined);
const mockAnnulerTransfert                      = jest.fn().mockResolvedValue(undefined);
const mockExpireTransfertsExpires               = jest.fn();
const mockDecrementAccountBalance               = jest.fn().mockResolvedValue(undefined);
const mockIncrementAccountBalance               = jest.fn().mockResolvedValue(undefined);
const mockFindAuthorizedAccount                 = jest.fn();
const mockCreateInteracTransaction              = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog                        = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/interac.data.js", () => ({
  INTERAC_MIN_PAR_TRANSFERT:  0.5,
  INTERAC_LIMITE_QUOTIDIENNE: 3000,
  INTERAC_LIMITE_7_JOURS:     10000,
  INTERAC_LIMITE_30_JOURS:    20000,
  findAutoDeposit:                          mockFindAutoDeposit,
  findActiveAutoDepositByEmail:             mockFindActiveAutoDepositByEmail,
  activerAutoDepositDirectement:            mockActiverAutoDepositDirectement,
  deactivateAutoDeposit:                    mockDeactivateAutoDeposit,
  getTotalEnvoyeAujourdhui:                 mockGetTotalEnvoyeAujourdhui,
  getTotalEnvoye7Jours:                     mockGetTotalEnvoye7Jours,
  getTotalEnvoye30Jours:                    mockGetTotalEnvoye30Jours,
  findInteracTransferts:                    mockFindInteracTransferts,
  findTransfertsEnAttentePourDestinataire:  mockFindTransfertsEnAttentePourDestinataire,
  findTransfertById:                        mockFindTransfertById,
  createInteracTransfert:                   mockCreateInteracTransfert,
  accepterTransfert:                        mockAccepterTransfert,
  annulerTransfert:                         mockAnnulerTransfert,
  expireTransfertsExpires:                  mockExpireTransfertsExpires,
  decrementAccountBalance:                  mockDecrementAccountBalance,
  incrementAccountBalance:                  mockIncrementAccountBalance,
  findAuthorizedAccount:                    mockFindAuthorizedAccount,
  createInteracTransaction:                 mockCreateInteracTransaction,
  findTransfertsParClient:                  mockFindTransfertsParClient,
  findAutoDepositParClient:                 mockFindAutoDepositParClient,
  getStatsInteracParClient:                 mockGetStatsInteracParClient,
  forceActiverAutoDepositParClient:         mockForceActiverAutoDepositParClient,
  findUserIdByClientId:                     mockFindUserIdByClientId,
  desactiverAutoDepositParClient:           mockDesactiverAutoDepositParClient,
  getLimitesInteracParClient:               mockGetLimitesInteracParClient,
  setLimitesInteracParClient:               mockSetLimitesInteracParClient,
  getLimitesInteracParUtilisateur:          mockGetLimitesInteracParUtilisateur,
}));

await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

// bcryptjs mock — compare retourne true par défaut, hash retourne un hash fictif
await jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    hash:    jest.fn().mockResolvedValue("$2b$10$hashedpassword"),
    compare: jest.fn().mockResolvedValue(true),
  },
}));

const ctrl = await import("../../server/controllers/interac.controller.js");

/* ── Helpers ───────────────────────────────────────────────────── */

const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

const mockReq = (overrides = {}) => ({
  session: { user: { id: 1, role: "UTILISATEUR", email: "user@test.com" } },
  params: {},
  query:  {},
  body:   {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockActiverAutoDepositDirectement.mockResolvedValue({ insertId: 1 });
  mockDeactivateAutoDeposit.mockResolvedValue(undefined);
  mockDecrementAccountBalance.mockResolvedValue(undefined);
  mockIncrementAccountBalance.mockResolvedValue(undefined);
  mockAccepterTransfert.mockResolvedValue(undefined);
  mockAnnulerTransfert.mockResolvedValue(undefined);
  mockCreateInteracTransaction.mockResolvedValue(undefined);
  mockExpireTransfertsExpires.mockResolvedValue([]);
  mockGetLimitesInteracParUtilisateur.mockResolvedValue({ limite_24h: null, limite_7j: null, limite_30j: null });
});

/* ══ getLimitesInterac ════════════════════════════════════════════ */
describe("getLimitesInterac", () => {
  it("retourne les limites globales quand aucune personnalisation", async () => {
    mockGetLimitesInteracParUtilisateur.mockResolvedValueOnce({ limite_24h: null, limite_7j: null, limite_30j: null });
    const req = mockReq();
    const res = mockRes();
    await ctrl.getLimitesInterac(req, res);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        limite_24h: 3000,
        limite_7j:  10000,
        limite_30j: 20000,
        perso_24h:  false,
        perso_7j:   false,
        perso_30j:  false,
      }),
    });
  });

  it("retourne les limites personnalisees quand elles sont definies", async () => {
    mockGetLimitesInteracParUtilisateur.mockResolvedValueOnce({ limite_24h: 1000, limite_7j: 5000, limite_30j: null });
    const req = mockReq();
    const res = mockRes();
    await ctrl.getLimitesInterac(req, res);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        limite_24h: 1000,
        limite_7j:  5000,
        limite_30j: 20000,
        perso_24h:  true,
        perso_7j:   true,
        perso_30j:  false,
      }),
    });
  });

  it("retourne 500 sur erreur", async () => {
    mockGetLimitesInteracParUtilisateur.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq();
    const res = mockRes();
    await ctrl.getLimitesInterac(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ getAutoDeposit ═══════════════════════════════════════════════ */
describe("getAutoDeposit", () => {
  it("retourne le profil auto-depot existant", async () => {
    const profil = { id: 1, email_interac: "a@a.com", statut: "ACTIVE" };
    mockFindAutoDeposit.mockResolvedValueOnce(profil);
    const req = mockReq();
    const res = mockRes();
    await ctrl.getAutoDeposit(req, res);
    expect(res.json).toHaveBeenCalledWith({ data: profil });
  });

  it("retourne 404 si aucun profil", async () => {
    mockFindAutoDeposit.mockResolvedValueOnce(null);
    const req = mockReq();
    const res = mockRes();
    await ctrl.getAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 500 en cas d'erreur", async () => {
    mockFindAutoDeposit.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq();
    const res = mockRes();
    await ctrl.getAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ demanderAutoDeposit ══════════════════════════════════════════ */
describe("demanderAutoDeposit", () => {
  it("active directement le profil et retourne les donnees", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce({ id: 5, solde: 500, est_actif: 1 });
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce(null);
    mockFindAutoDeposit.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", email_interac: "moi@test.com" });
    const req = mockReq({ body: { email_interac: "moi@test.com", compte_depot_id: 5 } });
    const res = mockRes();
    await ctrl.demanderAutoDeposit(req, res);
    expect(mockActiverAutoDepositDirectement).toHaveBeenCalledWith(
      expect.objectContaining({ emailInterac: "moi@test.com", compteDepotId: 5 })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("succes"), data: expect.objectContaining({ statut: "ACTIVE" }) })
    );
  });

  it("retourne 403 si le compte n'appartient pas a l'utilisateur", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce(null);
    const req = mockReq({ body: { email_interac: "x@x.com", compte_depot_id: 99 } });
    const res = mockRes();
    await ctrl.demanderAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 400 si l'email est deja actif chez un autre utilisateur", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce({ id: 5 });
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce({ utilisateur_id: 999, compte_depot_id: 10 });
    const req = mockReq({ body: { email_interac: "pris@test.com", compte_depot_id: 5 } });
    const res = mockRes();
    await ctrl.demanderAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("autorise si l'email actif appartient au meme utilisateur", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce({ id: 5 });
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce({ utilisateur_id: 1, compte_depot_id: 5 });
    mockFindAutoDeposit.mockResolvedValueOnce({ id: 1, statut: "ACTIVE" });
    const req = mockReq({ body: { email_interac: "own@test.com", compte_depot_id: 5 } });
    const res = mockRes();
    await ctrl.demanderAutoDeposit(req, res);
    expect(mockActiverAutoDepositDirectement).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  it("retourne 400 sur ER_DUP_ENTRY", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce({ id: 5 });
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce(null);
    const dupErr = Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    mockActiverAutoDepositDirectement.mockRejectedValueOnce(dupErr);
    const req = mockReq({ body: { email_interac: "dup@test.com", compte_depot_id: 5 } });
    const res = mockRes();
    await ctrl.demanderAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 500 sur erreur generique", async () => {
    mockFindAuthorizedAccount.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ body: { email_interac: "x@x.com", compte_depot_id: 5 } });
    const res = mockRes();
    await ctrl.demanderAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ desactiverAutoDeposit ════════════════════════════════════════ */
describe("desactiverAutoDeposit", () => {
  it("desactive le profil actif", async () => {
    mockFindAutoDeposit.mockResolvedValueOnce({ statut: "ACTIVE", email_interac: "a@a.com" });
    const req = mockReq();
    const res = mockRes();
    await ctrl.desactiverAutoDeposit(req, res);
    expect(mockDeactivateAutoDeposit).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("succes") }));
  });

  it("retourne 404 si aucun profil actif", async () => {
    mockFindAutoDeposit.mockResolvedValueOnce(null);
    const req = mockReq();
    const res = mockRes();
    await ctrl.desactiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 404 si profil EN_ATTENTE (pas encore actif)", async () => {
    mockFindAutoDeposit.mockResolvedValueOnce({ statut: "EN_ATTENTE" });
    const req = mockReq();
    const res = mockRes();
    await ctrl.desactiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 500 sur erreur", async () => {
    mockFindAutoDeposit.mockRejectedValueOnce(new Error("fail"));
    const req = mockReq();
    const res = mockRes();
    await ctrl.desactiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ getTransferts ════════════════════════════════════════════════ */
describe("getTransferts", () => {
  it("retourne les transferts de l'utilisateur (UTILISATEUR)", async () => {
    const data = [{ id: 1, montant: 50 }];
    mockFindInteracTransferts.mockResolvedValueOnce(data);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.getTransferts(req, res);
    expect(mockFindInteracTransferts).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: false })
    );
    expect(res.json).toHaveBeenCalledWith({ data });
  });

  it("retourne tous les transferts pour ADMIN et cree un audit log", async () => {
    mockFindInteracTransferts.mockResolvedValueOnce([]);
    const req = mockReq({
      session: { user: { id: 1, role: "ADMIN", email: "admin@test.com" } },
      query: {},
    });
    const res = mockRes();
    await ctrl.getTransferts(req, res);
    expect(mockFindInteracTransferts).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: true })
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VIEW_GLOBAL_INTERAC" })
    );
  });

  it("passe le parametre de recherche", async () => {
    mockFindInteracTransferts.mockResolvedValueOnce([]);
    const req = mockReq({
      session: { user: { id: 1, role: "ADMIN", email: "admin@test.com" } },
      query: { search: "alice" },
    });
    const res = mockRes();
    await ctrl.getTransferts(req, res);
    expect(mockFindInteracTransferts).toHaveBeenCalledWith(
      expect.objectContaining({ search: "alice" })
    );
  });

  it("retourne 500 sur erreur", async () => {
    mockExpireTransfertsExpires.mockRejectedValueOnce(new Error("fail"));
    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.getTransferts(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ getTransfertsAReclamer ═══════════════════════════════════════ */
describe("getTransfertsAReclamer", () => {
  it("retourne les transferts a reclamer", async () => {
    const data = [{ id: 2, montant: 100 }];
    mockFindAutoDeposit.mockResolvedValueOnce(null);
    mockFindTransfertsEnAttentePourDestinataire.mockResolvedValueOnce(data);
    const req = mockReq();
    const res = mockRes();
    await ctrl.getTransfertsAReclamer(req, res);
    expect(res.json).toHaveBeenCalledWith({ data });
  });

  it("utilise l'email interac si auto-depot ACTIVE", async () => {
    mockFindAutoDeposit.mockResolvedValueOnce({ statut: "ACTIVE", email_interac: "interac@test.com" });
    mockFindTransfertsEnAttentePourDestinataire.mockResolvedValueOnce([]);
    const req = mockReq();
    const res = mockRes();
    await ctrl.getTransfertsAReclamer(req, res);
    expect(mockFindTransfertsEnAttentePourDestinataire).toHaveBeenCalledWith(
      "user@test.com",
      "interac@test.com"
    );
  });

  it("retourne 500 sur erreur", async () => {
    mockExpireTransfertsExpires.mockRejectedValueOnce(new Error("fail"));
    const req = mockReq();
    const res = mockRes();
    await ctrl.getTransfertsAReclamer(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ sendTransfert ════════════════════════════════════════════════ */
describe("sendTransfert", () => {
  const baseBody = {
    compte_source_id: 5,
    email_destinataire: "dest@test.com",
    montant: 100,
    mot_de_passe: "Secret123",
  };

  beforeEach(() => {
    mockFindAuthorizedAccount.mockResolvedValue({ id: 5, solde: 5000, est_actif: 1 });
    mockGetTotalEnvoyeAujourdhui.mockResolvedValue(0);
    mockGetTotalEnvoye7Jours.mockResolvedValue(0);
    mockGetTotalEnvoye30Jours.mockResolvedValue(0);
    mockFindActiveAutoDepositByEmail.mockResolvedValue(null);
    mockCreateInteracTransfert.mockResolvedValue({ insertId: 10 });
  });

  it("envoie un virement EN_ATTENTE avec mot de passe (sans auto-depot)", async () => {
    const req = mockReq({ body: baseBody });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(mockDecrementAccountBalance).toHaveBeenCalledWith(5, 100);
    expect(mockCreateInteracTransfert).toHaveBeenCalledWith(
      expect.objectContaining({ statut: "EN_ATTENTE" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("envoie ACCEPTEE immediatement si destinataire a auto-depot actif", async () => {
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce({
      utilisateur_id: 2, compte_depot_id: 8,
    });
    const req = mockReq({ body: { ...baseBody, mot_de_passe: undefined } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(mockCreateInteracTransfert).toHaveBeenCalledWith(
      expect.objectContaining({ statut: "ACCEPTEE" })
    );
    expect(mockIncrementAccountBalance).toHaveBeenCalledWith(8, 100);
    const responseArg = res.json.mock.calls[0][0];
    expect(responseArg.statut).toBe("ACCEPTEE");
  });

  it("retourne 400 si envoi a soi-meme", async () => {
    const req = mockReq({ body: { ...baseBody, email_destinataire: "user@test.com" } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 403 si compte source non autorise", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce(null);
    const req = mockReq({ body: baseBody });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 400 si solde insuffisant", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce({ id: 5, solde: 10, est_actif: 1 });
    const req = mockReq({ body: baseBody });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("insuffisant") }));
  });

  it("retourne 400 si limite quotidienne depassee", async () => {
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(2950);
    const req = mockReq({ body: { ...baseBody, montant: 100 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("24 heures") }));
  });

  it("retourne 400 si limite 7 jours depassee", async () => {
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(0);
    mockGetTotalEnvoye7Jours.mockResolvedValueOnce(9950);
    const req = mockReq({ body: { ...baseBody, montant: 100 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("7 jours") }));
  });

  it("retourne 400 si limite 30 jours depassee", async () => {
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(0);
    mockGetTotalEnvoye7Jours.mockResolvedValueOnce(0);
    mockGetTotalEnvoye30Jours.mockResolvedValueOnce(19950);
    const req = mockReq({ body: { ...baseBody, montant: 100 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("30 jours") }));
  });

  it("retourne 400 si mot de passe absent et pas auto-depot", async () => {
    const req = mockReq({ body: { ...baseBody, mot_de_passe: "" } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si mot de passe egal a l'email destinataire", async () => {
    const req = mockReq({ body: { ...baseBody, mot_de_passe: "dest@test.com" } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si mot de passe egal au montant", async () => {
    const req = mockReq({ body: { ...baseBody, mot_de_passe: "100" } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si mot de passe trop long (> 25 chars)", async () => {
    const req = mockReq({ body: { ...baseBody, mot_de_passe: "a".repeat(26) } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 500 sur erreur", async () => {
    mockFindAuthorizedAccount.mockRejectedValueOnce(new Error("fail"));
    const req = mockReq({ body: baseBody });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("utilise la description fournie comme base du libelle de transaction", async () => {
    mockCreateInteracTransfert.mockResolvedValueOnce({ insertId: 55 });
    const req = mockReq({ body: { ...baseBody, description: "Remboursement dîner" } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    // createInteracTransaction doit recevoir la description trimmée
    const txArgs = mockCreateInteracTransaction.mock.calls[0][0];
    expect(txArgs.description).toContain("Remboursement dîner");
  });

  it("respecte la limite 24h personnalisee (1 000$)", async () => {
    mockGetLimitesInteracParUtilisateur.mockResolvedValueOnce({ limite_24h: 1000, limite_7j: null, limite_30j: null });
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(950);
    const req = mockReq({ body: { ...baseBody, montant: 100 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("24 heures") }));
  });

  it("respecte la limite 7j personnalisee (2 000$)", async () => {
    mockGetLimitesInteracParUtilisateur.mockResolvedValueOnce({ limite_24h: null, limite_7j: 2000, limite_30j: null });
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(0);
    mockGetTotalEnvoye7Jours.mockResolvedValueOnce(1950);
    const req = mockReq({ body: { ...baseBody, montant: 100 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("7 jours") }));
  });

  it("respecte la limite 30j personnalisee (5 000$)", async () => {
    mockGetLimitesInteracParUtilisateur.mockResolvedValueOnce({ limite_24h: null, limite_7j: null, limite_30j: 5000 });
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(0);
    mockGetTotalEnvoye7Jours.mockResolvedValueOnce(0);
    mockGetTotalEnvoye30Jours.mockResolvedValueOnce(4950);
    const req = mockReq({ body: { ...baseBody, montant: 100 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("30 jours") }));
  });

  it("autorise l'envoi quand sous toutes les limites personnalisees", async () => {
    mockGetLimitesInteracParUtilisateur.mockResolvedValueOnce({ limite_24h: 500, limite_7j: 2000, limite_30j: 5000 });
    mockGetTotalEnvoyeAujourdhui.mockResolvedValueOnce(0);
    mockGetTotalEnvoye7Jours.mockResolvedValueOnce(0);
    mockGetTotalEnvoye30Jours.mockResolvedValueOnce(0);
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce(null);
    mockCreateInteracTransfert.mockResolvedValueOnce({ insertId: 99 });
    const req = mockReq({ body: { ...baseBody, montant: 50 } });
    const res = mockRes();
    await ctrl.sendTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

/* ══ reclamerTransfert ════════════════════════════════════════════ */
describe("reclamerTransfert", () => {
  const baseTransfert = {
    id: 10,
    expediteur_id: 2,
    compte_source_id: 5,
    email_destinataire: "user@test.com",
    montant: "100.00",
    statut: "EN_ATTENTE",
    date_expiration: new Date(Date.now() + 86400000).toISOString(),
    mot_de_passe_hash: "$2b$10$hashedpassword",
    description: "Cadeau",
  };

  beforeEach(() => {
    mockFindTransfertById.mockResolvedValue(baseTransfert);
    mockFindAutoDeposit.mockResolvedValue(null);
    mockFindAuthorizedAccount.mockResolvedValue({ id: 7, solde: 0, est_actif: 1 });
  });

  it("reclame avec succes", async () => {
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "correct" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(mockIncrementAccountBalance).toHaveBeenCalledWith(7, 100);
    expect(mockAccepterTransfert).toHaveBeenCalledWith(10, 7);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("succes") }));
  });

  it("retourne 404 si transfert introuvable", async () => {
    mockFindTransfertById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "999" }, body: { compte_destination_id: 7, mot_de_passe: "x" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 400 si le transfert n'est plus en attente", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, statut: "ACCEPTEE" });
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "x" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si le transfert a expire", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, date_expiration: new Date(0).toISOString() });
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "x" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 403 si l'email ne correspond pas a l'utilisateur", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, email_destinataire: "autre@test.com" });
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "x" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("autorise la reclamation via l'email interac actif", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, email_destinataire: "interac@user.com" });
    mockFindAutoDeposit.mockResolvedValueOnce({ statut: "ACTIVE", email_interac: "interac@user.com" });
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "correct" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("succes") }));
  });

  it("retourne 400 si mot de passe incorrect", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    bcrypt.compare.mockResolvedValueOnce(false);
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "mauvais" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si le transfert n'a pas de mot de passe", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, mot_de_passe_hash: null });
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "x" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 403 si compte destination non autorise", async () => {
    mockFindAuthorizedAccount.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 99, mot_de_passe: "correct" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 500 sur erreur", async () => {
    mockFindTransfertById.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "x" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("utilise Interac #id comme libelle quand le transfert n'a pas de description", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, description: null });
    const req = mockReq({ params: { id: "10" }, body: { compte_destination_id: 7, mot_de_passe: "correct" } });
    const res = mockRes();
    await ctrl.reclamerTransfert(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("succes") }));
    const txArgs = mockCreateInteracTransaction.mock.calls[0][0];
    expect(txArgs.description).toContain("Interac #10");
  });
});

/* ══ cancelTransfert ══════════════════════════════════════════════ */
describe("cancelTransfert", () => {
  const baseTransfert = {
    id: 10, expediteur_id: 1, compte_source_id: 5, montant: "100.00", statut: "EN_ATTENTE",
  };

  beforeEach(() => {
    mockFindTransfertById.mockResolvedValue(baseTransfert);
  });

  it("annule son propre virement et rembourse", async () => {
    const req = mockReq({ params: { id: "10" } });
    const res = mockRes();
    await ctrl.cancelTransfert(req, res);
    expect(mockIncrementAccountBalance).toHaveBeenCalledWith(5, 100);
    expect(mockAnnulerTransfert).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("rembours") }));
  });

  it("admin peut annuler le virement d'un autre", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, expediteur_id: 99 });
    const req = mockReq({
      session: { user: { id: 1, role: "ADMIN", email: "admin@test.com" } },
      params: { id: "10" },
    });
    const res = mockRes();
    await ctrl.cancelTransfert(req, res);
    expect(mockAnnulerTransfert).toHaveBeenCalledWith(10);
  });

  it("retourne 404 si transfert introuvable", async () => {
    mockFindTransfertById.mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: "999" } });
    const res = mockRes();
    await ctrl.cancelTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 400 si le transfert n'est plus en attente", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, statut: "ACCEPTEE" });
    const req = mockReq({ params: { id: "10" } });
    const res = mockRes();
    await ctrl.cancelTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 403 si utilisateur n'est pas l'expediteur (non admin)", async () => {
    mockFindTransfertById.mockResolvedValueOnce({ ...baseTransfert, expediteur_id: 99 });
    const req = mockReq({ params: { id: "10" } });
    const res = mockRes();
    await ctrl.cancelTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("retourne 500 sur erreur", async () => {
    mockFindTransfertById.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { id: "10" } });
    const res = mockRes();
    await ctrl.cancelTransfert(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ _expireEtRembourser — couverture du corps de boucle ══════════ */
describe("_expireEtRembourser (via getTransferts)", () => {
  it("rembourse chaque transfert expire et cree une transaction + audit", async () => {
    const expired = [
      { id: 1, compte_source_id: 5, montant: "100.00" },
      { id: 2, compte_source_id: 7, montant: "50.00" },
    ];
    mockExpireTransfertsExpires.mockResolvedValueOnce(expired);
    mockFindInteracTransferts.mockResolvedValueOnce([]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.getTransferts(req, res);
    expect(mockIncrementAccountBalance).toHaveBeenCalledWith(5, 100);
    expect(mockIncrementAccountBalance).toHaveBeenCalledWith(7, 50);
    expect(mockCreateInteracTransaction).toHaveBeenCalledTimes(2);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "INTERAC_EXPIRATION" })
    );
  });
});

/* ══ adminGetTransfertsClient ═════════════════════════════════════ */
describe("adminGetTransfertsClient", () => {
  it("retourne les transferts du client", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mockFindTransfertsParClient.mockResolvedValueOnce(rows);
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetTransfertsClient(req, res);
    expect(mockFindTransfertsParClient).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ data: rows });
  });

  it("retourne 500 sur erreur", async () => {
    mockFindTransfertsParClient.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetTransfertsClient(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ adminGetStatsClient ══════════════════════════════════════════ */
describe("adminGetStatsClient", () => {
  it("retourne les statistiques interac du client", async () => {
    const stats = { total_24h: 100, total_7j: 500, total_30j: 1000, nb_en_attente: 1 };
    mockGetStatsInteracParClient.mockResolvedValueOnce(stats);
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetStatsClient(req, res);
    expect(mockGetStatsInteracParClient).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ data: stats });
  });

  it("retourne 500 sur erreur", async () => {
    mockGetStatsInteracParClient.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetStatsClient(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ adminGetAutoDepositClient ════════════════════════════════════ */
describe("adminGetAutoDepositClient", () => {
  it("retourne le profil auto-depot du client", async () => {
    const profile = { id: 3, email_interac: "a@a.com", statut: "ACTIVE" };
    mockFindAutoDepositParClient.mockResolvedValueOnce(profile);
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetAutoDepositClient(req, res);
    expect(mockFindAutoDepositParClient).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ data: profile });
  });

  it("retourne 500 sur erreur", async () => {
    mockFindAutoDepositParClient.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetAutoDepositClient(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ adminForceActiverAutoDeposit ════════════════════════════════ */
describe("adminForceActiverAutoDeposit", () => {
  const adminReq = (body = {}) =>
    mockReq({
      session: { user: { id: 99, role: "ADMIN", email: "admin@test.com" } },
      params: { clientId: "10" },
      body,
    });

  it("retourne 400 si email_interac manquant", async () => {
    const req = adminReq({ compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    // Aucune écriture ne doit avoir été tentée
    expect(mockForceActiverAutoDepositParClient).not.toHaveBeenCalled();
  });

  it("retourne 400 si compte_depot_id manquant", async () => {
    const req = adminReq({ email_interac: "a@a.com" });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockForceActiverAutoDepositParClient).not.toHaveBeenCalled();
  });

  it("retourne 404 si le client n'est rattaché à aucun utilisateur (avant toute écriture)", async () => {
    mockFindUserIdByClientId.mockResolvedValueOnce(null);
    const req = adminReq({ email_interac: "a@a.com", compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    // Aucune mutation ne doit avoir été effectuée
    expect(mockForceActiverAutoDepositParClient).not.toHaveBeenCalled();
  });

  it("retourne 400 si l'email est déjà actif chez un autre utilisateur (sans écrire)", async () => {
    mockFindUserIdByClientId.mockResolvedValueOnce(7);
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce({ utilisateur_id: 88 });
    const req = adminReq({ email_interac: "a@a.com", compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockForceActiverAutoDepositParClient).not.toHaveBeenCalled();
  });

  it("active avec succès quand l'email est déjà actif mais chez le même utilisateur", async () => {
    mockFindUserIdByClientId.mockResolvedValueOnce(7);
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce({ utilisateur_id: 7 });
    mockForceActiverAutoDepositParClient.mockResolvedValueOnce(7);
    mockFindAutoDepositParClient.mockResolvedValueOnce({ id: 3, statut: "ACTIVE" });
    const req = adminReq({ email_interac: "a@a.com", compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("activé") })
    );
  });

  it("active avec succès sans conflit d'email", async () => {
    mockFindUserIdByClientId.mockResolvedValueOnce(7);
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce(null);
    mockForceActiverAutoDepositParClient.mockResolvedValueOnce(7);
    mockFindAutoDepositParClient.mockResolvedValueOnce({ id: 3, statut: "ACTIVE" });
    const req = adminReq({ email_interac: "b@b.com", compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ADMIN_INTERAC_AUTODEPOSIT_FORCE" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("activé") })
    );
  });

  it("retourne 404 si forceActiverAutoDepositParClient renvoie null à l'écriture finale", async () => {
    // Cas rare : race condition entre la lecture (userId=7) et l'écriture (lien supprimé entre temps)
    mockFindUserIdByClientId.mockResolvedValueOnce(7);
    mockFindActiveAutoDepositByEmail.mockResolvedValueOnce(null);
    mockForceActiverAutoDepositParClient.mockResolvedValueOnce(null);
    const req = adminReq({ email_interac: "a@a.com", compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne 500 sur erreur", async () => {
    mockFindUserIdByClientId.mockRejectedValueOnce(new Error("db fail"));
    const req = adminReq({ email_interac: "a@a.com", compte_depot_id: 5 });
    const res = mockRes();
    await ctrl.adminForceActiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ adminDesactiverAutoDeposit ═══════════════════════════════════ */
describe("adminDesactiverAutoDeposit", () => {
  it("desactive l'auto-depot et retourne un message", async () => {
    mockDesactiverAutoDepositParClient.mockResolvedValueOnce(undefined);
    const req = mockReq({
      session: { user: { id: 99, role: "ADMIN", email: "admin@test.com" } },
      params: { clientId: "10" },
    });
    const res = mockRes();
    await ctrl.adminDesactiverAutoDeposit(req, res);
    expect(mockDesactiverAutoDepositParClient).toHaveBeenCalledWith(10);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ADMIN_INTERAC_AUTODEPOSIT_DESACTIVE" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it("retourne 500 sur erreur", async () => {
    mockDesactiverAutoDepositParClient.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminDesactiverAutoDeposit(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ adminGetLimitesClient ════════════════════════════════════════ */
describe("adminGetLimitesClient", () => {
  it("retourne 404 si client introuvable", async () => {
    mockGetLimitesInteracParClient.mockResolvedValueOnce(null);
    const req = mockReq({ params: { clientId: "99" } });
    const res = mockRes();
    await ctrl.adminGetLimitesClient(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retourne les limites du client", async () => {
    const limites = { limite_24h: 3000, limite_7j: null, limite_30j: null };
    mockGetLimitesInteracParClient.mockResolvedValueOnce(limites);
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetLimitesClient(req, res);
    expect(res.json).toHaveBeenCalledWith({ data: limites });
  });

  it("retourne 500 sur erreur", async () => {
    mockGetLimitesInteracParClient.mockRejectedValueOnce(new Error("db fail"));
    const req = mockReq({ params: { clientId: "10" } });
    const res = mockRes();
    await ctrl.adminGetLimitesClient(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ══ adminSetLimitesClient ════════════════════════════════════════ */
describe("adminSetLimitesClient", () => {
  const adminReq = (body = {}) =>
    mockReq({
      session: { user: { id: 99, role: "ADMIN", email: "admin@test.com" } },
      params: { clientId: "10" },
      body,
    });

  it("retourne 404 si client introuvable (setLimites retourne false)", async () => {
    mockSetLimitesInteracParClient.mockResolvedValueOnce(false);
    const req = adminReq({ limite_24h: 1000, limite_7j: null, limite_30j: null });
    const res = mockRes();
    await ctrl.adminSetLimitesClient(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("met a jour les limites et retourne les nouvelles valeurs", async () => {
    const limites = { limite_24h: 2000, limite_7j: 8000, limite_30j: null };
    mockSetLimitesInteracParClient.mockResolvedValueOnce(true);
    mockGetLimitesInteracParClient.mockResolvedValueOnce(limites);
    const req = adminReq({ limite_24h: 2000, limite_7j: 8000, limite_30j: null });
    const res = mockRes();
    await ctrl.adminSetLimitesClient(req, res);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ADMIN_INTERAC_LIMITES_MODIFIEES" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("jour"), data: limites })
    );
  });

  it("retourne 500 sur erreur (body vide → toutes les limites undefined)", async () => {
    // Body vide : limite_24h/7j/30j === undefined → couvre la branche outer-false de chaque ternaire
    mockSetLimitesInteracParClient.mockRejectedValueOnce(new Error("db fail"));
    const req = adminReq({});
    const res = mockRes();
    await ctrl.adminSetLimitesClient(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("convertit null en null et nombre en Number pour chaque limite", async () => {
    // limite_24h: null  → inner ternary null branch (ligne 795)
    // limite_7j: null   → idem (ligne 796)
    // limite_30j: 5000  → inner ternary Number branch (ligne 797)
    // log: 24h=global, 7j=global, 30j=5000 couvre les deux côtés du ?? (ligne 807)
    const limites = { limite_24h: null, limite_7j: null, limite_30j: 5000 };
    mockSetLimitesInteracParClient.mockResolvedValueOnce(true);
    mockGetLimitesInteracParClient.mockResolvedValueOnce(limites);
    const req = adminReq({ limite_24h: null, limite_7j: null, limite_30j: 5000 });
    const res = mockRes();
    await ctrl.adminSetLimitesClient(req, res);
    expect(mockSetLimitesInteracParClient).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ limite_24h: null, limite_7j: null, limite_30j: 5000 })
    );
    const auditArg = mockCreateAuditLog.mock.calls[0][0];
    expect(auditArg.details).toContain("24h=global");
    expect(auditArg.details).toContain("30j=5000");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: limites }));
  });
});
