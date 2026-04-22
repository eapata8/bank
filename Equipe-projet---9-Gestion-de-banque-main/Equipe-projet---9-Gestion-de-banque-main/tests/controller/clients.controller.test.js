import { jest } from "@jest/globals";

const mockFindClientsByUserId = jest.fn();
const mockFindAllClients = jest.fn();
const mockFindAccountsByUserIdAndClientId = jest.fn();
const mockFindAccountsByClientId = jest.fn();
const mockFindClientByEmailFictif = jest.fn();
const mockFindUserById = jest.fn();
const mockCreateClientRecord = jest.fn();
const mockLinkClientToUser = jest.fn().mockResolvedValue(undefined);
const mockUpdateAutoValidation = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
const mockCaptureSnapshot = jest.fn().mockResolvedValue(1);

// Mocks admin.clients.data.js
const mockFindClientById       = jest.fn();
const mockFindClientComptes    = jest.fn();
const mockFindClientVirements  = jest.fn();
const mockFindClientDepots     = jest.fn();
const mockFindClientRetraits   = jest.fn();
const mockFindClientFactures   = jest.fn();
const mockFindClientCartes     = jest.fn();

await jest.unstable_mockModule("../../server/data/clients.data.js", () => ({
  findClientsByUserId: mockFindClientsByUserId,
  findAllClients: mockFindAllClients,
  findAccountsByUserIdAndClientId: mockFindAccountsByUserIdAndClientId,
  findAccountsByClientId: mockFindAccountsByClientId,
  findClientByEmailFictif: mockFindClientByEmailFictif,
  findUserById: mockFindUserById,
  createClient: mockCreateClientRecord,
  linkClientToUser: mockLinkClientToUser,
}));
await jest.unstable_mockModule("../../server/data/admin.data.js", () => ({
  updateAutoValidation: mockUpdateAutoValidation,
}));
await jest.unstable_mockModule("../../server/data/admin.clients.data.js", () => ({
  findClientById:      mockFindClientById,
  findClientComptes:   mockFindClientComptes,
  findClientVirements: mockFindClientVirements,
  findClientDepots:    mockFindClientDepots,
  findClientRetraits:  mockFindClientRetraits,
  findClientFactures:  mockFindClientFactures,
  findClientCartes:    mockFindClientCartes,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));
await jest.unstable_mockModule("../../server/data/simulation.data.js", () => ({
  captureSnapshot: mockCaptureSnapshot,
}));

const clients = await import("../../server/controllers/clients.controller.js");

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
  mockLinkClientToUser.mockResolvedValue(undefined);
  mockUpdateAutoValidation.mockResolvedValue(undefined);
  mockCaptureSnapshot.mockResolvedValue(1);
});

describe("Clients Controller", () => {
  describe("getMyClients", () => {
    it("retourne les clients de l'utilisateur connecte", async () => {
      const rows = [{ id: 1, prenom: "Client", nom: "Un" }];
      mockFindClientsByUserId.mockResolvedValueOnce(rows);
      const req = mockReq();
      const res = mockRes();
      await clients.getMyClients(req, res);
      expect(mockFindClientsByUserId).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("retourne tous les clients pour un moderateur", async () => {
      const rows = [{ id: 1, prenom: "Client", nom: "Global" }];
      mockFindAllClients.mockResolvedValueOnce(rows);
      const req = mockReq({ session: { user: { id: 2, role: "MODERATEUR" } } });
      const res = mockRes();
      await clients.getMyClients(req, res);
      expect(mockFindAllClients).toHaveBeenCalledWith("");
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("passe le terme de recherche a findAllClients pour un moderateur", async () => {
      mockFindAllClients.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "MODERATEUR" } },
        query: { search: "Emma" },
      });
      const res = mockRes();
      await clients.getMyClients(req, res);
      expect(mockFindAllClients).toHaveBeenCalledWith("Emma");
    });

    it("cree un audit log pour un admin", async () => {
      mockFindAllClients.mockResolvedValueOnce([]);
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, query: {} });
      const res = mockRes();
      await clients.getMyClients(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "VIEW_GLOBAL_CLIENTS" })
      );
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindClientsByUserId.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq();
      const res = mockRes();
      await clients.getMyClients(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Erreur serveur" }));
    });
  });

  describe("getClientAccounts", () => {
    it("retourne 400 si clientId invalide (NaN)", async () => {
      const req = mockReq({ params: { clientId: "abc" } });
      const res = mockRes();
      await clients.getClientAccounts(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "clientId invalide" });
      expect(mockFindAccountsByUserIdAndClientId).not.toHaveBeenCalled();
      expect(mockFindAccountsByClientId).not.toHaveBeenCalled();
    });

    it("retourne 400 si clientId est 0", async () => {
      const req = mockReq({ params: { clientId: "0" } });
      const res = mockRes();
      await clients.getClientAccounts(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne les comptes du client pour un utilisateur standard", async () => {
      const rows = [{ id: 10, type_compte: "CHEQUES" }];
      mockFindAccountsByUserIdAndClientId.mockResolvedValueOnce(rows);
      const req = mockReq({ params: { clientId: "1" } });
      const res = mockRes();
      await clients.getClientAccounts(req, res);
      expect(mockFindAccountsByUserIdAndClientId).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("retourne tous les comptes du client pour un moderateur", async () => {
      const rows = [{ id: 10, type_compte: "CHEQUES" }];
      mockFindAccountsByClientId.mockResolvedValueOnce(rows);
      const req = mockReq({
        session: { user: { id: 2, role: "MODERATEUR" } },
        params: { clientId: "1" },
      });
      const res = mockRes();
      await clients.getClientAccounts(req, res);
      expect(mockFindAccountsByClientId).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAccountsByUserIdAndClientId.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { clientId: "5" } });
      const res = mockRes();
      await clients.getClientAccounts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createClient", () => {
    it("retourne 400 si des champs sont manquants", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Alice" },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
      expect(mockCreateClientRecord).not.toHaveBeenCalled();
    });

    it("retourne 409 si l'email fictif est deja utilise", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce({ id: 5 });
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Alice", nom: "Martin", email_fictif: "alice@test.com" },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(mockCreateClientRecord).not.toHaveBeenCalled();
    });

    it("retourne 404 si utilisateur_id fourni mais introuvable", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockFindUserById.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Alice", nom: "Martin", email_fictif: "alice@test.com", utilisateur_id: 99 },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Utilisateur introuvable" });
    });

    it("cree un client sans liaison utilisateur", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockCreateClientRecord.mockResolvedValueOnce(12);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Alice", nom: "Martin", email_fictif: "alice@test.com", ville: "Montreal" },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(mockCreateClientRecord).toHaveBeenCalledWith(
        expect.objectContaining({ prenom: "Alice", nom: "Martin", emailFictif: "alice@test.com", ville: "Montreal" })
      );
      expect(mockLinkClientToUser).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
    });

    it("cree un client et le lie a un utilisateur existant", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockFindUserById.mockResolvedValueOnce({ id: 3 });
      mockCreateClientRecord.mockResolvedValueOnce(13);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Bob", nom: "Roy", email_fictif: "bob@test.com", utilisateur_id: 3 },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(mockLinkClientToUser).toHaveBeenCalledWith(13, 3);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_CLIENT" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("cree un client pour un moderateur", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockCreateClientRecord.mockResolvedValueOnce(14);
      const req = mockReq({
        session: { user: { id: 2, role: "MODERATEUR" } },
        body: { prenom: "Lina", nom: "Nguyen", email_fictif: "lina@test.com" },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 14 }));
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindClientByEmailFictif.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Alice", nom: "Martin", email_fictif: "alice@test.com" },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("appelle updateAutoValidation si auto_validation est fourni avec utilisateur_id", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockFindUserById.mockResolvedValueOnce({ id: 5 });
      mockCreateClientRecord.mockResolvedValueOnce(20);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Marc", nom: "Roy", email_fictif: "marc@test.com", utilisateur_id: 5, auto_validation: true },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(mockUpdateAutoValidation).toHaveBeenCalledWith(5, true);
    });

    it("n'appelle pas updateAutoValidation si auto_validation est absent", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockFindUserById.mockResolvedValueOnce({ id: 5 });
      mockCreateClientRecord.mockResolvedValueOnce(21);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Lina", nom: "Nguyen", email_fictif: "lina@test.com", utilisateur_id: 5 },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(mockUpdateAutoValidation).not.toHaveBeenCalled();
    });

    it("trim les champs prenom, nom et email_fictif", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockCreateClientRecord.mockResolvedValueOnce(22);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "  Alice  ", nom: "  Martin  ", email_fictif: "  alice@test.com  " },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(mockCreateClientRecord).toHaveBeenCalledWith(
        expect.objectContaining({ prenom: "Alice", nom: "Martin", emailFictif: "alice@test.com" })
      );
    });

    it("inclut les details corrects dans l'audit log", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockCreateClientRecord.mockResolvedValueOnce(23);
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Alice", nom: "Martin", email_fictif: "alice@test.com" },
      });
      const res = mockRes();
      await clients.createClient(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE_CLIENT",
          details: expect.stringContaining("Alice Martin"),
        })
      );
    });

    it("loggue et trace l'échec du snapshot initial sans bloquer la création", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockCreateClientRecord.mockResolvedValueOnce(24);
      mockCaptureSnapshot.mockRejectedValueOnce(new Error("snapshot DB down"));
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Cara", nom: "Diaz", email_fictif: "cara@test.com" },
      });
      const res = mockRes();

      await clients.createClient(req, res);

      // La création reste un succès malgré l'échec du snapshot
      expect(res.status).toHaveBeenCalledWith(201);
      // L'erreur a été loggée en console pour diagnostic
      expect(errSpy).toHaveBeenCalled();
      // Un audit log d'échec a été créé en plus du CREATE_CLIENT
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "SNAPSHOT_INITIAL_ECHEC" })
      );
      errSpy.mockRestore();
    });

    it("ne bloque pas la création si l'audit log SNAPSHOT_INITIAL_ECHEC échoue lui-même", async () => {
      mockFindClientByEmailFictif.mockResolvedValueOnce(null);
      mockCreateClientRecord.mockResolvedValueOnce(25);
      mockCaptureSnapshot.mockRejectedValueOnce(new Error("snapshot DB down"));
      // 1er appel = CREATE_CLIENT (réussi), 2e appel = SNAPSHOT_INITIAL_ECHEC (échoue)
      mockCreateAuditLog
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("audit DB down"));
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: { prenom: "Dan", nom: "Eve", email_fictif: "dan@test.com" },
      });
      const res = mockRes();

      await clients.createClient(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      errSpy.mockRestore();
    });
  });

  describe("getClientOperations", () => {
    const opsData = {
      client:    { id: 1, prenom: "Alice", nom: "Martin" },
      comptes:   [{ id: 10, type_compte: "CHEQUES" }],
      virements: [],
      depots:    [],
      retraits:  [],
      factures:  [{ id: 5, fournisseur: "Hydro-Quebec" }],
      cartes:    [{ id: 3, type_carte: "VISA" }],
    };

    function setupOps() {
      mockFindClientById.mockResolvedValueOnce(opsData.client);
      mockFindClientComptes.mockResolvedValueOnce(opsData.comptes);
      mockFindClientVirements.mockResolvedValueOnce(opsData.virements);
      mockFindClientDepots.mockResolvedValueOnce(opsData.depots);
      mockFindClientRetraits.mockResolvedValueOnce(opsData.retraits);
      mockFindClientFactures.mockResolvedValueOnce(opsData.factures);
      mockFindClientCartes.mockResolvedValueOnce(opsData.cartes);
    }

    it("retourne 403 pour un UTILISATEUR", async () => {
      const req = mockReq({ session: { user: { id: 1, role: "UTILISATEUR" } }, params: { clientId: "1" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockFindClientById).not.toHaveBeenCalled();
    });

    it("retourne 400 si clientId est invalide", async () => {
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { clientId: "abc" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "clientId invalide" });
    });

    it("retourne 400 si clientId est 0", async () => {
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { clientId: "0" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 404 si le client est introuvable", async () => {
      mockFindClientById.mockResolvedValueOnce(null);
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { clientId: "99" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Client introuvable" });
    });

    it("retourne toutes les operations du client pour un ADMIN", async () => {
      setupOps();
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { clientId: "1" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.json).toHaveBeenCalledWith({
        client: opsData.client,
        comptes: opsData.comptes,
        virements: opsData.virements,
        depots: opsData.depots,
        retraits: opsData.retraits,
        factures: opsData.factures,
        cartes: opsData.cartes,
      });
    });

    it("retourne toutes les operations du client pour un MODERATEUR", async () => {
      setupOps();
      const req = mockReq({ session: { user: { id: 2, role: "MODERATEUR" } }, params: { clientId: "1" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ client: opsData.client }));
      expect(mockFindClientById).toHaveBeenCalledWith(1);
    });

    it("appelle toutes les fonctions data en parallele", async () => {
      setupOps();
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { clientId: "1" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(mockFindClientComptes).toHaveBeenCalledWith(1);
      expect(mockFindClientVirements).toHaveBeenCalledWith(1);
      expect(mockFindClientDepots).toHaveBeenCalledWith(1);
      expect(mockFindClientRetraits).toHaveBeenCalledWith(1);
      expect(mockFindClientFactures).toHaveBeenCalledWith(1);
      expect(mockFindClientCartes).toHaveBeenCalledWith(1);
    });

    it("retourne 500 en cas d'erreur", async () => {
      mockFindClientById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ session: { user: { id: 1, role: "ADMIN" } }, params: { clientId: "1" } });
      const res = mockRes();
      await clients.getClientOperations(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
