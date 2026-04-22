import { jest } from "@jest/globals";

const mockDb = { query: jest.fn() };
await jest.unstable_mockModule("../../server/db.js", () => ({ default: mockDb }));

const repo = await import("../../server/data/admin.clients.data.js");

beforeEach(() => {
  mockDb.query.mockReset();
});

/* ── findClientById ──────────────────────────────── */
describe("findClientById", () => {
  it("retourne le client si trouve", async () => {
    const client = { id: 1, prenom: "Alice", nom: "Martin", email_fictif: "alice@Leon.local", ville: "Montreal", cree_le: "2026-01-01" };
    mockDb.query.mockResolvedValueOnce([[client]]);

    const result = await repo.findClientById(1);

    expect(result).toEqual(client);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
      [1]
    );
  });

  it("retourne null si le client est introuvable", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientById(999);

    expect(result).toBeNull();
  });
});

/* ── findClientComptes ───────────────────────────── */
describe("findClientComptes", () => {
  it("retourne les comptes du client", async () => {
    const rows = [
      { id: 10, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: "1500.00", devise: "CAD", est_actif: 1 },
      { id: 11, type_compte: "EPARGNE",  numero_compte: "**** 5678", solde: "3000.00", devise: "CAD", est_actif: 1 },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientComptes(1);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE client_id = ?"),
      [1]
    );
  });

  it("retourne un tableau vide si le client n'a pas de comptes", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientComptes(42);

    expect(result).toEqual([]);
  });

  it("ordonne les comptes par id DESC", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findClientComptes(1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY id DESC"),
      [1]
    );
  });
});

/* ── findClientVirements ─────────────────────────── */
describe("findClientVirements", () => {
  it("retourne les virements impliquant le client (source ou destination)", async () => {
    const rows = [
      {
        id: 5,
        montant: "200.00",
        description: "Loyer",
        date_virement: "2026-03-01",
        statut: "TERMINE",
        compte_source_numero: "**** 1234",
        compte_destination_numero: "**** 9999",
        client_source_nom: "Alice Martin",
        client_destination_nom: "Bob Roy",
      },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientVirements(1);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("cs.client_id = ? OR cd.client_id = ?"),
      [1, 1]
    );
  });

  it("retourne un tableau vide si aucun virement", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientVirements(99);

    expect(result).toEqual([]);
  });

  it("applique une limite de 100 resultats", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findClientVirements(1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT 100"),
      [1, 1]
    );
  });
});

/* ── findClientDepots ────────────────────────────── */
describe("findClientDepots", () => {
  it("retourne les depots du client avec les infos du compte", async () => {
    const rows = [
      {
        id: 3,
        montant: "500.00",
        numero_cheque: "CHQ-001",
        banque_emettrice: "TD",
        statut: "APPROUVE",
        depose_le: "2026-03-10",
        traite_le: "2026-03-11",
        numero_compte: "**** 1234",
        type_compte: "CHEQUES",
      },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientDepots(1);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE d.client_id = ?"),
      [1]
    );
  });

  it("retourne un tableau vide si aucun depot", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientDepots(99);

    expect(result).toEqual([]);
  });
});

/* ── findClientRetraits ──────────────────────────── */
describe("findClientRetraits", () => {
  it("retourne les retraits du client avec les infos du compte", async () => {
    const rows = [
      {
        id: 2,
        montant: "300.00",
        description: "Retrait guichet",
        statut: "APPROUVE",
        date_demande: "2026-03-05",
        date_approbation: "2026-03-06",
        numero_compte: "**** 1234",
        type_compte: "CHEQUES",
      },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientRetraits(1);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE r.client_id = ?"),
      [1]
    );
  });

  it("retourne un tableau vide si aucun retrait", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientRetraits(99);

    expect(result).toEqual([]);
  });
});

/* ── findClientFactures ──────────────────────────── */
describe("findClientFactures", () => {
  it("retourne les factures du client avec le compte de paiement si present", async () => {
    const rows = [
      {
        id: 7,
        fournisseur: "Hydro-Quebec",
        reference_facture: "HQ-2026-001",
        montant: "145.00",
        statut: "PAYEE",
        date_emission: "2026-03-01",
        date_echeance: "2026-03-31",
        payee_le: "2026-03-20",
        compte_paiement_numero: "**** 1234",
      },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientFactures(1);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE f.client_id = ?"),
      [1]
    );
  });

  it("retourne les factures avec compte_paiement_numero null si non payee", async () => {
    const rows = [
      { id: 8, fournisseur: "Bell", statut: "IMPAYEE", compte_paiement_numero: null },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientFactures(2);

    expect(result[0].compte_paiement_numero).toBeNull();
  });

  it("utilise LEFT JOIN pour inclure les factures sans paiement", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findClientFactures(1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN"),
      [1]
    );
  });

  it("retourne un tableau vide si aucune facture", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientFactures(99);

    expect(result).toEqual([]);
  });
});

/* ── findClientCartes ────────────────────────────── */
describe("findClientCartes", () => {
  it("retourne les cartes de credit du client", async () => {
    const rows = [
      {
        id: 3,
        type_carte: "VISA",
        numero_compte: "4532 8814 7700 4242",
        limite_credit: "5000.00",
        solde_utilise: "1240.50",
        statut: "ACTIVE",
        date_expiration: "2028-03-31",
        cree_le: "2026-01-01",
      },
    ];
    mockDb.query.mockResolvedValueOnce([rows]);

    const result = await repo.findClientCartes(1);

    expect(result).toEqual(rows);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE client_id = ?"),
      [1]
    );
  });

  it("retourne un tableau vide si le client n'a pas de cartes", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    const result = await repo.findClientCartes(99);

    expect(result).toEqual([]);
  });

  it("ordonne les cartes par id DESC", async () => {
    mockDb.query.mockResolvedValueOnce([[]]);

    await repo.findClientCartes(1);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY id DESC"),
      [1]
    );
  });
});
