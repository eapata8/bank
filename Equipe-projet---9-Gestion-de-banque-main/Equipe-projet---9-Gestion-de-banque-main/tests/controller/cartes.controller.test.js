import { jest } from "@jest/globals";

const mockFindCartes = jest.fn();
const mockFindCarteById = jest.fn();
const mockFindAuthorizedCarteById = jest.fn();
const mockCreateCarte = jest.fn();
const mockUpdateCarteStatut = jest.fn().mockResolvedValue(undefined);
const mockUpdateCarteLimite = jest.fn().mockResolvedValue(undefined);
const mockFindSourceAccountForRemboursement = jest.fn();
const mockDecrementAccountBalance = jest.fn().mockResolvedValue(undefined);
const mockDecrementSoldeUtilise = jest.fn().mockResolvedValue(undefined);
const mockUpdateSoldeUtilise = jest.fn().mockResolvedValue(undefined);
const mockCreateRemboursementTransaction = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/cartes.data.js", () => ({
  findCartes: mockFindCartes,
  findCarteById: mockFindCarteById,
  findAuthorizedCarteById: mockFindAuthorizedCarteById,
  createCarte: mockCreateCarte,
  updateCarteStatut: mockUpdateCarteStatut,
  updateCarteLimite: mockUpdateCarteLimite,
  findSourceAccountForRemboursement: mockFindSourceAccountForRemboursement,
  decrementAccountBalance: mockDecrementAccountBalance,
  decrementSoldeUtilise: mockDecrementSoldeUtilise,
  updateSoldeUtilise: mockUpdateSoldeUtilise,
  createRemboursementTransaction: mockCreateRemboursementTransaction,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const cartes = await import("../../server/controllers/cartes.controller.js");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  return {
    session: { user: { id: 1, role: "UTILISATEUR" } },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockUpdateCarteStatut.mockResolvedValue(undefined);
  mockUpdateCarteLimite.mockResolvedValue(undefined);
  mockDecrementAccountBalance.mockResolvedValue(undefined);
  mockDecrementSoldeUtilise.mockResolvedValue(undefined);
  mockCreateRemboursementTransaction.mockResolvedValue(undefined);
});

describe("Cartes Controller", () => {
  describe("getCartes", () => {
    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindCartes.mockRejectedValueOnce(new Error("DB down"));
      const req = mockReq();
      const res = mockRes();
      await cartes.getCartes(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("retourne les cartes autorisees pour un utilisateur", async () => {
      const rows = [{ id: 1, type_carte: "VISA", statut: "ACTIVE" }];
      mockFindCartes.mockResolvedValueOnce(rows);
      const req = mockReq();
      const res = mockRes();
      await cartes.getCartes(req, res);
      expect(mockFindCartes).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, canReadAll: false })
      );
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("passe le terme de recherche pour un admin et cree un audit log", async () => {
      mockFindCartes.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: { search: "VISA" },
      });
      const res = mockRes();
      await cartes.getCartes(req, res);
      expect(mockFindCartes).toHaveBeenCalledWith(
        expect.objectContaining({ canReadAll: true, search: "VISA" })
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "VIEW_GLOBAL_CARTES" })
      );
    });

    it("crée un audit log 'Consultation globale' pour un admin sans terme de recherche", async () => {
      mockFindCartes.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: {},
      });
      const res = mockRes();
      await cartes.getCartes(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "VIEW_GLOBAL_CARTES",
          details: "Consultation globale des cartes",
        })
      );
    });
  });

  describe("getCarteById", () => {
    it("retourne 400 si id invalide", async () => {
      const req = mockReq({ params: { id: "0" }, session: { user: { id: 1, role: "ADMIN" } } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
    });

    it("retourne 400 si id est negatif", async () => {
      const req = mockReq({ params: { id: "-1" }, session: { user: { id: 1, role: "ADMIN" } } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne la carte pour un admin", async () => {
      const carte = { id: 1, type_carte: "VISA", statut: "ACTIVE" };
      mockFindCarteById.mockResolvedValueOnce(carte);
      const req = mockReq({ params: { id: "1" }, session: { user: { id: 2, role: "ADMIN" } } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(mockFindCarteById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ data: carte });
    });

    it("retourne la carte autorisee pour un utilisateur", async () => {
      const carte = { id: 1, type_carte: "VISA", statut: "ACTIVE" };
      mockFindAuthorizedCarteById.mockResolvedValueOnce(carte);
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(mockFindAuthorizedCarteById).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({ data: carte });
    });

    it("retourne 404 si la carte n'existe pas", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "99" } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte introuvable" });
    });

    it("retourne 403 si la carte existe mais n'appartient pas a l'utilisateur", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce({ id: 1, type_carte: "VISA" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Acces refuse" });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "1" }, session: { user: { id: 2, role: "ADMIN" } } });
      const res = mockRes();
      await cartes.getCarteById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createCarteItem", () => {
    it("bloque la creation pour un moderateur", async () => {
      const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } }, body: { client_id: 1 } });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockCreateCarte).not.toHaveBeenCalled();
    });

    it("retourne 400 si des champs sont manquants", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "1234" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
    });

    it("retourne 400 si last_four invalide", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "abc", type_carte: "VISA", limite_credit: 5000, date_expiration: "2028-12-31" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "last_four doit contenir exactement 4 chiffres" });
    });

    it("retourne 400 si la limite est invalide", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "4242", type_carte: "VISA", limite_credit: -500, date_expiration: "2028-12-31" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La limite doit etre positive" });
    });

    it("retourne 400 si le type de carte est invalide", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "4242", type_carte: "AMEX", limite_credit: 5000, date_expiration: "2028-12-31" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Type de carte invalide" });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockCreateCarte.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "4242", type_carte: "VISA", limite_credit: 5000, date_expiration: "2028-12-31" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("cree une carte pour un admin avec un CVV a 3 chiffres", async () => {
      mockCreateCarte.mockResolvedValueOnce({ insertId: 7 });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "4242", type_carte: "VISA", limite_credit: 5000, date_expiration: "2028-12-31" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(mockCreateCarte).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 1,
          typeCarte: "VISA",
          limiteCredit: 5000,
          numeroCompte: expect.stringMatching(/4\d{3} \d{4} \d{4} 4242/),
          cvv: expect.stringMatching(/^\d{3}$/),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte creee", id: 7 });
    });

    it("genere un numero commencant par 5 pour une carte MASTERCARD", async () => {
      mockCreateCarte.mockResolvedValueOnce({ insertId: 8 });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, last_four: "9999", type_carte: "MASTERCARD", limite_credit: 3000, date_expiration: "2029-06-30" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(mockCreateCarte).toHaveBeenCalledWith(
        expect.objectContaining({
          typeCarte: "MASTERCARD",
          numeroCompte: expect.stringMatching(/5\d{3} \d{4} \d{4} 9999/),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("génère last_four aléatoirement si absent du body", async () => {
      mockCreateCarte.mockResolvedValueOnce({ insertId: 9 });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, type_carte: "VISA", limite_credit: 2000, date_expiration: "2030-01-31" },
      });
      const res = mockRes();
      await cartes.createCarteItem(req, res);
      expect(mockCreateCarte).toHaveBeenCalledWith(
        expect.objectContaining({
          typeCarte: "VISA",
          numeroCompte: expect.stringMatching(/4\d{3} \d{4} \d{4} \d{4}/),
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("bloquerCarte", () => {
    it("bloque la creation pour un utilisateur", async () => {
      const req = mockReq({ params: { id: "2" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 400 si l'id est invalide", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "0" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
    });

    it("retourne 400 si l'id est negatif", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "-3" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la carte n'existe pas", async () => {
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "99" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte introuvable" });
    });

    it("retourne 400 si la carte est deja bloquee", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 2, statut: "BLOQUEE", numero_compte: "**** 4242" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "2" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La carte est deja bloquee" });
    });

    it("bloque la carte et appelle updateCarteStatut", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 2, statut: "ACTIVE", numero_compte: "**** 4242" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "2" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(2, "BLOQUEE");
      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "BLOQUER_CARTE" }));
      expect(res.json).toHaveBeenCalledWith({ message: "Carte bloquee avec succes", id: 2 });
    });

    it("peut bloquer une carte gelee (passage du gel au blocage administratif)", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 2, statut: "GELEE", numero_compte: "**** 4242" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "2" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(2, "BLOQUEE");
      expect(res.json).toHaveBeenCalledWith({ message: "Carte bloquee avec succes", id: 2 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" } });
      const res = mockRes();
      await cartes.bloquerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("activerCarte", () => {
    it("retourne 403 pour un utilisateur", async () => {
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 400 si l'id est invalide", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "0" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 400 si l'id est negatif", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "-5" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la carte n'existe pas", async () => {
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "99" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne 400 si la carte est deja active", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", numero_compte: "**** 4242" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La carte est deja active" });
    });

    it("active une carte bloquee et appelle updateCarteStatut", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "BLOQUEE", numero_compte: "**** 4242" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(1, "ACTIVE");
      expect(res.json).toHaveBeenCalledWith({ message: "Carte activee avec succes", id: 1 });
    });

    it("peut activer une carte gelee", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "GELEE", numero_compte: "**** 4242" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(1, "ACTIVE");
      expect(res.json).toHaveBeenCalledWith({ message: "Carte activee avec succes", id: 1 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" } });
      const res = mockRes();
      await cartes.activerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("modifierLimiteCarte", () => {
    it("retourne 403 pour un moderateur", async () => {
      const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } }, params: { id: "3" }, body: { limite_credit: 5000 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("retourne 400 si l'id est invalide", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "0" }, body: { limite_credit: 5000 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 400 si la limite est invalide", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "3" }, body: { limite_credit: -100 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 400 si la limite est zero", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "3" }, body: { limite_credit: 0 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La limite doit etre positive" });
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la carte n'existe pas", async () => {
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "99" }, body: { limite_credit: 5000 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("modifie la limite et appelle updateCarteLimite", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 3, statut: "ACTIVE" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "3" }, body: { limite_credit: 8000 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(mockUpdateCarteLimite).toHaveBeenCalledWith(3, 8000);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "MODIFIER_LIMITE_CARTE" }));
      expect(res.json).toHaveBeenCalledWith({ message: "Limite modifiee avec succes", id: 3 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" }, body: { limite_credit: 5000 } });
      const res = mockRes();
      await cartes.modifierLimiteCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("gelerCarte", () => {
    it("retourne 400 si l'id est invalide", async () => {
      const req = mockReq({ params: { id: "0" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
    });

    it("retourne 400 si l'id est negatif", async () => {
      const req = mockReq({ params: { id: "-2" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindAuthorizedCarteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la carte n'existe pas (utilisateur)", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "99" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte introuvable" });
    });

    it("retourne 403 si la carte ne lui appartient pas", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Acces refuse" });
    });

    it("retourne 400 si la carte est deja gelee", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "GELEE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La carte est deja gelee" });
    });

    it("retourne 400 si la carte est bloquee administrativement", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "BLOQUEE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La carte est bloquee administrativement - contactez l'administrateur" });
    });

    it("retourne 400 si la carte est expiree", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "EXPIREE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Impossible de geler une carte expiree" });
    });

    it("gele la carte d'un utilisateur et cree un audit log GELER_CARTE", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(1, "GELEE");
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "GELER_CARTE", roleUtilisateur: "UTILISATEUR" })
      );
      expect(res.json).toHaveBeenCalledWith({ message: "Carte gelee avec succes", id: 1 });
    });

    it("permet a un admin de geler n'importe quelle carte via findCarteById", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 3, statut: "ACTIVE", numero_compte: "**** 9999" });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "3" },
      });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(mockFindCarteById).toHaveBeenCalledWith(3);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(3, "GELEE");
      expect(res.json).toHaveBeenCalledWith({ message: "Carte gelee avec succes", id: 3 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAuthorizedCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.gelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("degelerCarte", () => {
    it("retourne 400 si l'id est invalide", async () => {
      const req = mockReq({ params: { id: "0" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
    });

    it("retourne 400 si l'id est negatif", async () => {
      const req = mockReq({ params: { id: "-4" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindAuthorizedCarteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la carte n'existe pas", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "99" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte introuvable" });
    });

    it("retourne 403 si la carte ne lui appartient pas", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "BLOQUEE" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Acces refuse" });
    });

    it("retourne 400 si la carte est deja active", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La carte est deja active" });
    });

    it("retourne 400 si la carte est expiree", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "EXPIREE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Impossible de degeler une carte expiree" });
    });

    it("retourne 403 si l'utilisateur tente de degeler une carte bloquee par l'admin", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "BLOQUEE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } }); // UTILISATEUR
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Cette carte a ete bloquee par un administrateur. Contactez le support." });
      expect(mockUpdateCarteStatut).not.toHaveBeenCalled();
    });

    it("degele la carte d'un utilisateur et cree un audit log DEGELER_CARTE", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "GELEE", numero_compte: "**** 4242" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(1, "ACTIVE");
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DEGELER_CARTE", roleUtilisateur: "UTILISATEUR" })
      );
      expect(res.json).toHaveBeenCalledWith({ message: "Carte degelee avec succes", id: 1 });
    });

    it("permet a un admin de degeler n'importe quelle carte", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 3, statut: "BLOQUEE", numero_compte: "**** 9999" });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "3" },
      });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(mockFindCarteById).toHaveBeenCalledWith(3);
      expect(mockUpdateCarteStatut).toHaveBeenCalledWith(3, "ACTIVE");
      expect(res.json).toHaveBeenCalledWith({ message: "Carte degelee avec succes", id: 3 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAuthorizedCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await cartes.degelerCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("modifierSoldeCarte", () => {
    it("retourne 403 pour un moderateur", async () => {
      const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } }, params: { id: "3" }, body: { solde_utilise: 200 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 400 si l'id est invalide", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "0" }, body: { solde_utilise: 200 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 400 si le solde_utilise est negatif", async () => {
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "3" }, body: { solde_utilise: -100 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 404 si la carte n'existe pas", async () => {
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "99" }, body: { solde_utilise: 200 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte introuvable" });
    });

    it("retourne 400 si le solde_utilise dépasse la limite de crédit", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 3, statut: "ACTIVE", limite_credit: "1000" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "3" }, body: { solde_utilise: 2000 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le solde utilise ne peut pas depasser la limite de credit" });
    });

    it("modifie le solde utilisé et crée un audit log", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 3, statut: "ACTIVE", limite_credit: "5000" });
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "3" }, body: { solde_utilise: 750 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(mockUpdateSoldeUtilise).toHaveBeenCalledWith(3, 750);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "MODIFIER_SOLDE_CARTE" }));
      expect(res.json).toHaveBeenCalledWith({ message: "Solde utilise modifie avec succes", id: 3 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ session: { user: { id: 2, role: "ADMIN" } }, params: { id: "1" }, body: { solde_utilise: 100 } });
      const res = mockRes();
      await cartes.modifierSoldeCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("rembourserCarte", () => {
    it("refuse le remboursement pour un moderateur", async () => {
      const req = mockReq({ session: { user: { id: 3, role: "MODERATEUR" } }, params: { id: "1" }, body: { compte_id: 1, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockFindCarteById).not.toHaveBeenCalled();
    });

    it("retourne 400 si les champs obligatoires sont manquants", async () => {
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 0, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Carte, compte ou montant invalide" });
    });

    it("retourne 400 si le montant est negatif", async () => {
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: -50 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le montant doit etre positif" });
    });

    it("retourne 404 si la carte est introuvable", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "99" }, body: { compte_id: 2, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne 403 si la carte existe mais n'appartient pas a l'utilisateur", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce(null);
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE" });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("retourne 400 si la carte est bloquee", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "BLOQUEE", solde_utilise: 500 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Impossible de rembourser une carte bloquee ou gelee" });
    });

    it("retourne 400 si la carte est gelee", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "GELEE", solde_utilise: 500 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Impossible de rembourser une carte bloquee ou gelee" });
    });

    it("retourne 400 si le solde utilise est zero", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", solde_utilise: 0 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le solde de la carte est deja a zero" });
    });

    it("retourne 400 si le montant depasse le solde utilise", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", solde_utilise: 100 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 500 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("retourne 403 si le compte n'est pas autorise", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", solde_utilise: 500 });
      mockFindSourceAccountForRemboursement.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 99, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte non autorise pour ce remboursement" });
    });

    it("retourne 400 si le solde du compte est insuffisant", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", solde_utilise: 500 });
      mockFindSourceAccountForRemboursement.mockResolvedValueOnce({ id: 2, solde: 50 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 200 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
    });

    it("effectue le remboursement et appelle toutes les fonctions du repository", async () => {
      mockFindAuthorizedCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", solde_utilise: 500, numero_compte: "**** 4242" });
      mockFindSourceAccountForRemboursement.mockResolvedValueOnce({ id: 2, solde: 1000 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 200 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(mockDecrementAccountBalance).toHaveBeenCalledWith(2, 200);
      expect(mockDecrementSoldeUtilise).toHaveBeenCalledWith(1, 200);
      expect(mockCreateRemboursementTransaction).toHaveBeenCalledWith({ compteId: 2, carteId: 1, montant: 200 });
      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "REMBOURSER_CARTE" }));
      expect(res.json).toHaveBeenCalledWith({ message: "Remboursement effectue avec succes", id: 1 });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAuthorizedCarteById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 2, montant: 100 } });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("effectue le remboursement via findCarteById pour un admin (branche canAll)", async () => {
      mockFindCarteById.mockResolvedValueOnce({ id: 1, statut: "ACTIVE", solde_utilise: 300, numero_compte: "**** 9999" });
      mockFindSourceAccountForRemboursement.mockResolvedValueOnce({ id: 3, solde: 800 });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        params: { id: "1" },
        body: { compte_id: 3, montant: 150 },
      });
      const res = mockRes();
      await cartes.rembourserCarte(req, res);
      expect(mockFindCarteById).toHaveBeenCalledWith(1);
      expect(mockFindAuthorizedCarteById).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: "Remboursement effectue avec succes", id: 1 });
    });
  });
});
