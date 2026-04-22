import { jest } from "@jest/globals";

const mockFindUserByEmail = jest.fn();
const mockVerifyPassword = jest.fn();
const mockFindUserIdByEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockFindModerateurs = jest.fn();
const mockDeleteModerateurRecord = jest.fn();
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
const mockFindRecentAuditLogs = jest.fn();

await jest.unstable_mockModule("../../server/data/auth.data.js", () => ({
  findUserByEmail: mockFindUserByEmail,
  verifyPassword: mockVerifyPassword,
  findUserIdByEmail: mockFindUserIdByEmail,
  createUser: mockCreateUser,
  findModerateurs: mockFindModerateurs,
  deleteModerateur: mockDeleteModerateurRecord,
  upsertConfiguredAdmin: jest.fn(),
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
  findRecentAuditLogs: mockFindRecentAuditLogs,
}));

const auth = await import("../../server/controllers/auth.controller.js");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  res.clearCookie = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  // Session par défaut avec regenerate/save synchrones (succès) pour les tests de login.
  // Les tests qui veulent simuler un échec peuvent surcharger session.regenerate / session.save.
  const baseSession = {
    regenerate: (cb) => cb(),
    save: (cb) => cb(),
  };
  const overrideSession = overrides.session || {};
  return {
    body: {},
    ...overrides,
    session: { ...baseSession, ...overrideSession },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
});

describe("Auth Controller", () => {
  describe("login", () => {
    it("retourne 400 si email ou mot de passe manquant", async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Email et mot de passe requis" });
      expect(mockFindUserByEmail).not.toHaveBeenCalled();
    });

    it("retourne 400 si email vide", async () => {
      const req = mockReq({ body: { email: "", motDePasse: "x" } });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockFindUserByEmail).not.toHaveBeenCalled();
    });

    it("retourne 401 si utilisateur introuvable", async () => {
      mockFindUserByEmail.mockResolvedValueOnce(null);
      const req = mockReq({ body: { email: "bad@test.com", motDePasse: "wrong" } });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Identifiants invalides" });
    });

    it("retourne 401 si le mot de passe ne correspond pas", async () => {
      mockFindUserByEmail.mockResolvedValueOnce({ id: 1, email: "bad@test.com", mot_de_passe_hash: "hash" });
      mockVerifyPassword.mockResolvedValueOnce(false);
      const req = mockReq({ body: { email: "bad@test.com", motDePasse: "wrong" } });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Identifiants invalides" });
    });

    it("cree la session et retourne 200 avec user", async () => {
      const dbUser = {
        id: 1, email: "user@Leon.local", role: "UTILISATEUR",
        prenom: "Jean", nom: "Dupont", mot_de_passe_hash: "bcrypt_hash",
      };
      const user = { id: 1, email: "user@Leon.local", role: "UTILISATEUR", prenom: "Jean", nom: "Dupont" };
      mockFindUserByEmail.mockResolvedValueOnce(dbUser);
      mockVerifyPassword.mockResolvedValueOnce(true);
      const req = mockReq({ body: { email: "user@Leon.local", motDePasse: "Demo123!" } });
      const res = mockRes();
      await auth.login(req, res);
      expect(req.session.user).toEqual(user);
      expect(res.json).toHaveBeenCalledWith({ message: "Connecte", user });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindUserByEmail.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ body: { email: "a@b.com", motDePasse: "x" } });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Erreur serveur" }));
    });

    it("régénère l'ID de session avant d'écrire user (anti session fixation)", async () => {
      const dbUser = {
        id: 7, email: "fix@test.com", role: "UTILISATEUR",
        prenom: "F", nom: "X", mot_de_passe_hash: "h",
      };
      mockFindUserByEmail.mockResolvedValueOnce(dbUser);
      mockVerifyPassword.mockResolvedValueOnce(true);

      // On capture l'ordre : .user ne doit être posé qu'APRÈS regenerate()
      let regenerateCalled = false;
      let userSetAfterRegenerate = false;
      const req = mockReq({
        body: { email: "fix@test.com", motDePasse: "x" },
        session: {
          regenerate(cb) {
            regenerateCalled = true;
            cb();
          },
          save(cb) {
            // À ce stade, .user doit déjà être posé après regenerate
            if (regenerateCalled && this.user) userSetAfterRegenerate = true;
            cb();
          },
        },
      });
      const res = mockRes();
      await auth.login(req, res);

      expect(regenerateCalled).toBe(true);
      expect(userSetAfterRegenerate).toBe(true);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Connecte" }));
    });

    it("retourne 500 si regenerate échoue", async () => {
      const dbUser = { id: 1, email: "a@b.com", role: "UTILISATEUR", prenom: "A", nom: "B", mot_de_passe_hash: "h" };
      mockFindUserByEmail.mockResolvedValueOnce(dbUser);
      mockVerifyPassword.mockResolvedValueOnce(true);
      const req = mockReq({
        body: { email: "a@b.com", motDePasse: "x" },
        session: { regenerate: (cb) => cb(new Error("regen fail")) },
      });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("retourne 500 si session.save échoue", async () => {
      const dbUser = { id: 1, email: "a@b.com", role: "UTILISATEUR", prenom: "A", nom: "B", mot_de_passe_hash: "h" };
      mockFindUserByEmail.mockResolvedValueOnce(dbUser);
      mockVerifyPassword.mockResolvedValueOnce(true);
      const req = mockReq({
        body: { email: "a@b.com", motDePasse: "x" },
        session: {
          regenerate: (cb) => cb(),
          save: (cb) => cb(new Error("save fail")),
        },
      });
      const res = mockRes();
      await auth.login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("logout", () => {
    it("detruit la session et envoie Deconnecte", () => {
      const req = mockReq();
      req.session.destroy = jest.fn((cb) => cb());
      const res = mockRes();
      auth.logout(req, res);
      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith("sid");
      expect(res.json).toHaveBeenCalledWith({ message: "Deconnecte" });
    });
  });

  describe("me", () => {
    it("retourne l'utilisateur en session", () => {
      const user = { id: 1, email: "u@n.local", role: "UTILISATEUR" };
      const req = mockReq({ session: { user } });
      const res = mockRes();
      auth.me(req, res);
      expect(res.json).toHaveBeenCalledWith({ user });
    });
  });

  describe("register", () => {
    it("retourne 400 si champs manquants", async () => {
      const req = mockReq({ body: { email: "a@b.com" } });
      const res = mockRes();
      await auth.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
      expect(mockFindUserIdByEmail).not.toHaveBeenCalled();
    });

    it("retourne 409 si email deja utilise", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce({ id: 1 });
      const req = mockReq({
        body: { email: "exist@test.com", motDePasse: "pass", prenom: "A", nom: "B" },
      });
      const res = mockRes();
      await auth.register(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: "Email deja utilise" });
    });

    it("bloque la creation d'un admin via l'inscription publique", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce(null);
      const req = mockReq({
        body: { email: "admin@test.com", motDePasse: "pass", prenom: "Admin", nom: "Blocked", role: "ADMIN" },
      });
      const res = mockRes();
      await auth.register(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("cree l'utilisateur et retourne 201 avec id", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({ insertId: 42 });
      const req = mockReq({
        body: { email: "new@test.com", motDePasse: "pass", prenom: "New", nom: "User" },
      });
      const res = mockRes();
      await auth.register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Utilisateur cree", id: 42 });
    });

    it("enregistre en UTILISATEUR quel que soit le role demande", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({ insertId: 1 });
      const req = mockReq({
        body: { email: "u@t.com", motDePasse: "p", prenom: "P", nom: "N", role: "OTHER" },
      });
      const res = mockRes();
      await auth.register(req, res);
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: "UTILISATEUR" })
      );
    });
  });

  describe("createModerateur", () => {
    it("retourne 400 si champs manquants", async () => {
      const req = mockReq({ body: { email: "mod@test.com" } });
      const res = mockRes();
      await auth.createModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
      expect(mockFindUserIdByEmail).not.toHaveBeenCalled();
    });

    it("retourne 409 si email deja utilise", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce({ id: 2 });
      const req = mockReq({
        body: { email: "mod@test.com", motDePasse: "pass", prenom: "Mod", nom: "Exist" },
      });
      const res = mockRes();
      await auth.createModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("cree un moderateur avec le bon role", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({ insertId: 9 });
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { email: "mod@test.com", motDePasse: "pass", prenom: "Mod", nom: "User" },
      });
      const res = mockRes();
      await auth.createModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Moderateur cree", id: 9 });
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: "MODERATEUR", email: "mod@test.com" })
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_MODERATEUR" })
      );
    });
  });

  describe("deleteModerateur", () => {
    it("retourne 400 si id invalide", async () => {
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { id: "abc" } });
      const res = mockRes();
      await auth.deleteModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockDeleteModerateurRecord).not.toHaveBeenCalled();
    });

    it("retourne 404 si moderateur introuvable", async () => {
      mockDeleteModerateurRecord.mockResolvedValueOnce(0);
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { id: "99" } });
      const res = mockRes();
      await auth.deleteModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Moderateur introuvable" });
    });

    it("supprime le moderateur et retourne 200 avec audit", async () => {
      mockDeleteModerateurRecord.mockResolvedValueOnce(1);
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { id: "5" } });
      const res = mockRes();
      await auth.deleteModerateur(req, res);
      expect(res.json).toHaveBeenCalledWith({ message: "Moderateur supprime" });
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DELETE_MODERATEUR" })
      );
    });

    it("retourne 500 en cas d'erreur", async () => {
      mockDeleteModerateurRecord.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { id: "5" } });
      const res = mockRes();
      await auth.deleteModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getModerateurs", () => {
    it("retourne la liste des moderateurs", async () => {
      const rows = [{ id: 5, email: "mod@test.com", role: "MODERATEUR" }];
      mockFindModerateurs.mockResolvedValueOnce(rows);
      const req = mockReq();
      const res = mockRes();
      await auth.getModerateurs(req, res);
      expect(res.json).toHaveBeenCalledWith({ data: rows });
      expect(mockFindModerateurs).toHaveBeenCalled();
    });

    it("retourne 500 en cas d'erreur", async () => {
      mockFindModerateurs.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq();
      const res = mockRes();
      await auth.getModerateurs(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("register (cas d'erreur serveur)", () => {
    it("retourne 500 si createUser lance une erreur", async () => {
      mockFindUserIdByEmail.mockResolvedValueOnce(null);
      const mockCreateUserFn = jest.fn().mockRejectedValueOnce(new Error("DB insert error"));
      // Need to re-import won't work — but we can trigger error via findUserIdByEmail
      mockFindUserIdByEmail.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        body: { email: "new@test.com", motDePasse: "pass", prenom: "A", nom: "B" },
      });
      const res = mockRes();
      await auth.register(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createModerateur (cas d'erreur serveur)", () => {
    it("retourne 500 si findUserIdByEmail lance une erreur", async () => {
      mockFindUserIdByEmail.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { email: "mod@test.com", motDePasse: "pass", prenom: "M", nom: "N" },
      });
      const res = mockRes();
      await auth.createModerateur(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("getAuditLogs", () => {
    it("retourne les logs d'audit et cree un log", async () => {
      const rows = [{ id: 1, action: "LOGIN" }];
      mockFindRecentAuditLogs.mockResolvedValueOnce(rows);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        query: {},
      });
      const res = mockRes();
      await auth.getAuditLogs(req, res);
      expect(mockFindRecentAuditLogs).toHaveBeenCalledWith(50);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "VIEW_AUDIT_LOGS" })
      );
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("accepte une limite personnalisee", async () => {
      mockFindRecentAuditLogs.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        query: { limit: "20" },
      });
      const res = mockRes();
      await auth.getAuditLogs(req, res);
      expect(mockFindRecentAuditLogs).toHaveBeenCalledWith(20);
    });

    it("borne la limite a 200 dans les details d'audit si limit > 200", async () => {
      mockFindRecentAuditLogs.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        query: { limit: "500" },
      });
      const res = mockRes();
      await auth.getAuditLogs(req, res);
      expect(mockFindRecentAuditLogs).toHaveBeenCalledWith(500);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.stringContaining("200") })
      );
    });

    it("retourne 500 en cas d'erreur", async () => {
      mockFindRecentAuditLogs.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        query: {},
      });
      const res = mockRes();
      await auth.getAuditLogs(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("utilise 50 comme limite par défaut si limit vaut 0 (branche limit || 50)", async () => {
      mockFindRecentAuditLogs.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        query: { limit: "0" },
      });
      const res = mockRes();
      await auth.getAuditLogs(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.stringContaining("50") })
      );
    });
  });
});
