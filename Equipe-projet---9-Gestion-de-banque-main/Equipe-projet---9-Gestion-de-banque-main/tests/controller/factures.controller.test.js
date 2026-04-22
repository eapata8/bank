import { jest } from "@jest/globals";

const mockFindFactures = jest.fn();
const mockFindFactureById = jest.fn();
const mockFindAuthorizedFactureById = jest.fn();
const mockFindAccountForFacturePayment = jest.fn();
const mockCreateFacture = jest.fn();
const mockFindClientIdForUser = jest.fn();
const mockExecutePayementFactureAtomique = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/factures.data.js", () => ({
  findFactures: mockFindFactures,
  findFactureById: mockFindFactureById,
  findAuthorizedFactureById: mockFindAuthorizedFactureById,
  findAccountForFacturePayment: mockFindAccountForFacturePayment,
  findClientIdForUser: mockFindClientIdForUser,
  createFacture: mockCreateFacture,
  executePayementFactureAtomique: mockExecutePayementFactureAtomique,
}));
await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const factures = await import("../../server/controllers/factures.controller.js");

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
  mockExecutePayementFactureAtomique.mockResolvedValue(undefined);
});

describe("Factures Controller", () => {
  describe("getFactures", () => {
    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindFactures.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq();
      const res = mockRes();
      await factures.getFactures(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("retourne les factures de l'utilisateur", async () => {
      const rows = [{ id: 4, fournisseur: "Hydro", statut: "IMPAYEE" }];
      mockFindFactures.mockResolvedValueOnce(rows);
      const req = mockReq();
      const res = mockRes();
      await factures.getFactures(req, res);
      expect(mockFindFactures).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, canReadAll: false })
      );
      expect(res.json).toHaveBeenCalledWith({ data: rows });
    });

    it("passe le terme de recherche pour un admin", async () => {
      mockFindFactures.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: { search: "Hydro" },
      });
      const res = mockRes();
      await factures.getFactures(req, res);
      expect(mockFindFactures).toHaveBeenCalledWith(
        expect.objectContaining({ canReadAll: true, search: "Hydro" })
      );
    });

    it("crée un audit log 'Consultation globale' pour un admin sans terme de recherche", async () => {
      mockFindFactures.mockResolvedValueOnce([]);
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        query: {},
      });
      const res = mockRes();
      await factures.getFactures(req, res);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "VIEW_GLOBAL_FACTURES",
          details: "Consultation globale des factures",
        })
      );
    });
  });

  describe("getFactureById", () => {
    it("retourne 400 si id invalide", async () => {
      const req = mockReq({ params: { id: "0" }, session: { user: { id: 1, role: "ADMIN" } } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
    });

    it("retourne 400 si id est negatif", async () => {
      const req = mockReq({ params: { id: "-1" }, session: { user: { id: 1, role: "ADMIN" } } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "id invalide" });
      expect(mockFindFactureById).not.toHaveBeenCalled();
    });

    it("retourne la facture pour un admin", async () => {
      const facture = { id: 1, fournisseur: "Bell", statut: "IMPAYEE" };
      mockFindFactureById.mockResolvedValueOnce(facture);
      const req = mockReq({ params: { id: "1" }, session: { user: { id: 2, role: "ADMIN" } } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(mockFindFactureById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ data: facture });
    });

    it("retourne la facture autorisee pour un utilisateur", async () => {
      const facture = { id: 2, fournisseur: "Hydro", statut: "PAYEE" };
      mockFindAuthorizedFactureById.mockResolvedValueOnce(facture);
      const req = mockReq({ params: { id: "2" } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(mockFindAuthorizedFactureById).toHaveBeenCalledWith(1, 2);
      expect(res.json).toHaveBeenCalledWith({ data: facture });
    });

    it("retourne 404 si la facture n'existe pas", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce(null);
      mockFindFactureById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "99" } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Facture introuvable" });
    });

    it("retourne 403 si la facture existe mais n'est pas autorisee", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce(null);
      mockFindFactureById.mockResolvedValueOnce({ id: 1, fournisseur: "Bell" });
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Acces refuse" });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindFactureById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "1" }, session: { user: { id: 2, role: "ADMIN" } } });
      const res = mockRes();
      await factures.getFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createFactureItem", () => {
    it("bloque la creation pour un moderateur", async () => {
      const req = mockReq({
        session: { user: { id: 3, role: "MODERATEUR" } },
        body: { client_id: 1 },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockCreateFacture).not.toHaveBeenCalled();
    });

    it("retourne 400 si des champs sont manquants", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: { client_id: 1, fournisseur: "Bell" },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
    });

    it("retourne 400 si le montant est invalide", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: {
          client_id: 1, fournisseur: "Bell", reference_facture: "FAC-001",
          montant: -50, date_emission: "2026-03-01", date_echeance: "2026-03-20",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le montant doit etre positif" });
    });

    it("retourne 400 si le montant est zero", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: {
          client_id: 1, fournisseur: "Bell", reference_facture: "FAC-001",
          montant: 0, date_emission: "2026-03-01", date_echeance: "2026-03-20",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Le montant doit etre positif" });
    });

    it("retourne 400 si le statut est invalide", async () => {
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: {
          client_id: 1, fournisseur: "Bell", reference_facture: "FAC-001",
          montant: 100, date_emission: "2026-03-01", date_echeance: "2026-03-20",
          statut: "INVALIDE",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Statut invalide" });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockCreateFacture.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: {
          client_id: 1, fournisseur: "Bell", reference_facture: "FAC-001",
          montant: 100, date_emission: "2026-03-01", date_echeance: "2026-03-20",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("retourne 403 si l'utilisateur n'a pas de client associe", async () => {
      mockFindClientIdForUser.mockResolvedValueOnce(null);
      const req = mockReq({
        session: { user: { id: 1, role: "UTILISATEUR" } },
        body: {
          fournisseur: "Bell", reference_facture: "FAC-002",
          montant: 60, date_emission: "2026-03-01", date_echeance: "2026-03-20",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Aucun client associe a cet utilisateur" });
      expect(mockCreateFacture).not.toHaveBeenCalled();
    });

    it("cree une facture IMPAYEE pour un UTILISATEUR (statut forcé)", async () => {
      mockFindClientIdForUser.mockResolvedValueOnce(5);
      mockCreateFacture.mockResolvedValueOnce({ insertId: 15 });
      const req = mockReq({
        session: { user: { id: 1, role: "UTILISATEUR" } },
        body: {
          fournisseur: "Hydro-Quebec", reference_facture: "HQ-001",
          montant: 120, date_emission: "2026-03-01", date_echeance: "2026-03-31",
          statut: "A_VENIR", // forcé à IMPAYEE par le contrôleur
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(mockCreateFacture).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 5, statut: "IMPAYEE" })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Facture creee", id: 15 });
    });

    it("cree une facture pour un admin", async () => {
      mockCreateFacture.mockResolvedValueOnce({ insertId: 12 });
      const req = mockReq({
        session: { user: { id: 2, role: "ADMIN" } },
        body: {
          client_id: 1, fournisseur: "Hydro Ottawa", reference_facture: "FAC-9001",
          description: "Mars", montant: 88.5,
          date_emission: "2026-03-01", date_echeance: "2026-03-20", statut: "IMPAYEE",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(mockCreateFacture).toHaveBeenCalledWith(
        expect.objectContaining({ fournisseur: "Hydro Ottawa", montant: 88.5 })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Facture creee", id: 12 });
    });

    it("retourne 400 si admin ne fournit pas de client_id", async () => {
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        body: {
          fournisseur: "Bell",
          reference_facture: "FAC-001",
          date_emission: "2025-01-01",
          date_echeance: "2025-02-01",
          montant: 100,
          statut: "IMPAYEE",
        },
      });
      const res = mockRes();
      await factures.createFactureItem(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Champs manquants" });
    });
  });

  describe("payFactureById", () => {
    it("refuse le paiement pour un moderateur", async () => {
      const req = mockReq({
        session: { user: { id: 3, role: "MODERATEUR" } },
        params: { id: "5" },
        body: { compte_id: 1 },
      });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockFindFactureById).not.toHaveBeenCalled();
    });

    it("retourne 400 si factureId ou compteId est invalide", async () => {
      const req = mockReq({ params: { id: "0" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Facture ou compte invalide" });
    });

    it("retourne 400 si compteId est zero (factureId valide)", async () => {
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 0 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Facture ou compte invalide" });
      expect(mockFindFactureById).not.toHaveBeenCalled();
    });

    it("retourne 400 si factureId est negatif", async () => {
      const req = mockReq({ params: { id: "-1" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Facture ou compte invalide" });
      expect(mockFindFactureById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la facture n'existe pas", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce(null);
      mockFindFactureById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "99" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("retourne 403 si la facture existe mais n'est pas autorisee", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce(null);
      mockFindFactureById.mockResolvedValueOnce({ id: 1, client_id: 1, montant: 80, statut: "IMPAYEE" });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("retourne 403 si le compte n'est pas autorise", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce({ id: 1, client_id: 1, montant: 80, fournisseur: "Bell", statut: "IMPAYEE" });
      mockFindAccountForFacturePayment.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 99 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Compte non autorise pour cette facture" });
    });

    it("retourne 400 si le solde est insuffisant", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce({ id: 1, client_id: 1, montant: 500, fournisseur: "Bell", statut: "IMPAYEE" });
      mockFindAccountForFacturePayment.mockResolvedValueOnce({ id: 1, client_id: 1, solde: 50 });
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
    });

    it("retourne 500 en cas d'erreur du repository", async () => {
      mockFindAuthorizedFactureById.mockRejectedValueOnce(new Error("DB error"));
      const req = mockReq({ params: { id: "1" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("retourne 400 si facture deja payee", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce({ id: 5, client_id: 1, montant: 80, fournisseur: "Bell", statut: "PAYEE" });
      const req = mockReq({ params: { id: "5" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "La facture est deja payee" });
    });

    it("paie une facture impayee de façon atomique", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce({ id: 5, client_id: 1, montant: 80, fournisseur: "Bell", statut: "IMPAYEE" });
      mockFindAccountForFacturePayment.mockResolvedValueOnce({ id: 1, client_id: 1, solde: 200 });
      const req = mockReq({ params: { id: "5" }, body: { compte_id: 1 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(mockExecutePayementFactureAtomique).toHaveBeenCalledWith(
        expect.objectContaining({ factureId: 5, compteId: 1, montant: 80, fournisseur: "Bell" })
      );
      expect(res.json).toHaveBeenCalledWith({ message: "Facture payee avec succes", id: 5 });
    });

    it("paie une facture via findFactureById pour un admin (branche canReadAllUser)", async () => {
      mockFindFactureById.mockResolvedValueOnce({ id: 7, client_id: 2, montant: 120, fournisseur: "Hydro", statut: "IMPAYEE" });
      mockFindAccountForFacturePayment.mockResolvedValueOnce({ id: 3, client_id: 2, solde: 500 });
      const req = mockReq({
        session: { user: { id: 1, role: "ADMIN" } },
        params: { id: "7" },
        body: { compte_id: 3 },
      });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(mockFindFactureById).toHaveBeenCalledWith(7);
      expect(mockFindAuthorizedFactureById).not.toHaveBeenCalled();
      expect(mockExecutePayementFactureAtomique).toHaveBeenCalledWith(
        expect.objectContaining({ factureId: 7, compteId: 3, montant: 120, fournisseur: "Hydro" })
      );
      expect(res.json).toHaveBeenCalledWith({ message: "Facture payee avec succes", id: 7 });
    });

    it("retourne 400 si SOLDE_INSUFFISANT levé par la fonction atomique (race condition)", async () => {
      mockFindAuthorizedFactureById.mockResolvedValueOnce({ id: 8, client_id: 1, montant: 300, fournisseur: "Vidéotron", statut: "IMPAYEE" });
      mockFindAccountForFacturePayment.mockResolvedValueOnce({ id: 2, client_id: 1, solde: 400 });
      const err = new Error("Solde insuffisant");
      err.code = "SOLDE_INSUFFISANT";
      mockExecutePayementFactureAtomique.mockRejectedValueOnce(err);
      const req = mockReq({ params: { id: "8" }, body: { compte_id: 2 } });
      const res = mockRes();
      await factures.payFactureById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Solde insuffisant" });
    });
  });
});
