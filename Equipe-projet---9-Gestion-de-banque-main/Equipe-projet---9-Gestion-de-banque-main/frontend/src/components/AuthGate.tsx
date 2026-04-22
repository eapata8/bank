"use client";

/**
 * @fileoverview Composant de protection des routes authentifiées — Leon Bank.
 *
 * AuthGate est un composant « gardien » qui enveloppe les pages protégées.
 * Son rôle est de vérifier que l'utilisateur a une session active avant
 * d'afficher le contenu demandé.
 *
 * Comportement :
 *  1. Au montage, appelle refreshMe() pour valider la session côté serveur.
 *  2. Pendant la vérification, affiche un spinner centré (état `checked` = false).
 *  3. Si la session est invalide (user = null après vérification), redirige vers /login.
 *  4. Si la session est valide, rend les enfants normalement.
 *
 * Ce composant est conçu pour être placé dans le layout du dashboard,
 * de sorte que toutes les pages protégées soient automatiquement couvertes.
 *
 * @module components/AuthGate
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Composant gardien qui vérifie la session avant de rendre les enfants.
 *
 * @param children - Les pages ou composants protégés à afficher si authentifié.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, refreshMe } = useAuth();

  /**
   * `checked` passe à true une fois que refreshMe() a terminé (succès ou échec).
   * Cela permet de distinguer l'état initial (pas encore vérifié) de l'état
   * « vérifié mais non authentifié » (session invalide).
   */
  const [checked, setChecked] = useState(false);

  /**
   * Effet #1 — Vérifie la session au montage du composant.
   *
   * refreshMe() appelle GET /api/auth/me et met à jour `user` dans le contexte.
   * On utilise finally() pour garantir que `checked` est toujours mis à true,
   * même si l'appel échoue (ex: serveur injoignable, 401 session expirée).
   *
   * Le tableau de dépendances vide [] assure que cet effet ne s'exécute qu'une
   * seule fois, au montage. refreshMe est stable (useCallback avec []).
   */
  useEffect(() => {
    // Vérifie la session dès l'entrée dans l'espace protégé.
    refreshMe().finally(() => setChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Effet #2 — Redirige vers /login si la session est invalide après vérification.
   *
   * Attend que `checked` soit true pour éviter une redirection prématurée
   * (avant que refreshMe() ait eu le temps de répondre).
   */
  useEffect(() => {
    if (!checked) return;            // Pas encore vérifié, on attend
    if (!user) router.push("/login"); // Session invalide → redirection
  }, [checked, router, user]);

  /**
   * Affiche un spinner pendant la vérification de session.
   * Deux conditions déclenchent cet état :
   *  - `checked` = false : refreshMe() n'a pas encore répondu
   *  - `loading` = true  : une autre opération d'auth est en cours
   */
  if (!checked || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          {/* Spinner CSS : cercle avec bordure animée via @keyframes spin */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid var(--border-blue)",
            borderTopColor: "var(--blue-light)",   // Seul le bord supérieur est visible lors de la rotation
            animation: "spin 0.8s linear infinite",
            margin: "0 auto",
          }} />
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--t3)", letterSpacing: "0.04em" }}>
            Vérification de la session…
          </p>
        </div>
        {/* Définition de l'animation inline pour éviter une dépendance CSS globale */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /**
   * Si la session est invalide, on ne rend rien (null) pendant que la
   * redirection vers /login est en cours (effet #2 s'exécute en parallèle).
   * Cela évite un flash du contenu protégé avant la redirection.
   */
  if (!user) return null;

  // Session valide : on rend les composants enfants
  return <>{children}</>;
}
