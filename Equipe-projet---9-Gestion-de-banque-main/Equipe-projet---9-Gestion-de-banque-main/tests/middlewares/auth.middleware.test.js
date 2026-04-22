import { jest } from "@jest/globals";
import authMiddleware, { requireAdmin, requireElevated, requireNotModerator, isElevated } from "../../server/middlewares/auth.middleware.js";

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
}

describe("Auth Middleware", () => {
  it("retourne 401 si pas de session", () => {
    const req = { session: null };
    const res = mockRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Non autorise" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 401 si session sans user", () => {
    const req = { session: {} };
    const res = mockRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("appelle next() si session.user present", () => {
    const req = { session: { user: { id: 1, email: "u@n.local" } } };
    const res = mockRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requireAdmin retourne 403 si l'utilisateur n'est pas admin", () => {
    const req = { session: { user: { id: 1, role: "MODERATEUR" } } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Acces reserve a l'administrateur" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin appelle next() pour un admin", () => {
    const req = { session: { user: { id: 1, role: "ADMIN" } } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("requireElevated retourne 403 pour un UTILISATEUR", () => {
    const req = { session: { user: { id: 1, role: "UTILISATEUR" } } };
    const res = mockRes();
    const next = jest.fn();
    requireElevated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("requireElevated appelle next() pour un MODERATEUR", () => {
    const req = { session: { user: { id: 2, role: "MODERATEUR" } } };
    const res = mockRes();
    const next = jest.fn();
    requireElevated(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("requireElevated appelle next() pour un ADMIN", () => {
    const req = { session: { user: { id: 3, role: "ADMIN" } } };
    const res = mockRes();
    const next = jest.fn();
    requireElevated(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("requireElevated retourne 401 si pas de session", () => {
    const req = { session: null };
    const res = mockRes();
    const next = jest.fn();
    requireElevated(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  /* ── requireNotModerator ───────────────────────── */

  it("requireNotModerator retourne 401 si pas de session", () => {
    const req = { session: null };
    const res = mockRes();
    const next = jest.fn();
    requireNotModerator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("requireNotModerator retourne 403 si l'utilisateur est MODERATEUR", () => {
    const req = { session: { user: { id: 2, role: "MODERATEUR" } } };
    const res = mockRes();
    const next = jest.fn();
    requireNotModerator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Acces refuse aux moderateurs" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireNotModerator appelle next() pour un UTILISATEUR", () => {
    const req = { session: { user: { id: 1, role: "UTILISATEUR" } } };
    const res = mockRes();
    const next = jest.fn();
    requireNotModerator(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requireNotModerator appelle next() pour un ADMIN", () => {
    const req = { session: { user: { id: 3, role: "ADMIN" } } };
    const res = mockRes();
    const next = jest.fn();
    requireNotModerator(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requireAdmin retourne 403 pour un UTILISATEUR", () => {
    const req = { session: { user: { id: 4, role: "UTILISATEUR" } } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin retourne 401 si session sans user", () => {
    const req = { session: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  /* ── isElevated ────────────────────────────────── */

  it("isElevated retourne true pour ADMIN", () => {
    expect(isElevated({ role: "ADMIN" })).toBe(true);
  });

  it("isElevated retourne true pour MODERATEUR", () => {
    expect(isElevated({ role: "MODERATEUR" })).toBe(true);
  });

  it("isElevated retourne false pour UTILISATEUR", () => {
    expect(isElevated({ role: "UTILISATEUR" })).toBe(false);
  });

  it("isElevated retourne false pour un role inconnu", () => {
    expect(isElevated({ role: "SUPERADMIN" })).toBe(false);
  });
});
