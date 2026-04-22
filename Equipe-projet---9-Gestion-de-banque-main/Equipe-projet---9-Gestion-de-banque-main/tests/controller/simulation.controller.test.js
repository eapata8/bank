import { jest } from "@jest/globals";

// ─── Mocks des dépendances ────────────────────────────────────────────────────

const mockCaptureSnapshot    = jest.fn();
const mockFindSnapshots      = jest.fn();
const mockFindSnapshotById   = jest.fn();
const mockRestaurerSnapshot  = jest.fn().mockResolvedValue(undefined);
const mockDeleteSnapshot     = jest.fn().mockResolvedValue(undefined);
const mockCreateAuditLog     = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule("../../server/data/simulation.data.js", () => ({
  captureSnapshot:   mockCaptureSnapshot,
  findSnapshots:     mockFindSnapshots,
  findSnapshotById:  mockFindSnapshotById,
  restaurerSnapshot: mockRestaurerSnapshot,
  deleteSnapshot:    mockDeleteSnapshot,
}));

await jest.unstable_mockModule("../../server/data/audit.data.js", () => ({
  createAuditLog: mockCreateAuditLog,
}));

const ctrl = await import("../../server/controllers/simulation.controller.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json   = jest.fn().mockReturnThis();
  return res;
}

function mockReq(overrides = {}) {
  return {
    session: { user: { id: 1, role: "ADMIN" } },
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRestaurerSnapshot.mockResolvedValue(undefined);
  mockDeleteSnapshot.mockResolvedValue(undefined);
  mockCreateAuditLog.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// getSnapshots
// ─────────────────────────────────────────────────────────────────────────────

describe("getSnapshots", () => {
  // Validation de clientId : couverte par le middleware validateClientIdQuery.

  it("retourne 200 avec la liste des snapshots du client", async () => {
    const rows = [
      { id: 1, nom: "État initial", est_initial: 1, client_id: 3 },
      { id: 2, nom: "Snap A",       est_initial: 0, client_id: 3 },
    ];
    mockFindSnapshots.mockResolvedValueOnce(rows);

    const req = mockReq({ query: { clientId: "3" } });
    const res = mockRes();

    await ctrl.getSnapshots(req, res);

    expect(mockFindSnapshots).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith({ data: rows });
  });

  it("retourne 200 avec un tableau vide si aucun snapshot", async () => {
    mockFindSnapshots.mockResolvedValueOnce([]);

    const req = mockReq({ query: { clientId: "5" } });
    const res = mockRes();

    await ctrl.getSnapshots(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: [] });
  });

  it("retourne 500 si la base de données lève une erreur", async () => {
    mockFindSnapshots.mockRejectedValueOnce(new Error("DB error"));

    const req = mockReq({ query: { clientId: "3" } });
    const res = mockRes();

    await ctrl.getSnapshots(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("createSnapshot", () => {
  // Validation des champs (clientId, nom, longueur) : couverte par le middleware validateCreateSnapshot.

  it("retourne 201 avec message et id en cas de succès", async () => {
    mockCaptureSnapshot.mockResolvedValueOnce({ insertId: 9 });

    const req = mockReq({ body: { clientId: 3, nom: "Snapshot Test", description: "desc" } });
    const res = mockRes();

    await ctrl.createSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String), id: 9 })
    );
  });

  it("appelle captureSnapshot avec le bon clientId et estInitial=false", async () => {
    mockCaptureSnapshot.mockResolvedValueOnce({ insertId: 5 });

    const req = mockReq({ body: { clientId: 7, nom: "Mon snap" } });
    const res = mockRes();

    await ctrl.createSnapshot(req, res);

    expect(mockCaptureSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 7, estInitial: false, creePar: 1 })
    );
  });

  it("crée un log d'audit SIMULATION_SNAPSHOT_CREE en cas de succès", async () => {
    mockCaptureSnapshot.mockResolvedValueOnce({ insertId: 10 });

    const req = mockReq({ body: { clientId: 3, nom: "Snap Audit" } });
    const res = mockRes();

    await ctrl.createSnapshot(req, res);

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SIMULATION_SNAPSHOT_CREE" })
    );
  });

  it("retourne 500 si captureSnapshot lève une erreur", async () => {
    mockCaptureSnapshot.mockRejectedValueOnce(new Error("DB failed"));

    const req = mockReq({ body: { clientId: 3, nom: "Snap" } });
    const res = mockRes();

    await ctrl.createSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 500 si createAuditLog lève une erreur", async () => {
    mockCaptureSnapshot.mockResolvedValueOnce({ insertId: 11 });
    mockCreateAuditLog.mockRejectedValueOnce(new Error("Audit fail"));

    const req = mockReq({ body: { clientId: 3, nom: "Snap Audit Error" } });
    const res = mockRes();

    await ctrl.createSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// restaurerSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("restaurerSnapshot", () => {
  it("retourne 404 si le snapshot est introuvable", async () => {
    mockFindSnapshotById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();

    await ctrl.restaurerSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockRestaurerSnapshot).not.toHaveBeenCalled();
  });

  it("retourne 200 et crée un audit log en cas de succès", async () => {
    const snap = { id: 3, nom: "Snap B", est_initial: 0, client_id: 5 };
    mockFindSnapshotById.mockResolvedValueOnce(snap);

    const req = mockReq({ params: { id: "3" } });
    const res = mockRes();

    await ctrl.restaurerSnapshot(req, res);

    expect(mockRestaurerSnapshot).toHaveBeenCalledWith(3);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SIMULATION_RESTAURATION" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Snap B") })
    );
  });

  it("fonctionne aussi sur le snapshot initial", async () => {
    const snap = { id: 1, nom: "État initial", est_initial: 1, client_id: 2 };
    mockFindSnapshotById.mockResolvedValueOnce(snap);

    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.restaurerSnapshot(req, res);

    expect(mockRestaurerSnapshot).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("État initial") })
    );
  });

  it("retourne 500 si restaurerSnapshot lève une erreur", async () => {
    mockFindSnapshotById.mockResolvedValueOnce({ id: 2, nom: "X", client_id: 1 });
    mockRestaurerSnapshot.mockRejectedValueOnce(new Error("Restore failed"));

    const req = mockReq({ params: { id: "2" } });
    const res = mockRes();

    await ctrl.restaurerSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 500 si findSnapshotById lève une erreur", async () => {
    mockFindSnapshotById.mockRejectedValueOnce(new Error("DB error"));

    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.restaurerSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteSnapshot", () => {
  it("retourne 404 si le snapshot est introuvable", async () => {
    mockFindSnapshotById.mockResolvedValueOnce(null);

    const req = mockReq({ params: { id: "99" } });
    const res = mockRes();

    await ctrl.deleteSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDeleteSnapshot).not.toHaveBeenCalled();
  });

  it("retourne 403 si c'est le snapshot initial", async () => {
    mockFindSnapshotById.mockResolvedValueOnce({ id: 1, nom: "État initial", est_initial: 1, client_id: 2 });

    const req = mockReq({ params: { id: "1" } });
    const res = mockRes();

    await ctrl.deleteSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockDeleteSnapshot).not.toHaveBeenCalled();
  });

  it("retourne 200 et crée un audit log en cas de succès", async () => {
    mockFindSnapshotById.mockResolvedValueOnce({ id: 5, nom: "Snap C", est_initial: 0, client_id: 3 });

    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.deleteSnapshot(req, res);

    expect(mockDeleteSnapshot).toHaveBeenCalledWith(5);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SIMULATION_SNAPSHOT_SUPPRIME" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("supprimé") })
    );
  });

  it("retourne 500 si deleteSnapshot lève une erreur", async () => {
    mockFindSnapshotById.mockResolvedValueOnce({ id: 5, nom: "Snap C", est_initial: 0, client_id: 3 });
    mockDeleteSnapshot.mockRejectedValueOnce(new Error("Delete failed"));

    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.deleteSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("retourne 500 si findSnapshotById lève une erreur", async () => {
    mockFindSnapshotById.mockRejectedValueOnce(new Error("DB error"));

    const req = mockReq({ params: { id: "5" } });
    const res = mockRes();

    await ctrl.deleteSnapshot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
