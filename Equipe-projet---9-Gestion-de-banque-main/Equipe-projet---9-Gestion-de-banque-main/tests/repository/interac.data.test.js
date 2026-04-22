import { jest } from "@jest/globals";

const mockQuery = jest.fn();

await jest.unstable_mockModule("../../server/db.js", () => ({
  default: { query: mockQuery },
}));

const {
  findAutoDeposit,
  findActiveAutoDepositByEmail,
  activerAutoDepositDirectement,
  deactivateAutoDeposit,
  getTotalEnvoyeAujourdhui,
  getTotalEnvoye7Jours,
  getTotalEnvoye30Jours,
  getTotalEnvoyeCeMois,
  findInteracTransferts,
  findTransfertsEnAttentePourDestinataire,
  findTransfertById,
  createInteracTransfert,
  accepterTransfert,
  annulerTransfert,
  expireTransfertsExpires,
  decrementAccountBalance,
  incrementAccountBalance,
  findAuthorizedAccount,
  createInteracTransaction,
  findTransfertsParClient,
  findAutoDepositParClient,
  getStatsInteracParClient,
  forceActiverAutoDepositParClient,
  findUserIdByClientId,
  desactiverAutoDepositParClient,
  getLimitesInteracParClient,
  setLimitesInteracParClient,
  getLimitesInteracParUtilisateur,
} = await import("../../server/data/interac.data.js");

beforeEach(() => jest.clearAllMocks());

/* ══ findAutoDeposit ══════════════════════════════════════════════ */
describe("findAutoDeposit", () => {
  it("retourne le profil existant", async () => {
    const profil = { id: 1, email_interac: "a@a.com", statut: "ACTIVE" };
    mockQuery.mockResolvedValueOnce([[profil]]);
    const result = await findAutoDeposit(1);
    expect(result).toEqual(profil);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);
  });

  it("retourne null si aucun profil", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findAutoDeposit(99);
    expect(result).toBeNull();
  });
});

/* ══ findActiveAutoDepositByEmail ═════════════════════════════════ */
describe("findActiveAutoDepositByEmail", () => {
  it("retourne le profil ACTIVE pour cet email", async () => {
    const row = { utilisateur_id: 2, compte_depot_id: 5 };
    mockQuery.mockResolvedValueOnce([[row]]);
    const result = await findActiveAutoDepositByEmail("a@a.com");
    expect(result).toEqual(row);
  });

  it("retourne null si aucun profil ACTIVE", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findActiveAutoDepositByEmail("aucun@test.com");
    expect(result).toBeNull();
  });
});

/* ══ activerAutoDepositDirectement ═══════════════════════════════ */
describe("activerAutoDepositDirectement", () => {
  it("insere ou met a jour le profil directement en ACTIVE", async () => {
    const res = { affectedRows: 1, insertId: 3 };
    mockQuery.mockResolvedValueOnce([res]);
    const result = await activerAutoDepositDirectement({
      utilisateurId: 1, emailInterac: "a@a.com", compteDepotId: 5,
    });
    expect(result).toEqual(res);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON DUPLICATE KEY UPDATE"),
      [1, "a@a.com", 5]
    );
  });
});

/* ══ deactivateAutoDeposit ════════════════════════════════════════ */
describe("deactivateAutoDeposit", () => {
  it("remet le statut a EN_ATTENTE", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await deactivateAutoDeposit(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("statut = 'EN_ATTENTE'"),
      [1]
    );
  });
});

/* ══ getTotalEnvoyeAujourdhui ═════════════════════════════════════ */
describe("getTotalEnvoyeAujourdhui", () => {
  it("retourne le total numerique", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "250.00" }]]);
    const result = await getTotalEnvoyeAujourdhui(1);
    expect(result).toBe(250);
  });

  it("retourne 0 si aucun transfert", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "0" }]]);
    const result = await getTotalEnvoyeAujourdhui(1);
    expect(result).toBe(0);
  });
});

/* ══ getTotalEnvoyeCeMois ═════════════════════════════════════════ */
describe("getTotalEnvoyeCeMois", () => {
  it("retourne le total mensuel numerique", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "1500.50" }]]);
    const result = await getTotalEnvoyeCeMois(1);
    expect(result).toBe(1500.5);
  });
});

/* ══ findInteracTransferts ════════════════════════════════════════ */
describe("findInteracTransferts", () => {
  it("retourne les transferts d'un utilisateur (non admin)", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mockQuery.mockResolvedValueOnce([rows]);
    const result = await findInteracTransferts({ userId: 1, isAdmin: false, search: "" });
    expect(result).toEqual(rows);
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain("expediteur_id");
  });

  it("retourne tous les transferts pour un admin", async () => {
    mockQuery.mockResolvedValueOnce([[{ id: 1 }], { id: 2 }]);
    const result = await findInteracTransferts({ userId: 1, isAdmin: true, search: "" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("applique le filtre de recherche (texte non numerique → safeNumeric null)", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await findInteracTransferts({ userId: 1, isAdmin: true, search: "alice" });
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain("LIKE");
  });

  it("applique le filtre de recherche numerique (safeNumeric = id)", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await findInteracTransferts({ userId: 1, isAdmin: true, search: "42" });
    const call = mockQuery.mock.calls[0];
    // safeNumeric = 42 (non-NaN) → passé dans les params
    expect(call[1]).toContain(42);
  });
});

/* ══ findTransfertsEnAttentePourDestinataire ══════════════════════ */
describe("findTransfertsEnAttentePourDestinataire", () => {
  it("retourne les transferts en attente pour l'email donne", async () => {
    const rows = [{ id: 5, montant: "100.00" }];
    mockQuery.mockResolvedValueOnce([rows]);
    const result = await findTransfertsEnAttentePourDestinataire("dest@test.com", null);
    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("IN"),
      expect.arrayContaining(["dest@test.com"])
    );
  });

  it("inclut l'email interac si present et different", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await findTransfertsEnAttentePourDestinataire("user@test.com", "interac@test.com");
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain("user@test.com");
    expect(params).toContain("interac@test.com");
  });

  it("deduplication si email interac identique a email utilisateur", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    await findTransfertsEnAttentePourDestinataire("same@test.com", "same@test.com");
    const params = mockQuery.mock.calls[0][1];
    // Un seul email (deduplication)
    expect(params.length).toBe(1);
  });
});

/* ══ findTransfertById ════════════════════════════════════════════ */
describe("findTransfertById", () => {
  it("retourne le transfert par son id", async () => {
    const row = { id: 7, montant: "50.00" };
    mockQuery.mockResolvedValueOnce([[row]]);
    const result = await findTransfertById(7);
    expect(result).toEqual(row);
  });

  it("retourne null si introuvable", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findTransfertById(999);
    expect(result).toBeNull();
  });
});

/* ══ createInteracTransfert ═══════════════════════════════════════ */
describe("createInteracTransfert", () => {
  it("insere un transfert et retourne le ResultSetHeader", async () => {
    const res = { insertId: 42, affectedRows: 1 };
    mockQuery.mockResolvedValueOnce([res]);
    const result = await createInteracTransfert({
      expediteurId: 1, compteSourceId: 5, emailDestinataire: "dest@test.com",
      montant: 100, description: "Test", motDePasseHash: "$hash", compteDestinationId: null,
      statut: "EN_ATTENTE",
    });
    expect(result).toEqual(res);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO interac_transferts"),
      expect.any(Array)
    );
  });

  it("inclut la date de traitement NOW() pour statut ACCEPTEE", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);
    await createInteracTransfert({
      expediteurId: 1, compteSourceId: 5, emailDestinataire: "d@d.com",
      montant: 50, description: null, motDePasseHash: null, compteDestinationId: 8,
      statut: "ACCEPTEE",
    });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain("NOW()");
  });
});

/* ══ accepterTransfert ════════════════════════════════════════════ */
describe("accepterTransfert", () => {
  it("met a jour le statut en ACCEPTEE", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await accepterTransfert(10, 7);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ACCEPTEE"),
      [7, 10]
    );
  });
});

/* ══ annulerTransfert ═════════════════════════════════════════════ */
describe("annulerTransfert", () => {
  it("met a jour le statut en ANNULEE", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await annulerTransfert(10);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("ANNULEE"),
      [10]
    );
  });
});

/* ══ expireTransfertsExpires ══════════════════════════════════════ */
describe("expireTransfertsExpires", () => {
  it("retourne la liste des transferts expires et les met a jour", async () => {
    const toExpire = [{ id: 1, compte_source_id: 5, montant: "100.00" }];
    mockQuery
      .mockResolvedValueOnce([toExpire])    // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
    const result = await expireTransfertsExpires();
    expect(result).toEqual(toExpire);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("ne fait pas de UPDATE si aucun transfert a expirer", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await expireTransfertsExpires();
    expect(result).toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

/* ══ decrementAccountBalance ══════════════════════════════════════ */
describe("decrementAccountBalance", () => {
  it("execute le debit SQL avec les bons parametres", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await decrementAccountBalance(5, 100);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("solde = solde -"),
      [100, 5]
    );
  });
});

/* ══ incrementAccountBalance ══════════════════════════════════════ */
describe("incrementAccountBalance", () => {
  it("execute le credit SQL avec les bons parametres", async () => {
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await incrementAccountBalance(7, 250);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("solde = solde +"),
      [250, 7]
    );
  });
});

/* ══ findAuthorizedAccount ════════════════════════════════════════ */
describe("findAuthorizedAccount", () => {
  it("retourne le compte si autorise", async () => {
    const compte = { id: 5, solde: "1000.00", est_actif: 1 };
    mockQuery.mockResolvedValueOnce([[compte]]);
    const result = await findAuthorizedAccount(1, 5);
    expect(result).toEqual(compte);
  });

  it("retourne null si non autorise", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findAuthorizedAccount(1, 999);
    expect(result).toBeNull();
  });
});

/* ══ createInteracTransaction ═════════════════════════════════════ */
describe("createInteracTransaction", () => {
  it("insere une transaction VIREMENT dans l'historique", async () => {
    mockQuery.mockResolvedValueOnce([{ insertId: 99 }]);
    await createInteracTransaction({ compteId: 5, montant: -100, description: "Envoi Interac" });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      expect.arrayContaining([5, "Envoi Interac", -100])
    );
  });
});

/* ══ getTotalEnvoye7Jours ═════════════════════════════════════════ */
describe("getTotalEnvoye7Jours", () => {
  it("retourne le total sur 7 jours", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "500.00" }]]);
    const result = await getTotalEnvoye7Jours(1);
    expect(result).toBe(500);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);
  });

  it("retourne 0 si aucun transfert", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "0" }]]);
    const result = await getTotalEnvoye7Jours(1);
    expect(result).toBe(0);
  });
});

/* ══ getTotalEnvoye30Jours ════════════════════════════════════════ */
describe("getTotalEnvoye30Jours", () => {
  it("retourne le total sur 30 jours", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "2000.75" }]]);
    const result = await getTotalEnvoye30Jours(1);
    expect(result).toBe(2000.75);
  });

  it("est aliase par getTotalEnvoyeCeMois", async () => {
    mockQuery.mockResolvedValueOnce([[{ total: "300.00" }]]);
    const result = await getTotalEnvoyeCeMois(1);
    expect(result).toBe(300);
  });
});

/* ══ findTransfertsParClient ══════════════════════════════════════ */
describe("findTransfertsParClient", () => {
  it("retourne les transferts du client", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mockQuery.mockResolvedValueOnce([rows]);
    const result = await findTransfertsParClient(10);
    expect(result).toEqual(rows);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DISTINCT"), [10, 10]);
  });

  it("retourne un tableau vide si aucun transfert", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findTransfertsParClient(99);
    expect(result).toEqual([]);
  });
});

/* ══ findAutoDepositParClient ═════════════════════════════════════ */
describe("findAutoDepositParClient", () => {
  it("retourne le profil auto-depot du client", async () => {
    const row = { id: 3, email_interac: "a@a.com", statut: "ACTIVE" };
    mockQuery.mockResolvedValueOnce([[row]]);
    const result = await findAutoDepositParClient(10);
    expect(result).toEqual(row);
  });

  it("retourne null si aucun profil", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findAutoDepositParClient(99);
    expect(result).toBeNull();
  });
});

/* ══ getStatsInteracParClient ═════════════════════════════════════ */
describe("getStatsInteracParClient", () => {
  it("retourne les statistiques agregees du client", async () => {
    const stats = { total_24h: 100, total_7j: 500, total_30j: 1000, nb_en_attente: 2 };
    mockQuery.mockResolvedValueOnce([[stats]]);
    const result = await getStatsInteracParClient(10);
    expect(result).toEqual(stats);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [10]);
  });
});

/* ══ findUserIdByClientId ════════════════════════════════════════ */
describe("findUserIdByClientId", () => {
  it("retourne l'utilisateur_id si la liaison existe", async () => {
    mockQuery.mockResolvedValueOnce([[{ utilisateur_id: 7 }]]);
    const result = await findUserIdByClientId(10);
    expect(result).toBe(7);
  });

  it("retourne null si aucun utilisateur lié au client", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await findUserIdByClientId(99);
    expect(result).toBeNull();
  });
});

/* ══ forceActiverAutoDepositParClient ════════════════════════════ */
describe("forceActiverAutoDepositParClient", () => {
  it("retourne null si aucun utilisateur lie au client", async () => {
    mockQuery.mockResolvedValueOnce([[]]); // ucRows vide
    const result = await forceActiverAutoDepositParClient(99, "a@a.com", 5);
    expect(result).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("insere le profil ACTIVE et retourne userId", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ utilisateur_id: 7 }]]) // SELECT (via findUserIdByClientId)
      .mockResolvedValueOnce([{ affectedRows: 1 }]);     // INSERT
    const result = await forceActiverAutoDepositParClient(10, "A@A.COM", 5);
    expect(result).toBe(7);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1]).toContain("a@a.com"); // email lowercased
  });
});

/* ══ desactiverAutoDepositParClient ══════════════════════════════ */
describe("desactiverAutoDepositParClient", () => {
  it("retourne sans erreur si aucun utilisateur lie au client", async () => {
    mockQuery.mockResolvedValueOnce([[]]); // ucRows vide
    await desactiverAutoDepositParClient(99);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("desactive l'auto-depot de l'utilisateur du client", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ utilisateur_id: 7 }]])  // SELECT uc
      .mockResolvedValueOnce([{ affectedRows: 1 }]);      // UPDATE via deactivateAutoDeposit
    await desactiverAutoDepositParClient(10);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[1]).toContain(7); // userId
  });
});

/* ══ getLimitesInteracParClient ═══════════════════════════════════ */
describe("getLimitesInteracParClient", () => {
  it("retourne les limites du client", async () => {
    const limites = { limite_24h: 3000, limite_7j: null, limite_30j: null };
    mockQuery.mockResolvedValueOnce([[limites]]);
    const result = await getLimitesInteracParClient(10);
    expect(result).toEqual(limites);
  });

  it("retourne null si client introuvable", async () => {
    mockQuery.mockResolvedValueOnce([[]]);
    const result = await getLimitesInteracParClient(99);
    expect(result).toBeNull();
  });
});

/* ══ setLimitesInteracParClient ═══════════════════════════════════ */
describe("setLimitesInteracParClient", () => {
  it("retourne false si aucun utilisateur lie au client", async () => {
    mockQuery.mockResolvedValueOnce([[]]); // ucRows vide
    const result = await setLimitesInteracParClient(99, { limite_24h: 1000, limite_7j: null, limite_30j: null });
    expect(result).toBe(false);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("met a jour les limites et retourne true", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ utilisateur_id: 7 }]]) // SELECT uc
      .mockResolvedValueOnce([{ affectedRows: 1 }]);     // UPDATE
    const result = await setLimitesInteracParClient(10, { limite_24h: 2000, limite_7j: 8000, limite_30j: null });
    expect(result).toBe(true);
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[1]).toContain(7); // userId
    expect(updateCall[0]).toContain("UPDATE utilisateurs");
  });

  it("utilise null pour les limites non fournies (undefined → null)", async () => {
    mockQuery
      .mockResolvedValueOnce([[{ utilisateur_id: 7 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    // Aucune limite passée → toutes undefined → fallback null dans la requête
    const result = await setLimitesInteracParClient(10, {});
    expect(result).toBe(true);
    const updateCall = mockQuery.mock.calls[1];
    expect(updateCall[1]).toEqual([null, null, null, 7]);
  });
});

/* ══ getLimitesInteracParUtilisateur ══════════════════════════════ */
describe("getLimitesInteracParUtilisateur", () => {
  it("retourne les limites personnalisees de l'utilisateur", async () => {
    const row = { limite_24h: 1000, limite_7j: 5000, limite_30j: null };
    mockQuery.mockResolvedValueOnce([[row]]);
    const result = await getLimitesInteracParUtilisateur(7);
    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [7]);
  });

  it("retourne les nulls si aucune personnalisation (valeurs globales)", async () => {
    const row = { limite_24h: null, limite_7j: null, limite_30j: null };
    mockQuery.mockResolvedValueOnce([[row]]);
    const result = await getLimitesInteracParUtilisateur(1);
    expect(result).toEqual({ limite_24h: null, limite_7j: null, limite_30j: null });
  });

  it("retourne des nulls par defaut si aucune ligne trouvee", async () => {
    mockQuery.mockResolvedValueOnce([[]]); // rows vide → rows[0] undefined → ?? fallback
    const result = await getLimitesInteracParUtilisateur(999);
    expect(result).toEqual({ limite_24h: null, limite_7j: null, limite_30j: null });
  });
});
