/**
 * @fileoverview Scheduler — exécution automatique des transactions récurrentes échus.
 *
 * Ce module est appelé toutes les heures depuis server/index.js via setInterval.
 * Il identifie les transactions récurrentes ACTIVE dont la prochaine_execution
 * est aujourd'hui ou dans le passé, puis tente d'exécuter le virement correspondant.
 *
 * Chaque virement est exécuté dans une transaction DB atomique (BEGIN/COMMIT/ROLLBACK) :
 *  - Le débit est effectué avec un UPDATE atomique (solde >= montant) pour éviter
 *    les race conditions avec des débits concurrents sur le même compte.
 *  - Si la transaction échoue à mi-chemin, le ROLLBACK restaure l'état cohérent.
 *
 * Comportement en cas d'échec (solde insuffisant) :
 *  - Incrémente nb_echecs
 *  - Si nb_echecs >= 3 : passe le statut à SUSPENDUE automatiquement
 *  - Avance quand même prochaine_execution pour ne pas re-tenter le même jour
 *
 * Comportement en cas de succès :
 *  - Débite le compte source et crédite le compte destination (atomiquement)
 *  - Crée les deux transactions miroir dans l'historique
 *  - Met à jour derniere_execution, prochaine_execution, nb_echecs = 0
 *  - Si prochaine_execution > date_fin : passe le statut à TERMINEE
 *
 * @module server/scheduler
 */

import db from "./db.js";
import {
  findRecurrentesEchues,
  updateApresExecution,
} from "./data/recurrentes.data.js";
import { createAuditLog } from "./data/audit.data.js";
import { calculerProchaine } from "./controllers/recurrentes.controller.js";

/**
 * Exécute toutes les transactions récurrentes échues.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function executerTransactionsRecurrentes() {
  let dues;
  try {
    dues = await findRecurrentesEchues();
  } catch (err) {
    console.error("[Scheduler] Erreur lors de la récupération des récurrentes :", err.message);
    return;
  }

  if (dues.length === 0) return;

  console.log(`[Scheduler] ${dues.length} transaction(s) récurrente(s) à exécuter.`);

  const today = new Date().toISOString().slice(0, 10);

  for (const rec of dues) {
    const prochaine = calculerProchaine(rec.frequence, today);

    // ─── Vérification préliminaire du solde (évite une transaction inutile) ──
    if (Number(rec.solde_source) < Number(rec.montant)) {
      const nouveauNbEchecs = rec.nb_echecs + 1;
      const nouveauStatut = nouveauNbEchecs >= 3 ? "SUSPENDUE" : "ACTIVE";

      try {
        await updateApresExecution(rec.id, {
          derniere_execution: today,
          prochaine_execution: prochaine,
          nb_echecs: nouveauNbEchecs,
          statut: nouveauStatut,
        });

        await createAuditLog({
          utilisateurId: rec.utilisateur_id,
          roleUtilisateur: "UTILISATEUR",
          action: "RECURRENTE_ECHEC",
          details: `Recurrente #${rec.id} — echec ${nouveauNbEchecs}/3 — solde insuffisant${nouveauStatut === "SUSPENDUE" ? " — suspendue automatiquement" : ""}`,
        });

        console.log(`[Scheduler] Récurrente #${rec.id} : échec (${nouveauNbEchecs}/3)${nouveauStatut === "SUSPENDUE" ? " — suspendue" : ""}`);
      } catch (err) {
        console.error(`[Scheduler] Erreur lors de la mise à jour de la récurrente #${rec.id} :`, err.message);
      }
      continue;
    }

    // ─── Exécution atomique du virement dans une transaction DB ───────────────
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Débit atomique : si le solde a changé entre la lecture et maintenant,
      // l'UPDATE échoue (affectedRows = 0) → rollback propre
      const [debitResult] = await conn.query(
        "UPDATE comptes SET solde = solde - ? WHERE id = ? AND solde >= ?",
        [rec.montant, rec.compte_source_id, rec.montant]
      );

      if (debitResult.affectedRows === 0) {
        // Race condition : le solde est devenu insuffisant entre la lecture et l'UPDATE
        await conn.rollback();
        // Ne pas appeler conn.release() ici — le finally s'en charge toujours

        const nouveauNbEchecs = rec.nb_echecs + 1;
        const nouveauStatut = nouveauNbEchecs >= 3 ? "SUSPENDUE" : "ACTIVE";
        await updateApresExecution(rec.id, {
          derniere_execution: today,
          prochaine_execution: prochaine,
          nb_echecs: nouveauNbEchecs,
          statut: nouveauStatut,
        });
        await createAuditLog({
          utilisateurId: rec.utilisateur_id,
          roleUtilisateur: "UTILISATEUR",
          action: "RECURRENTE_ECHEC",
          details: `Recurrente #${rec.id} — echec ${nouveauNbEchecs}/3 — solde insuffisant (race condition)${nouveauStatut === "SUSPENDUE" ? " — suspendue" : ""}`,
        });
        console.log(`[Scheduler] Récurrente #${rec.id} : échec race condition (${nouveauNbEchecs}/3)`);
        continue; // finally libère conn avant de passer à l'itération suivante
      }

      // Crédit destination
      await conn.query(
        "UPDATE comptes SET solde = solde + ? WHERE id = ?",
        [rec.montant, rec.compte_destination_id]
      );

      // Transactions miroir
      const desc = rec.description || `Virement recurrent #${rec.id}`;
      await conn.query(
        `INSERT INTO transactions (compte_id, type_transaction, description, montant, statut, date_transaction)
         VALUES (?, 'VIREMENT', ?, ?, 'TERMINEE', NOW()),
                (?, 'VIREMENT', ?, ?, 'TERMINEE', NOW())`,
        [rec.compte_source_id, `${desc} (sortant)`, -rec.montant,
         rec.compte_destination_id, `${desc} (entrant)`, rec.montant]
      );

      // Déterminer si la récurrente est terminée (avant le commit)
      let nouveauStatut = "ACTIVE";
      if (rec.date_fin) {
        const dateFin = String(rec.date_fin).slice(0, 10);
        if (prochaine > dateFin) nouveauStatut = "TERMINEE";
      }

      // Mise à jour de la récurrente DANS la transaction : si ça échoue, rollback
      // évite le double-débit en cas de crash entre commit et updateApresExecution
      await conn.query(
        `UPDATE transactions_recurrentes
         SET derniere_execution = ?, prochaine_execution = ?, nb_echecs = 0, statut = ?
         WHERE id = ?`,
        [today, prochaine, nouveauStatut, rec.id]
      );

      await conn.commit();

      // Audit log hors transaction (acceptable : si ça échoue, le virement reste valide)
      await createAuditLog({
        utilisateurId: rec.utilisateur_id,
        roleUtilisateur: "UTILISATEUR",
        action: "RECURRENTE_EXECUTEE",
        details: `Recurrente #${rec.id} — ${rec.montant} CAD de #${rec.compte_source_id} vers #${rec.compte_destination_id}${nouveauStatut === "TERMINEE" ? " — terminee" : ""}`,
      });

      console.log(`[Scheduler] Récurrente #${rec.id} : exécutée (${rec.montant} CAD)${nouveauStatut === "TERMINEE" ? " — terminée" : ""}`);
    } catch (err) {
      await conn.rollback();
      console.error(`[Scheduler] Erreur lors de l'exécution de la récurrente #${rec.id} :`, err.message);
    } finally {
      conn.release();
    }
  }
}
