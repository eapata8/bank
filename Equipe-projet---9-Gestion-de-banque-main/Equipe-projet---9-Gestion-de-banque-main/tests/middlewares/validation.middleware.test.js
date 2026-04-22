import { jest } from "@jest/globals";
import {
  validateId,
  validateLogin,
  validateRegister,
  validateCreateUser,
  validateCreateClient,
  validateCreateCompte,
  validateAdjustBalance,
  validateChangeAccountType,
  validateAddTransaction,
  validateAddVirement,
  validateForceTransfer,
  validateChangeUserRole,
  validateResetPassword,
  validateAutoValidation,
  validateCreateCarte,
  validateModifierLimiteCarte,
  validateModifierSoldeCarte,
  validateRembourserCarte,
  validateCreateVirement,
  validateCreateVirementExterne,
  validateCreateFacture,
  validatePayFacture,
  validateCreateDepot,
  validateCreateRetrait,
  validateSendInterac,
  validateReclamerInterac,
  validateDemanderAutoDeposit,
  validateClientIdQuery,
  validateCreateSnapshot,
  validateCreateRecurrente,
  validateCreateDemandeProduit,
} from "../../server/middlewares/validation.middleware.js";

/* ── Helpers ─────────────────────────────────────── */
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json   = jest.fn().mockReturnThis();
  return res;
}
const next = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

/* ── validateId ──────────────────────────────────── */
describe("validateId", () => {
  const mw = validateId();

  it("appelle next() si id valide", () => {
    const req = { params: { id: "5" } };
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si id = 0", () => {
    const res = mockRes();
    validateId()(({ params: { id: "0" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 400 si id negatif", () => {
    const res = mockRes();
    validateId()(({ params: { id: "-3" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si id non entier (abc)", () => {
    const res = mockRes();
    validateId()(({ params: { id: "abc" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si id decimal (1.5)", () => {
    const res = mockRes();
    validateId()(({ params: { id: "1.5" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("utilise le nom de parametre fourni", () => {
    const res = mockRes();
    validateId("clientId")({ params: { clientId: "0" } }, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "clientId invalide" }));
  });
});

/* ── validateLogin ───────────────────────────────── */
describe("validateLogin", () => {
  it("appelle next() si email et motDePasse fournis", () => {
    validateLogin({ body: { email: "a@b.com", motDePasse: "secret" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si email manquant", () => {
    const res = mockRes();
    validateLogin({ body: { motDePasse: "secret" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si motDePasse manquant", () => {
    const res = mockRes();
    validateLogin({ body: { email: "a@b.com" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateRegister ────────────────────────────── */
describe("validateRegister", () => {
  const valid = { email: "a@b.com", motDePasse: "pass", prenom: "Jean", nom: "Dupont" };

  it("appelle next() si tous les champs presents", () => {
    validateRegister({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si un champ manquant", () => {
    const res = mockRes();
    validateRegister({ body: { email: "a@b.com" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateUser ──────────────────────────── */
describe("validateCreateUser", () => {
  const valid = { email: "a@b.com", motDePasse: "secure1", prenom: "Admin", nom: "X" };

  it("appelle next() si tous les champs valides", () => {
    validateCreateUser({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateUser({ body: { email: "a@b.com" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si motDePasse trop court (< 6 chars)", () => {
    const res = mockRes();
    validateCreateUser({ body: { ...valid, motDePasse: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("6") }));
  });
});

/* ── validateCreateClient ────────────────────────── */
describe("validateCreateClient", () => {
  const valid = { prenom: "Jean", nom: "Dupont", email_fictif: "j@d.com" };

  it("appelle next() si tous les champs presents", () => {
    validateCreateClient({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si un champ manquant", () => {
    const res = mockRes();
    validateCreateClient({ body: { prenom: "Jean" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateCompte ────────────────────────── */
describe("validateCreateCompte", () => {
  const valid = { client_id: "3", type_compte: "CHEQUES" };

  it("appelle next() avec champs valides", () => {
    validateCreateCompte({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() si last_four valide (4 chiffres)", () => {
    validateCreateCompte({ body: { ...valid, last_four: "1234" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si client_id manquant", () => {
    const res = mockRes();
    validateCreateCompte({ body: { type_compte: "CHEQUES" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si client_id est 0", () => {
    const res = mockRes();
    validateCreateCompte({ body: { client_id: "0", type_compte: "CHEQUES" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si type_compte invalide", () => {
    const res = mockRes();
    validateCreateCompte({ body: { client_id: "1", type_compte: "INVALIDE" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si last_four invalide (pas 4 chiffres)", () => {
    const res = mockRes();
    validateCreateCompte({ body: { ...valid, last_four: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateAdjustBalance ───────────────────────── */
describe("validateAdjustBalance", () => {
  it("appelle next() avec montant valide", () => {
    validateAdjustBalance({ body: { montant: "100" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() avec type_transaction valide", () => {
    validateAdjustBalance({ body: { montant: "50", type_transaction: "RETRAIT" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si montant = 0", () => {
    const res = mockRes();
    validateAdjustBalance({ body: { montant: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant manquant", () => {
    const res = mockRes();
    validateAdjustBalance({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si type_transaction invalide", () => {
    const res = mockRes();
    validateAdjustBalance({ body: { montant: "100", type_transaction: "INCONNU" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("deduit RETRAIT si montant negatif et pas de type", () => {
    validateAdjustBalance({ body: { montant: "-200" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

/* ── validateChangeAccountType ───────────────────── */
describe("validateChangeAccountType", () => {
  it("appelle next() si type_compte valide", () => {
    validateChangeAccountType({ body: { type_compte: "EPARGNE" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si type_compte manquant", () => {
    const res = mockRes();
    validateChangeAccountType({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si type_compte invalide", () => {
    const res = mockRes();
    validateChangeAccountType({ body: { type_compte: "INCONNU" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateAddTransaction ──────────────────────── */
describe("validateAddTransaction", () => {
  it("appelle next() avec montant valide", () => {
    validateAddTransaction({ body: { montant: "200" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si montant = 0", () => {
    const res = mockRes();
    validateAddTransaction({ body: { montant: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si type_transaction invalide", () => {
    const res = mockRes();
    validateAddTransaction({ body: { montant: "100", type_transaction: "MAUVAIS" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateAddVirement ─────────────────────────── */
describe("validateAddVirement", () => {
  const coords = {
    numero_compte_source: "1234", numero_institution_source: "621", numero_transit_source: "10001",
    numero_compte_dest: "5678", numero_institution_dest: "621", numero_transit_dest: "20002",
    montant: "500",
  };

  it("appelle next() avec coordonnees valides", () => {
    validateAddVirement({ body: coords }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() avec statut valide", () => {
    validateAddVirement({ body: { ...coords, statut: "EN_ATTENTE" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si coordonnees manquantes", () => {
    const res = mockRes();
    validateAddVirement({ body: { montant: "100" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateAddVirement({ body: { ...coords, montant: "-10" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si statut invalide", () => {
    const res = mockRes();
    validateAddVirement({ body: { ...coords, statut: "MAUVAIS" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateForceTransfer ───────────────────────── */
describe("validateForceTransfer", () => {
  const valid = {
    compte_source_id: "1",
    numero_compte_dest: "5678", numero_institution_dest: "002", numero_transit_dest: "00200",
    montant: "1000",
  };

  it("appelle next() avec donnees valides", () => {
    validateForceTransfer({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si compte_source_id manquant", () => {
    const res = mockRes();
    const { compte_source_id: _, ...body } = valid;
    validateForceTransfer({ body }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si coordonnees destination manquantes", () => {
    const res = mockRes();
    validateForceTransfer({ body: { compte_source_id: "1", montant: "100" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant invalide", () => {
    const res = mockRes();
    validateForceTransfer({ body: { ...valid, montant: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateChangeUserRole ──────────────────────── */
describe("validateChangeUserRole", () => {
  it("appelle next() si role valide", () => {
    validateChangeUserRole({ body: { role: "MODERATEUR" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si role manquant", () => {
    const res = mockRes();
    validateChangeUserRole({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si role invalide", () => {
    const res = mockRes();
    validateChangeUserRole({ body: { role: "SUPERADMIN" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateResetPassword ───────────────────────── */
describe("validateResetPassword", () => {
  it("appelle next() si mot de passe valide (>= 6 chars)", () => {
    validateResetPassword({ body: { nouveau_mot_de_passe: "secure1" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si mot de passe trop court", () => {
    const res = mockRes();
    validateResetPassword({ body: { nouveau_mot_de_passe: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si mot de passe manquant", () => {
    const res = mockRes();
    validateResetPassword({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateAutoValidation ──────────────────────── */
describe("validateAutoValidation", () => {
  it("appelle next() si auto_validation = true", () => {
    validateAutoValidation({ body: { auto_validation: true } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() si auto_validation = false", () => {
    validateAutoValidation({ body: { auto_validation: false } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() si auto_validation = 1", () => {
    validateAutoValidation({ body: { auto_validation: 1 } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() si auto_validation = 0", () => {
    validateAutoValidation({ body: { auto_validation: 0 } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si auto_validation est une string", () => {
    const res = mockRes();
    validateAutoValidation({ body: { auto_validation: "true" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si auto_validation est undefined", () => {
    const res = mockRes();
    validateAutoValidation({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateCarte ─────────────────────────── */
describe("validateCreateCarte", () => {
  const valid = {
    client_id: "1", type_carte: "VISA", limite_credit: "5000",
    date_expiration: "2028-12-31",
  };

  it("appelle next() avec champs valides", () => {
    validateCreateCarte({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() avec last_four valide", () => {
    validateCreateCarte({ body: { ...valid, last_four: "4242" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateCarte({ body: { client_id: "1" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si type_carte invalide", () => {
    const res = mockRes();
    validateCreateCarte({ body: { ...valid, type_carte: "AMEX" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si limite_credit <= 0", () => {
    const res = mockRes();
    validateCreateCarte({ body: { ...valid, limite_credit: "-100" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si last_four invalide", () => {
    const res = mockRes();
    validateCreateCarte({ body: { ...valid, last_four: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateModifierLimiteCarte ─────────────────── */
describe("validateModifierLimiteCarte", () => {
  it("appelle next() si limite valide", () => {
    validateModifierLimiteCarte({ body: { limite_credit: "3000" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si limite = 0", () => {
    const res = mockRes();
    validateModifierLimiteCarte({ body: { limite_credit: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si limite negative", () => {
    const res = mockRes();
    validateModifierLimiteCarte({ body: { limite_credit: "-500" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateModifierSoldeCarte ──────────────────── */
describe("validateModifierSoldeCarte", () => {
  it("appelle next() si solde_utilise = 0 (valide)", () => {
    validateModifierSoldeCarte({ body: { solde_utilise: "0" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("appelle next() si solde_utilise positif", () => {
    validateModifierSoldeCarte({ body: { solde_utilise: "200" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si solde_utilise negatif", () => {
    const res = mockRes();
    validateModifierSoldeCarte({ body: { solde_utilise: "-50" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateRembourserCarte ─────────────────────── */
describe("validateRembourserCarte", () => {
  it("appelle next() si compte_id et montant valides", () => {
    validateRembourserCarte({ body: { compte_id: "2", montant: "500" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si compte_id = 0", () => {
    const res = mockRes();
    validateRembourserCarte({ body: { compte_id: "0", montant: "500" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateRembourserCarte({ body: { compte_id: "2", montant: "-10" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateVirement ──────────────────────── */
describe("validateCreateVirement", () => {
  const valid = { compte_source_id: "1", compte_destination_id: "2", montant: "300" };

  it("appelle next() avec champs valides", () => {
    validateCreateVirement({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateVirement({ body: { montant: "100" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateCreateVirement({ body: { ...valid, montant: "-50" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si source = destination", () => {
    const res = mockRes();
    validateCreateVirement({ body: { compte_source_id: "3", compte_destination_id: "3", montant: "100" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateVirementExterne ───────────────── */
describe("validateCreateVirementExterne", () => {
  const valid = {
    compte_source_id: "1",
    numero_compte_dest: "5678", numero_institution_dest: "002", numero_transit_dest: "00200",
    montant: "200",
  };

  it("appelle next() avec champs valides", () => {
    validateCreateVirementExterne({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateVirementExterne({ body: { compte_source_id: "1" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateCreateVirementExterne({ body: { ...valid, montant: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateFacture ───────────────────────── */
describe("validateCreateFacture", () => {
  const valid = {
    fournisseur: "Bell", reference_facture: "FAC-001",
    montant: "150", date_emission: "2026-01-01", date_echeance: "2026-02-01",
  };

  it("appelle next() avec champs valides", () => {
    validateCreateFacture({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateFacture({ body: { fournisseur: "Bell" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateCreateFacture({ body: { ...valid, montant: "-10" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validatePayFacture ──────────────────────────── */
describe("validatePayFacture", () => {
  it("appelle next() si compte_id valide", () => {
    validatePayFacture({ body: { compte_id: "3" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si compte_id = 0", () => {
    const res = mockRes();
    validatePayFacture({ body: { compte_id: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si compte_id manquant", () => {
    const res = mockRes();
    validatePayFacture({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateDepot ─────────────────────────── */
describe("validateCreateDepot", () => {
  const valid = {
    compte_id: "1", montant: "300",
    numero_cheque: "CHQ-001", banque_emettrice: "TD",
  };

  it("appelle next() avec tous les champs valides et fichier present", () => {
    validateCreateDepot({ body: valid, file: { filename: "cheque.png" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateDepot({ body: { compte_id: "1" }, file: { filename: "f.png" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si fichier absent", () => {
    const res = mockRes();
    validateCreateDepot({ body: valid, file: null }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateCreateDepot({ body: { ...valid, montant: "-5" }, file: { filename: "f.png" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateRetrait ───────────────────────── */
describe("validateCreateRetrait", () => {
  it("appelle next() si donnees valides", () => {
    validateCreateRetrait({ body: { compte_id: "2", montant: "500" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si champs manquants", () => {
    const res = mockRes();
    validateCreateRetrait({ body: { compte_id: "2" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateCreateRetrait({ body: { compte_id: "2", montant: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant > 1000", () => {
    const res = mockRes();
    validateCreateRetrait({ body: { compte_id: "2", montant: "1500" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateSendInterac ─────────────────────────── */
describe("validateSendInterac", () => {
  const valid = {
    compte_source_id: 5,
    email_destinataire: "dest@test.com",
    montant: 100,
  };

  it("appelle next() avec des donnees valides", () => {
    validateSendInterac({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si compte_source_id manquant", () => {
    const res = mockRes();
    validateSendInterac({ body: { email_destinataire: "a@a.com", montant: 50 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si email_destinataire manquant", () => {
    const res = mockRes();
    validateSendInterac({ body: { compte_source_id: 1, montant: 50 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant est null", () => {
    const res = mockRes();
    validateSendInterac({ body: { compte_source_id: 1, email_destinataire: "a@a.com", montant: null } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant est une chaine vide", () => {
    const res = mockRes();
    validateSendInterac({ body: { compte_source_id: 1, email_destinataire: "a@a.com", montant: "" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si email invalide (sans @)", () => {
    const res = mockRes();
    validateSendInterac({ body: { ...valid, email_destinataire: "pasunemail" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant < 0.5", () => {
    const res = mockRes();
    validateSendInterac({ body: { ...valid, montant: 0.1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant NaN", () => {
    const res = mockRes();
    validateSendInterac({ body: { ...valid, montant: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("accepte un transfert sans mot de passe", () => {
    validateSendInterac({ body: valid }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si mot de passe trop court (< 3)", () => {
    const res = mockRes();
    validateSendInterac({ body: { ...valid, mot_de_passe: "ab" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si mot de passe trop long (> 25)", () => {
    const res = mockRes();
    validateSendInterac({ body: { ...valid, mot_de_passe: "a".repeat(26) } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("accepte un mot de passe valide (3-25 chars)", () => {
    validateSendInterac({ body: { ...valid, mot_de_passe: "secret" } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("ignore mot_de_passe si null ou vide", () => {
    validateSendInterac({ body: { ...valid, mot_de_passe: null } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

/* ── validateReclamerInterac ─────────────────────── */
describe("validateReclamerInterac", () => {
  it("appelle next() si compte_destination_id present", () => {
    validateReclamerInterac({ body: { compte_destination_id: 7 } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si compte_destination_id manquant", () => {
    const res = mockRes();
    validateReclamerInterac({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si compte_destination_id est 0 (falsy)", () => {
    const res = mockRes();
    validateReclamerInterac({ body: { compte_destination_id: 0 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateDemanderAutoDeposit ─────────────────── */
describe("validateDemanderAutoDeposit", () => {
  it("appelle next() avec des donnees valides", () => {
    validateDemanderAutoDeposit(
      { body: { email_interac: "moi@test.com", compte_depot_id: 5 } },
      mockRes(), next
    );
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si email_interac manquant", () => {
    const res = mockRes();
    validateDemanderAutoDeposit({ body: { compte_depot_id: 5 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si compte_depot_id manquant", () => {
    const res = mockRes();
    validateDemanderAutoDeposit({ body: { email_interac: "moi@test.com" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si email_interac invalide", () => {
    const res = mockRes();
    validateDemanderAutoDeposit(
      { body: { email_interac: "pas-un-email", compte_depot_id: 5 } },
      res, next
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateClientIdQuery ───────────────────────── */
describe("validateClientIdQuery", () => {
  it("appelle next() si clientId valide", () => {
    const res = mockRes();
    validateClientIdQuery({ query: { clientId: "5" } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si clientId manquant", () => {
    const res = mockRes();
    validateClientIdQuery({ query: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si clientId non numérique", () => {
    const res = mockRes();
    validateClientIdQuery({ query: { clientId: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si clientId <= 0", () => {
    const res = mockRes();
    validateClientIdQuery({ query: { clientId: "0" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateSnapshot ──────────────────────── */
describe("validateCreateSnapshot", () => {
  it("appelle next() si payload valide", () => {
    const res = mockRes();
    validateCreateSnapshot({ body: { clientId: 3, nom: "Snap" } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si clientId manquant", () => {
    const res = mockRes();
    validateCreateSnapshot({ body: { clientId: null, nom: "Snap" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si clientId non numérique", () => {
    const res = mockRes();
    validateCreateSnapshot({ body: { clientId: "abc", nom: "Snap" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si nom absent", () => {
    const res = mockRes();
    validateCreateSnapshot({ body: { clientId: 3, nom: "" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si nom uniquement espaces", () => {
    const res = mockRes();
    validateCreateSnapshot({ body: { clientId: 3, nom: "   " } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si nom > 100 caractères", () => {
    const res = mockRes();
    validateCreateSnapshot({ body: { clientId: 3, nom: "A".repeat(101) } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateRecurrente ────────────────────── */
describe("validateCreateRecurrente", () => {
  const baseBody = { compte_source_id: 1, compte_destination_id: 2, montant: 100, frequence: "MENSUEL" };

  it("appelle next() si payload valide", () => {
    const res = mockRes();
    validateCreateRecurrente({ body: { ...baseBody } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si compte_source_id manquant", () => {
    const res = mockRes();
    validateCreateRecurrente({ body: { ...baseBody, compte_source_id: null } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si frequence invalide", () => {
    const res = mockRes();
    validateCreateRecurrente({ body: { ...baseBody, frequence: "QUOTIDIEN" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si montant <= 0", () => {
    const res = mockRes();
    validateCreateRecurrente({ body: { ...baseBody, montant: -5 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si comptes source et destination identiques", () => {
    const res = mockRes();
    validateCreateRecurrente({ body: { ...baseBody, compte_destination_id: 1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/* ── validateCreateDemandeProduit ───────────────── */
describe("validateCreateDemandeProduit", () => {
  it("appelle next() pour un type_produit valide sans limite_credit", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_VISA" } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("accepte limite_credit valide (nombre positif)", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_VISA", limite_credit: 5000 } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("accepte limite_credit sous forme de string numérique", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_MASTERCARD", limite_credit: "2500" } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("ignore limite_credit null", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "COMPTE_CHEQUES", limite_credit: null } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("ignore limite_credit chaîne vide", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "COMPTE_EPARGNE", limite_credit: "" } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("retourne 400 si type_produit absent", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 400 si type_produit invalide", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_AMEX" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si limite_credit n'est pas un nombre", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_VISA", limite_credit: "abc" } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "limite_credit doit être un nombre positif" });
  });

  it("retourne 400 si limite_credit <= 0", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_VISA", limite_credit: 0 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("retourne 400 si limite_credit négative", () => {
    const res = mockRes();
    validateCreateDemandeProduit({ body: { type_produit: "CARTE_VISA", limite_credit: -100 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
