import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/recurrentes.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// findRecurrentes — client_destination_nom
// ─────────────────────────────────────────────────────────────────────────────

describe("findRecurrentes — client_destination_nom", () => {
  it("la requête SQL joint la table clients pour le compte destination", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findRecurrentes({ userId: 1, isAdmin: false });

    const sql = mockDb.query.mock.calls[0][0];
    expect(sql).toContain("dest_client");
    expect(sql).toContain("client_destination_nom");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findCompteByNumero
// ─────────────────────────────────────────────────────────────────────────────

describe("findCompteByNumero", () => {
  it("retourne les infos du compte si le numéro existe", async () => {
    const compte = { id: 5, type_compte: "EPARGNE", est_actif: 1, client_nom: "Jean Dupont" };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findCompteByNumero("CA0012345");

    expect(result).toEqual(compte);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("numero_compte = ?"),
      ["CA0012345"]
    );
  });

  it("retourne null si aucun compte ne correspond au numéro", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findCompteByNumero("INCONNU");

    expect(result).toBeNull();
  });

  it("inclut est_actif dans le SELECT (pour filtrer les comptes inactifs côté controller)", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 1, type_compte: "CHEQUES", est_actif: 0, client_nom: "Test User" }]]);

    await repo.findCompteByNumero("CA0099999");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("est_actif"),
      expect.any(Array)
    );
  });

  it("joint la table clients pour retourner client_nom", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 3, type_compte: "CHEQUES", est_actif: 1, client_nom: "Marie Martin" }]]);

    await repo.findCompteByNumero("CA0055555");

    const sql = mockDb.query.mock.calls[0][0];
    expect(sql).toContain("JOIN clients");
    expect(sql).toContain("client_nom");
  });

  it("ne retourne pas le solde du compte (données non-sensibles uniquement)", async () => {
    const compte = { id: 2, type_compte: "CHEQUES", est_actif: 1, client_nom: "Bob" };
    mockDb.query.mockResolvedValueOnce([[compte]]);

    const result = await repo.findCompteByNumero("CA0011111");

    expect(result).not.toHaveProperty("solde");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findRecurrentes
// ─────────────────────────────────────────────────────────────────────────────

describe("findRecurrentes", () => {
  it("retourne toutes les récurrentes pour un admin (isAdmin=true, pas de filtre utilisateur)", async () => {
    const rows = [{ id: 1, montant: 500 }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findRecurrentes({ userId: 99, isAdmin: true });

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.not.stringContaining("utilisateur_id = ?"),
      []
    );
  });

  it("filtre par utilisateur si isAdmin=false", async () => {
    const rows = [{ id: 2, montant: 200 }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findRecurrentes({ userId: 5, isAdmin: false });

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("tr.utilisateur_id = ?"),
      [5]
    );
  });

  it("retourne un tableau vide si aucune récurrente trouvée", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findRecurrentes({ userId: 1, isAdmin: false });

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findRecurrenteById
// ─────────────────────────────────────────────────────────────────────────────

describe("findRecurrenteById", () => {
  it("retourne la récurrente si trouvée", async () => {
    const rec = { id: 3, statut: "ACTIVE", utilisateur_id: 1 };
    mockDb.query.mockResolvedValueOnce([[rec]]);

    const result = await repo.findRecurrenteById(3);

    expect(result).toEqual(rec);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [3]
    );
  });

  it("retourne null si non trouvée", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findRecurrenteById(999);

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("createRecurrente", () => {
  it("insère une récurrente et retourne le résultat avec insertId", async () => {
    const fakeResult = { insertId: 42 };
    mockDb.query.mockResolvedValueOnce([fakeResult]);

    const result = await repo.createRecurrente({
      utilisateurId: 1,
      compteSourceId: 2,
      compteDestinationId: 3,
      montant: 500,
      description: "Épargne mensuelle",
      frequence: "MENSUEL",
      prochaineExecution: "2026-05-15",
      dateFin: null,
    });

    expect(result).toEqual(fakeResult);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions_recurrentes"),
      [1, 2, 3, 500, "Épargne mensuelle", "MENSUEL", "2026-05-15", null]
    );
  });

  it("insère null pour description et dateFin si non fournis", async () => {
    mockDb.query.mockResolvedValueOnce([{ insertId: 10 }]);

    await repo.createRecurrente({
      utilisateurId: 2,
      compteSourceId: 4,
      compteDestinationId: 5,
      montant: 100,
      description: undefined,
      frequence: "HEBDOMADAIRE",
      prochaineExecution: "2026-04-22",
      dateFin: undefined,
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([null, null])
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateStatutRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("updateStatutRecurrente", () => {
  it("exécute un UPDATE avec le bon statut et l'id", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.updateStatutRecurrente(7, "SUSPENDUE");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE transactions_recurrentes"),
      ["SUSPENDUE", 7]
    );
  });

  it("peut mettre le statut à ANNULEE", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.updateStatutRecurrente(8, "ANNULEE");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      ["ANNULEE", 8]
    );
  });

  it("peut mettre le statut à ACTIVE", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.updateStatutRecurrente(9, "ACTIVE");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      ["ACTIVE", 9]
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetNbEchecsRecurrente
// ─────────────────────────────────────────────────────────────────────────────

describe("resetNbEchecsRecurrente", () => {
  it("remet nb_echecs à 0 et le statut à ACTIVE pour l'id donné", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.resetNbEchecsRecurrente(42);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("nb_echecs = 0"),
      [42]
    );
    expect(mockDb.query.mock.calls[0][0]).toMatch(/statut\s*=\s*'ACTIVE'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findRecurrentesEchues
// ─────────────────────────────────────────────────────────────────────────────

describe("findRecurrentesEchues", () => {
  it("retourne les récurrentes ACTIVE dont la date est échue", async () => {
    const rows = [{ id: 1, statut: "ACTIVE", prochaine_execution: "2026-04-01" }];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findRecurrentesEchues();

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("statut = 'ACTIVE'"),
      []
    );
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("prochaine_execution <= CURDATE()"),
      []
    );
  });

  it("retourne un tableau vide s'il n'y a rien à exécuter", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findRecurrentesEchues();

    expect(result).toEqual([]);
  });

  it("inclut le solde_source dans le SELECT via JOIN comptes", async () => {
    mockDb.query.mockResolvedValueOnce([[{ id: 2, solde_source: 1500 }]]);

    await repo.findRecurrentesEchues();

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("solde_source"),
      []
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateApresExecution
// ─────────────────────────────────────────────────────────────────────────────

describe("updateApresExecution", () => {
  it("met à jour les 4 champs corrects après une exécution réussie", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.updateApresExecution(5, {
      derniere_execution: "2026-04-15",
      prochaine_execution: "2026-05-15",
      nb_echecs: 0,
      statut: "ACTIVE",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("SET derniere_execution = ?"),
      ["2026-04-15", "2026-05-15", 0, "ACTIVE", 5]
    );
  });

  it("peut passer le statut à SUSPENDUE après 3 échecs", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.updateApresExecution(6, {
      derniere_execution: "2026-04-15",
      prochaine_execution: "2026-04-22",
      nb_echecs: 3,
      statut: "SUSPENDUE",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      ["2026-04-15", "2026-04-22", 3, "SUSPENDUE", 6]
    );
  });

  it("peut passer le statut à TERMINEE si date_fin dépassée", async () => {
    mockDb.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await repo.updateApresExecution(7, {
      derniere_execution: "2027-12-01",
      prochaine_execution: "2028-01-01",
      nb_echecs: 0,
      statut: "TERMINEE",
    });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.anything(),
      ["2027-12-01", "2028-01-01", 0, "TERMINEE", 7]
    );
  });
});
