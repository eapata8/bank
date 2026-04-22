/**
 * @fileoverview Contrôleur pour le mode simulation (snapshots / restauration par client).
 *
 * Permet à un administrateur de sauvegarder et restaurer les données d'un client
 * spécifique (comptes, transactions, virements, etc.) pour effectuer des tests
 * ou démonstrations sans craindre de perdre les données.
 *
 * Toutes les routes nécessitent le rôle ADMIN.
 *
 * @module controllers/simulation
 */

import {
  captureSnapshot,
  findSnapshots,
  findSnapshotById,
  restaurerSnapshot as dbRestaurerSnapshot,
  deleteSnapshot as dbDeleteSnapshot,
} from "../data/simulation.data.js";
import { createAuditLog } from "../data/audit.data.js";

/**
 * Retourne la liste des snapshots d'un client.
 *
 * @async
 * @route GET /api/simulation/snapshots?clientId=X
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 { data: [...] } | 400 | 500
 */
export const getSnapshots = async (req, res) => {
  try {
    // Validation effectuée par le middleware validateClientIdQuery.
    const clientId = Number(req.query.clientId);
    const rows = await findSnapshots(clientId);
    return res.json({ data: rows });
  } catch {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Crée un nouveau snapshot pour un client.
 *
 * @async
 * @route POST /api/simulation/snapshots
 * @param {import("express").Request}  req - Corps : { clientId, nom, description? }
 * @param {import("express").Response} res - 201 { message, id } | 400 | 500
 */
export const createSnapshot = async (req, res) => {
  try {
    const userId   = req.session.user.id;
    const userRole = req.session.user.role;
    const { clientId, nom, description } = req.body;
    // Validation : middleware validateCreateSnapshot.
    const nomTrim = String(nom).trim();

    const result = await captureSnapshot({
      nom:         nomTrim,
      description: description ? String(description).trim() : null,
      creePar:     userId,
      clientId:    Number(clientId),
      estInitial:  false,
    });

    await createAuditLog({
      utilisateurId:   userId,
      roleUtilisateur: userRole,
      action:          "SIMULATION_SNAPSHOT_CREE",
      details:         `Snapshot #${result.insertId} — "${nomTrim}" (client #${clientId})`,
    });

    return res.status(201).json({
      message: `Snapshot "${nomTrim}" créé avec succès`,
      id:      result.insertId,
    });
  } catch {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Restaure les données d'un client à l'état d'un snapshot existant.
 *
 * @async
 * @route POST /api/simulation/snapshots/:id/restaurer
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 | 404 | 500
 */
export const restaurerSnapshot = async (req, res) => {
  try {
    const userId   = req.session.user.id;
    const userRole = req.session.user.role;
    const { id }   = req.params;

    const snapshot = await findSnapshotById(Number(id));
    if (!snapshot) {
      return res.status(404).json({ message: "Snapshot introuvable" });
    }

    await dbRestaurerSnapshot(Number(id));

    await createAuditLog({
      utilisateurId:   userId,
      roleUtilisateur: userRole,
      action:          "SIMULATION_RESTAURATION",
      details:         `Restauration vers snapshot #${id} — "${snapshot.nom}" (client #${snapshot.client_id})`,
    });

    return res.json({ message: `Données restaurées vers "${snapshot.nom}"` });
  } catch {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/**
 * Supprime un snapshot (interdit sur le snapshot initial).
 *
 * @async
 * @route DELETE /api/simulation/snapshots/:id
 * @param {import("express").Request}  req
 * @param {import("express").Response} res - 200 | 403 | 404 | 500
 */
export const deleteSnapshot = async (req, res) => {
  try {
    const userId   = req.session.user.id;
    const userRole = req.session.user.role;
    const { id }   = req.params;

    const snapshot = await findSnapshotById(Number(id));
    if (!snapshot) {
      return res.status(404).json({ message: "Snapshot introuvable" });
    }

    if (snapshot.est_initial) {
      return res.status(403).json({
        message: "Le snapshot initial ne peut pas être supprimé",
      });
    }

    await dbDeleteSnapshot(Number(id));

    await createAuditLog({
      utilisateurId:   userId,
      roleUtilisateur: userRole,
      action:          "SIMULATION_SNAPSHOT_SUPPRIME",
      details:         `Snapshot #${id} — "${snapshot.nom}" supprimé (client #${snapshot.client_id})`,
    });

    return res.json({ message: "Snapshot supprimé" });
  } catch {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

export default { getSnapshots, createSnapshot, restaurerSnapshot, deleteSnapshot };
