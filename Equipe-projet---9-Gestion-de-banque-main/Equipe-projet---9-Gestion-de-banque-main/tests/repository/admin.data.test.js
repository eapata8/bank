import { jest } from "@jest/globals";

// Mock de la base de données
const mockQuery = jest.fn();
await jest.unstable_mockModule("../../server/db.js", () => ({
  default: { query: mockQuery },
}));

// bcrypt mock
await jest.unstable_mockModule("bcryptjs", () => ({
  default: { hash: jest.fn().mockResolvedValue("hashed_password") },
}));

const repo = await import("../../server/data/admin.data.js");

beforeEach(() => jest.clearAllMocks());

/* ── findAllUsers ────────────────────────────────── */
describe("findAllUsers", () => {
  it("retourne tous les utilisateurs triés par date", async () => {
    const rows = [{ id: 1, email: "a@b.com", role: "ADMIN" }];
    mockQuery.mockResolvedValueOnce([rows]);
    const result = await repo.findAllUsers();
    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT"));
  });
});

/* ── findUserById ─────────────────────────────────── */
describe("findUserById", () => {
  it("retourne l'utilisateur si trouvé", async () => {
    const user = { id: 5, email: "x@y.com" };
    mockQuery.mockResolvedValueOnce([[user]]);
    const result = await repo.findUserById(5);
    expect(result).toEqual(user);
  });

  it("retourne null si non trouvé", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findUserById(999);
    expect(result).toBeNull();
  });
});

/* ── getFirstAdminId ──────────────────────────────── */
describe("getFirstAdminId", () => {
  it("retourne l'id du premier admin (le plus petit id)", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1 }]]);
    const result = await repo.getFirstAdminId();
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("ORDER BY id ASC"));
  });

  it("retourne null si aucun admin", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.getFirstAdminId();
    expect(result).toBeNull();
  });
});

/* ── deleteUserById ───────────────────────────────── */
describe("deleteUserById", () => {
  it("retourne le nombre de lignes affectées", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.deleteUserById(3);
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE"), [3]);
  });
});

/* ── updateUserRole ───────────────────────────────── */
describe("updateUserRole", () => {
  it("met à jour le rôle et retourne affectedRows", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.updateUserRole(2, "MODERATEUR");
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE"), ["MODERATEUR", 2]);
  });
});

/* ── resetUserPassword ────────────────────────────── */
describe("resetUserPassword", () => {
  it("hash le mot de passe et met à jour la base", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.resetUserPassword(1, "newpassword");
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("mot_de_passe_hash"),
      ["hashed_password", 1]
    );
  });
});

/* ── createAdminUser ──────────────────────────────── */
describe("createAdminUser", () => {
  it("insère un nouvel administrateur", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 10 }]);
    const result = await repo.createAdminUser({ email: "a@a.com", motDePasse: "pass123", prenom: "A", nom: "B" });
    expect(result).toBe(10);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ADMIN"),
      ["a@a.com", "hashed_password", "A", "B"]
    );
  });
});

/* ── createModeratorUser ──────────────────────────── */
describe("createModeratorUser", () => {
  it("insère un nouveau modérateur", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 11 }]);
    const result = await repo.createModeratorUser({ email: "m@m.com", motDePasse: "pass123", prenom: "M", nom: "N" });
    expect(result).toBe(11);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("MODERATEUR"),
      ["m@m.com", "hashed_password", "M", "N"]
    );
  });
});

/* ── findAccountWithClientInfo ────────────────────── */
describe("findAccountWithClientInfo", () => {
  it("retourne le compte avec les infos client", async () => {
    const compte = { id: 1, solde: 1000, client_prenom: "Jean", client_nom: "Dupont" };
    mockQuery.mockResolvedValueOnce([[compte]]);
    const result = await repo.findAccountWithClientInfo(1);
    expect(result).toEqual(compte);
  });

  it("retourne null si non trouvé", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findAccountWithClientInfo(999);
    expect(result).toBeNull();
  });
});

/* ── setAccountBalance ────────────────────────────── */
describe("setAccountBalance", () => {
  it("met à jour le solde directement", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.setAccountBalance(1, 5000);
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("solde = ?"), [5000, 1]);
  });
});

/* ── setAccountStatus ─────────────────────────────── */
describe("setAccountStatus", () => {
  it("bloque un compte (est_actif = 0)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repo.setAccountStatus(1, false);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("est_actif"), [0, 1]);
  });

  it("débloque un compte (est_actif = 1)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repo.setAccountStatus(1, true);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("est_actif"), [1, 1]);
  });
});

/* ── setAccountType ───────────────────────────────── */
describe("setAccountType", () => {
  it("change le type de compte", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.setAccountType(1, "EPARGNE");
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("type_compte"), ["EPARGNE", 1]);
  });
});

/* ── findTransactionById ──────────────────────────── */
describe("findTransactionById", () => {
  it("retourne la transaction si trouvée", async () => {
    const tx = { id: 10, montant: 100 };
    mockQuery.mockResolvedValueOnce([[tx]]);
    const result = await repo.findTransactionById(10);
    expect(result).toEqual(tx);
  });

  it("retourne null si non trouvée", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findTransactionById(999);
    expect(result).toBeNull();
  });
});

/* ── insertTransaction ────────────────────────────── */
describe("insertTransaction", () => {
  it("insère une transaction et retourne l'id", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 42 }]);
    const id = await repo.insertTransaction({
      compteId: 1,
      typeTransaction: "DEPOT",
      description: "Test",
      montant: 200,
      statut: "TERMINEE",
    });
    expect(id).toBe(42);
  });

  it("utilise null et 'TERMINEE' par défaut si description et statut sont absents", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 99 }]);
    const id = await repo.insertTransaction({
      compteId: 2,
      typeTransaction: "RETRAIT",
      montant: 50,
    });
    expect(id).toBe(99);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      [2, "RETRAIT", null, 50, "TERMINEE", expect.any(Date)]
    );
  });
});

/* ── deleteTransactionById ────────────────────────── */
describe("deleteTransactionById", () => {
  it("supprime la transaction et retourne affectedRows", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.deleteTransactionById(10);
    expect(result).toBe(1);
  });
});

/* ── adjustBalanceBy ──────────────────────────────── */
describe("adjustBalanceBy", () => {
  it("ajuste le solde avec un delta positif", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repo.adjustBalanceBy(1, 100);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("solde = solde + ?"), [100, 1]);
  });

  it("ajuste le solde avec un delta négatif", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repo.adjustBalanceBy(1, -50);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("solde = solde + ?"), [-50, 1]);
  });
});

/* ── findVirementById ─────────────────────────────── */
describe("findVirementById", () => {
  it("retourne le virement si trouvé", async () => {
    const virement = { id: 5, montant: 300 };
    mockQuery.mockResolvedValueOnce([[virement]]);
    const result = await repo.findVirementById(5);
    expect(result).toEqual(virement);
  });

  it("retourne null si non trouvé", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findVirementById(999);
    expect(result).toBeNull();
  });
});

/* ── insertVirement ───────────────────────────────── */
describe("insertVirement", () => {
  it("insère un virement et retourne l'id", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 7 }]);
    const id = await repo.insertVirement({
      compteSourceId: 1,
      compteDestinationId: 2,
      montant: 500,
      statut: "ACCEPTE",
    });
    expect(id).toBe(7);
  });

  it("utilise 'ACCEPTE' par défaut si statut est absent", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 88 }]);
    const id = await repo.insertVirement({
      compteSourceId: 1,
      compteDestinationId: 2,
      montant: 300,
    });
    expect(id).toBe(88);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      [1, 2, 300, null, expect.any(Date), "ACCEPTE"]
    );
  });
});

/* ── deleteVirementById ───────────────────────────── */
describe("deleteVirementById", () => {
  it("supprime le virement et retourne affectedRows", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await repo.deleteVirementById(5);
    expect(result).toBe(1);
  });
});

/* ── findUserIdByEmail ────────────────────────────── */
describe("findUserIdByEmail", () => {
  it("retourne l'objet utilisateur si l'email existe", async () => {
    const row = { id: 7 };
    mockQuery.mockResolvedValueOnce([[row]]);
    const result = await repo.findUserIdByEmail("x@Leon.local");
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("email = ?"), ["x@Leon.local"]);
  });

  it("retourne null si l'email est introuvable", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findUserIdByEmail("inconnu@Leon.local");
    expect(result).toBeNull();
  });
});

/* ── findPairedVirementTransaction ───────────────── */
describe("findPairedVirementTransaction", () => {
  it("retourne la transaction jumelée si trouvée", async () => {
    const tx = { id: 99, compte_id: 5, montant: -500 };
    mockQuery.mockResolvedValueOnce([[tx]]);
    const date = new Date("2025-01-01T10:00:00Z");
    const result = await repo.findPairedVirementTransaction(1, 500, date);
    expect(result).toEqual(tx);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("VIREMENT"),
      [1, -500, date, date]
    );
  });

  it("retourne null si aucune transaction jumelée trouvée", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findPairedVirementTransaction(1, 300, new Date());
    expect(result).toBeNull();
  });
});

/* ── updateAutoValidation ─────────────────────────── */
describe("updateAutoValidation", () => {
  it("active l'auto-validation (value = true)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repo.updateAutoValidation(3, true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("auto_validation = ?"),
      [1, 3]
    );
  });

  it("désactive l'auto-validation (value = false)", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repo.updateAutoValidation(3, false);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("auto_validation = ?"),
      [0, 3]
    );
  });
});

/* ── findUserAutoValidation ───────────────────────── */
describe("findUserAutoValidation", () => {
  it("retourne 1 si l'auto-validation est activée", async () => {
    mockQuery.mockResolvedValueOnce([[{ auto_validation: 1 }]]);
    const result = await repo.findUserAutoValidation(4);
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("auto_validation"),
      [4]
    );
  });

  it("retourne 0 si l'auto-validation est désactivée", async () => {
    mockQuery.mockResolvedValueOnce([[{ auto_validation: 0 }]]);
    const result = await repo.findUserAutoValidation(4);
    expect(result).toBe(0);
  });

  it("retourne 0 par défaut si l'utilisateur est introuvable", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await repo.findUserAutoValidation(999);
    expect(result).toBe(0);
  });
});

/* ── deleteTransactionsByVirementAccounts ─────────── */
describe("deleteTransactionsByVirementAccounts", () => {
  it("exécute la requête DELETE avec les bons paramètres", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 2 }]);
    const date = new Date("2025-03-01T12:00:00Z");
    await repo.deleteTransactionsByVirementAccounts({
      compteSourceId: 1,
      compteDestinationId: 2,
      montant: 500,
      dateVirement: date,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM transactions"),
      [1, -500, date, date, 2, 500, date, date]
    );
  });
});
