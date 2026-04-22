/**
 * @fileoverview Couche d'accès aux données pour le mode simulation (par client).
 *
 * Permet à un admin de capturer l'état des données d'un client spécifique
 * (comptes, transactions, virements, factures, cartes, etc.) dans un snapshot nommé,
 * puis de restaurer cet état à tout moment sans affecter les autres clients.
 *
 * Exclusions du snapshot : `utilisateurs`, `audit_logs`, `sessions`,
 * `utilisateurs_clients`, `interac_autodeposit`, `interac_beneficiaires`,
 * `simulation_snapshots`, `simulation_snapshot_data`.
 *
 * @module data/simulation
 */

import db from "../db.js";

/**
 * Tables capturées par snapshot (données financières d'un client).
 */
export const CLIENT_SNAPSHOT_TABLES = [
  "clients",
  "comptes",
  "transactions",
  "virements",
  "factures",
  "cartes_credit",
  "depots_cheques",
  "retraits",
  "transactions_recurrentes",
  "interac_beneficiaires",
  "interac_autodeposit",
];

/**
 * Collecte les données d'un client pour toutes les tables.
 * @private
 */
async function collectClientData(clientId) {
  const [compteRows] = await db.query(
    "SELECT id FROM comptes WHERE client_id = ?",
    [clientId]
  );
  const compteIds = compteRows.map(c => c.id);

  const data = {};

  const [clients] = await db.query("SELECT * FROM clients WHERE id = ?", [clientId]);
  data.clients = clients;

  const [comptes] = await db.query("SELECT * FROM comptes WHERE client_id = ?", [clientId]);
  data.comptes = comptes;

  if (compteIds.length > 0) {
    const [transactions] = await db.query(
      "SELECT * FROM transactions WHERE compte_id IN (?)", [compteIds]
    );
    data.transactions = transactions;
  } else {
    data.transactions = [];
  }

  if (compteIds.length > 0) {
    const [virements] = await db.query(
      "SELECT * FROM virements WHERE compte_source_id IN (?) OR compte_destination_id IN (?)",
      [compteIds, compteIds]
    );
    data.virements = virements;
  } else {
    data.virements = [];
  }

  const [factures] = await db.query("SELECT * FROM factures WHERE client_id = ?", [clientId]);
  data.factures = factures;

  const [cartes] = await db.query("SELECT * FROM cartes_credit WHERE client_id = ?", [clientId]);
  data.cartes_credit = cartes;

  const [depots] = await db.query("SELECT * FROM depots_cheques WHERE client_id = ?", [clientId]);
  data.depots_cheques = depots;

  const [retraits] = await db.query("SELECT * FROM retraits WHERE client_id = ?", [clientId]);
  data.retraits = retraits;

  if (compteIds.length > 0) {
    const [recurrentes] = await db.query(
      "SELECT * FROM transactions_recurrentes WHERE compte_source_id IN (?) OR compte_destination_id IN (?)",
      [compteIds, compteIds]
    );
    data.transactions_recurrentes = recurrentes;
  } else {
    data.transactions_recurrentes = [];
  }

  // interac_beneficiaires + interac_autodeposit — liés aux utilisateurs du client
  const [ucRows] = await db.query(
    "SELECT utilisateur_id FROM utilisateurs_clients WHERE client_id = ?",
    [clientId]
  );
  const utilisateurIds = ucRows.map(r => r.utilisateur_id);
  if (utilisateurIds.length > 0) {
    const [beneficiaires] = await db.query(
      "SELECT * FROM interac_beneficiaires WHERE utilisateur_id IN (?)",
      [utilisateurIds]
    );
    data.interac_beneficiaires = beneficiaires;

    const [autodeposit] = await db.query(
      "SELECT * FROM interac_autodeposit WHERE utilisateur_id IN (?)",
      [utilisateurIds]
    );
    data.interac_autodeposit = autodeposit;
  } else {
    data.interac_beneficiaires = [];
    data.interac_autodeposit = [];
  }

  return data;
}

/**
 * Capture l'état courant des données d'un client dans un nouveau snapshot.
 *
 * @async
 * @param {Object} params
 * @param {string}  params.nom           - Nom du snapshot.
 * @param {string}  [params.description] - Description optionnelle.
 * @param {number}  params.creePar       - Id de l'admin créateur.
 * @param {number}  params.clientId      - Id du client à capturer.
 * @param {boolean} [params.estInitial=false] - true pour le snapshot protégé seed.
 * @returns {Promise<import("mysql2").ResultSetHeader>}
 */
export async function captureSnapshot({ nom, description, creePar, clientId, estInitial = false }) {
  const [snapResult] = await db.query(
    `INSERT INTO simulation_snapshots (nom, description, est_initial, cree_par, client_id)
     VALUES (?, ?, ?, ?, ?)`,
    [nom, description || null, estInitial ? 1 : 0, creePar, clientId]
  );
  const snapshotId = snapResult.insertId;

  const tableData = await collectClientData(clientId);

  for (const tableName of CLIENT_SNAPSHOT_TABLES) {
    // collectClientData garantit que toutes les clés de CLIENT_SNAPSHOT_TABLES
    // sont présentes (tableau vide si rien à sauvegarder), donc pas de défaut nécessaire.
    const rows = tableData[tableName];
    await db.query(
      "INSERT INTO simulation_snapshot_data (snapshot_id, table_name, data_json) VALUES (?, ?, ?)",
      [snapshotId, tableName, JSON.stringify(rows)]
    );
  }

  return snapResult;
}

/**
 * Retourne la liste des snapshots d'un client, du plus récent au plus ancien.
 *
 * @async
 * @param {number} clientId
 * @returns {Promise<Array>}
 */
export async function findSnapshots(clientId) {
  const [rows] = await db.query(
    `SELECT s.id, s.nom, s.description, s.est_initial, s.cree_par, s.client_id, s.cree_le,
            u.email AS cree_par_email
     FROM simulation_snapshots s
     JOIN utilisateurs u ON u.id = s.cree_par
     WHERE s.client_id = ?
     ORDER BY s.est_initial DESC, s.cree_le DESC`,
    [clientId]
  );
  return rows;
}

/**
 * Retourne un snapshot par son identifiant.
 *
 * @async
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function findSnapshotById(id) {
  const [rows] = await db.query(
    `SELECT id, nom, description, est_initial, cree_par, client_id, cree_le
     FROM simulation_snapshots WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Restaure les données d'un client à l'état capturé dans un snapshot.
 *
 * @async
 * @param {number} id - Id du snapshot à restaurer.
 * @returns {Promise<void>}
 */
export async function restaurerSnapshot(id) {
  // Récupérer client_id depuis le snapshot
  const [snapRows] = await db.query(
    "SELECT client_id FROM simulation_snapshots WHERE id = ?",
    [id]
  );
  if (!snapRows[0]) {
    throw new Error(`Snapshot #${id} introuvable`);
  }
  const clientId = snapRows[0].client_id;

  // Charger les données sauvegardées
  const [dataRows] = await db.query(
    "SELECT table_name, data_json FROM simulation_snapshot_data WHERE snapshot_id = ?",
    [id]
  );

  const tableData = {};
  for (const row of dataRows) {
    tableData[row.table_name] = JSON.parse(row.data_json);
  }

  // IDs de comptes sauvegardés (pour cibler les DELETE)
  const savedCompteIds = (tableData.comptes ?? []).map(c => c.id);

  const conn = await db.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();

    // Supprimer dans l'ordre inverse des dépendances FK
    if (savedCompteIds.length > 0) {
      await conn.query(
        "DELETE FROM transactions_recurrentes WHERE compte_source_id IN (?) OR compte_destination_id IN (?)",
        [savedCompteIds, savedCompteIds]
      );
      await conn.query(
        "DELETE FROM virements WHERE compte_source_id IN (?) OR compte_destination_id IN (?)",
        [savedCompteIds, savedCompteIds]
      );
      await conn.query(
        "DELETE FROM transactions WHERE compte_id IN (?)",
        [savedCompteIds]
      );
    }
    // Récupérer les utilisateur_ids liés à ce client pour nettoyer interac
    const [ucRows] = await conn.query(
      "SELECT utilisateur_id FROM utilisateurs_clients WHERE client_id = ?",
      [clientId]
    );
    const utilisateurIds = ucRows.map(r => r.utilisateur_id);
    if (utilisateurIds.length > 0) {
      await conn.query(
        "DELETE FROM interac_beneficiaires WHERE utilisateur_id IN (?)",
        [utilisateurIds]
      );
      await conn.query(
        "DELETE FROM interac_autodeposit WHERE utilisateur_id IN (?)",
        [utilisateurIds]
      );
    }

    await conn.query("DELETE FROM depots_cheques WHERE client_id = ?", [clientId]);
    await conn.query("DELETE FROM retraits WHERE client_id = ?",       [clientId]);
    await conn.query("DELETE FROM factures WHERE client_id = ?",       [clientId]);
    await conn.query("DELETE FROM cartes_credit WHERE client_id = ?",  [clientId]);
    await conn.query("DELETE FROM comptes WHERE client_id = ?",        [clientId]);
    await conn.query("DELETE FROM clients WHERE id = ?",               [clientId]);

    // Insérer dans l'ordre FK (parents avant enfants)
    const insertRows = async (tableName, rows) => {
      if (!rows || rows.length === 0) return;
      const columns = Object.keys(rows[0]);
      const placeholders = rows
        .map(() => `(${columns.map(() => "?").join(", ")})`)
        .join(", ");
      // MySQL2 retourne `null` (jamais `undefined`) et JSON.stringify/parse préserve
      // les `null`, donc toutes les colonnes sont présentes après désérialisation.
      const values = rows.flatMap(row => columns.map(col => row[col]));
      await conn.query(
        `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(", ")}) VALUES ${placeholders}`,
        values
      );
    };

    await insertRows("clients",                  tableData.clients);
    await insertRows("comptes",                  tableData.comptes);
    await insertRows("transactions",             tableData.transactions);
    await insertRows("virements",                tableData.virements);
    await insertRows("factures",                 tableData.factures);
    await insertRows("cartes_credit",            tableData.cartes_credit);
    await insertRows("depots_cheques",           tableData.depots_cheques);
    await insertRows("retraits",                 tableData.retraits);
    await insertRows("transactions_recurrentes", tableData.transactions_recurrentes);
    await insertRows("interac_beneficiaires",    tableData.interac_beneficiaires);
    await insertRows("interac_autodeposit",      tableData.interac_autodeposit);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    conn.release();
  }
}

/**
 * Supprime un snapshot (interdit sur le snapshot initial).
 *
 * @async
 * @param {number} id
 * @returns {Promise<import("mysql2").ResultSetHeader>}
 */
export async function deleteSnapshot(id) {
  const [result] = await db.query(
    "DELETE FROM simulation_snapshots WHERE id = ? AND est_initial = 0",
    [id]
  );
  return result;
}
