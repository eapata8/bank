import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function lireSql(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), "utf8");
}

async function executerMulti(connection, sql) {
  await connection.query(sql);
}

async function ensureConfiguredAdmin(connection) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log("Aucun admin de configuration defini (ADMIN_EMAIL / ADMIN_PASSWORD).");
    return;
  }

  const adminPrenom = process.env.ADMIN_PRENOM || "Admin";
  const adminNom = process.env.ADMIN_NOM || "Config";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const [rows] = await connection.query("SELECT id FROM utilisateurs WHERE email = ? LIMIT 1", [adminEmail]);

  if (rows.length > 0) {
    await connection.query(
      `UPDATE utilisateurs
       SET mot_de_passe_hash = ?, role = 'ADMIN', prenom = ?, nom = ?
       WHERE id = ?`,
      [passwordHash, adminPrenom, adminNom, rows[0].id]
    );
    console.log(`Admin mis a jour via config : ${adminEmail}`);
    return;
  }

  await connection.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, prenom, nom)
     VALUES (?, ?, 'ADMIN', ?, ?)`,
    [adminEmail, passwordHash, adminPrenom, adminNom]
  );

  console.log(`Admin cree via config : ${adminEmail}`);
}

(async () => {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    const schema = lireSql("schema.sql");
    const seed = lireSql("seed.sql");

    console.log("Execution schema.sql ...");
    await executerMulti(connection, schema);

    console.log("Execution seed.sql ...");
    await executerMulti(connection, seed);

    console.log("Verification admin de configuration ...");
    await ensureConfiguredAdmin(connection);

    // ── Snapshots initiaux par client ─────────────────────────────────────────
    console.log("Création des snapshots initiaux par client...");
    const [admins] = await connection.query(
      "SELECT MIN(id) AS id FROM utilisateurs WHERE role = 'ADMIN'"
    );
    const adminId = admins[0].id;

    if (adminId) {
      const [allClients] = await connection.query("SELECT id FROM clients");

      const CLIENT_TABLES = [
        "clients", "comptes", "transactions", "virements", "factures",
        "cartes_credit", "depots_cheques", "retraits", "transactions_recurrentes",
        "interac_beneficiaires", "interac_autodeposit",
      ];

      for (const client of allClients) {
        const clientId = client.id;

        const [compteRows] = await connection.query(
          "SELECT id FROM comptes WHERE client_id = ?", [clientId]
        );
        const compteIds = compteRows.map(c => c.id);

        const [ucRows] = await connection.query(
          "SELECT utilisateur_id FROM utilisateurs_clients WHERE client_id = ?", [clientId]
        );
        const utilisateurIds = ucRows.map(r => r.utilisateur_id);

        const [snapRes] = await connection.query(
          "INSERT INTO simulation_snapshots (nom, description, est_initial, cree_par, client_id) VALUES (?, ?, 1, ?, ?)",
          ["État initial (seed)", "Données de démonstration — état initial non supprimable", adminId, clientId]
        );
        const snapshotId = snapRes.insertId;

        const queries = {
          clients:                  ["SELECT * FROM clients WHERE id = ?", [clientId]],
          comptes:                  ["SELECT * FROM comptes WHERE client_id = ?", [clientId]],
          transactions:             compteIds.length ? ["SELECT * FROM transactions WHERE compte_id IN (?)", [compteIds]] : null,
          virements:                compteIds.length ? ["SELECT * FROM virements WHERE compte_source_id IN (?) OR compte_destination_id IN (?)", [compteIds, compteIds]] : null,
          factures:                 ["SELECT * FROM factures WHERE client_id = ?", [clientId]],
          cartes_credit:            ["SELECT * FROM cartes_credit WHERE client_id = ?", [clientId]],
          depots_cheques:           ["SELECT * FROM depots_cheques WHERE client_id = ?", [clientId]],
          retraits:                 ["SELECT * FROM retraits WHERE client_id = ?", [clientId]],
          transactions_recurrentes: compteIds.length ? ["SELECT * FROM transactions_recurrentes WHERE compte_source_id IN (?) OR compte_destination_id IN (?)", [compteIds, compteIds]] : null,
          interac_beneficiaires:    utilisateurIds.length ? ["SELECT * FROM interac_beneficiaires WHERE utilisateur_id IN (?)", [utilisateurIds]] : null,
          interac_autodeposit:      utilisateurIds.length ? ["SELECT * FROM interac_autodeposit WHERE utilisateur_id IN (?)", [utilisateurIds]] : null,
        };

        for (const tableName of CLIENT_TABLES) {
          const q = queries[tableName];
          const rows = q ? (await connection.query(q[0], q[1]))[0] : [];
          await connection.query(
            "INSERT INTO simulation_snapshot_data (snapshot_id, table_name, data_json) VALUES (?, ?, ?)",
            [snapshotId, tableName, JSON.stringify(rows)]
          );
        }
        console.log(`  ✓ Snapshot initial client #${clientId}`);
      }
      console.log("✓ Snapshots initiaux créés");
    }

    console.log(`DB prete : ${DB_NAME}`);
  } catch (err) {
    console.error("Erreur init DB:", err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
})();
