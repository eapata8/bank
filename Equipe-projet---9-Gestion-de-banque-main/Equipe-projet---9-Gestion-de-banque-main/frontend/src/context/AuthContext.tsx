"use client";

/**
 * @fileoverview Contexte React d'authentification — Leon Bank.
 *
 * Ce module fournit un contexte React (AuthContext) qui centralise l'état
 * d'authentification de l'utilisateur dans toute l'application.
 *
 * Fonctionnalités exposées via useAuth() :
 *  - user         : l'utilisateur connecté (null si déconnecté)
 *  - loading      : indicateur de chargement pendant les appels API
 *  - refreshMe()  : recharge les informations de l'utilisateur depuis le serveur
 *  - logout()     : déconnecte l'utilisateur et vide l'état
 *
 * Usage :
 *  1. Envelopper l'application dans <AuthProvider> (dans layout.tsx)
 *  2. Utiliser useAuth() dans n'importe quel composant enfant
 *
 * @module context/AuthContext
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { apiGet, apiPostVoid } from "@/lib/api";
import type { User } from "@/lib/types";

/** Type des valeurs exposées par le contexte d'authentification. */
type AuthContextValue = {
  user: User | null;                          // Utilisateur connecté ou null
  loading: boolean;                           // true pendant les appels API d'auth
  refreshMe: () => Promise<User | null>;      // Recharge l'utilisateur depuis /api/auth/me
  logout: () => Promise<void>;               // Déconnexion complète
};

/**
 * Contexte React pour l'état d'authentification.
 * Initialisé à undefined pour détecter les usages en dehors de AuthProvider.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Fournisseur du contexte d'authentification.
 *
 * À placer en haut de l'arbre de composants (dans le layout racine).
 * Gère l'état `user` et `loading`, et expose les actions d'authentification.
 *
 * @param children - Les composants enfants qui auront accès au contexte.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Recharge l'utilisateur connecté depuis l'API.
   *
   * Appelle GET /api/auth/me pour récupérer les informations de session.
   * En cas d'erreur (session expirée, 401), l'utilisateur est mis à null.
   *
   * useCallback avec [] garantit une référence stable entre les renders.
   * Sans ça, chaque changement de `user` ou `loading` recrée la fonction,
   * ce qui déclenche à nouveau les useEffect qui en dépendent → boucle infinie.
   */
  const refreshMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ user: User }>("/auth/me");
      setUser(res.user);
      return res.user;
    } catch (err: any) {
      // Si session invalide, l'appel renverra typiquement 401
      setUser(null);
      return null;
    } finally {
      // S'assure que loading est toujours remis à false, même en cas d'erreur
      setLoading(false);
    }
  }, []); // setLoading et setUser sont stables (garantis par React)

  /**
   * Déconnecte l'utilisateur en appelant le backend et en vidant l'état local.
   *
   * L'API backend détruit la session MySQL et efface le cookie côté serveur.
   * Ici on vide aussi l'état React pour que l'UI se mette à jour immédiatement.
   */
  const logout = useCallback(async () => {
    // L'API backend protège le logout avec authMiddleware
    await apiPostVoid("/auth/logout", {});
    setUser(null); // Vide l'état local pour déclencher la redirection vers /login
  }, []); // setUser est stable

  /**
   * Mémoïsation de la valeur du contexte.
   *
   * useMemo évite de recréer l'objet de contexte à chaque render, ce qui
   * éviterait des re-renders inutiles des consommateurs du contexte.
   * La valeur n'est recréée que si user, loading, refreshMe ou logout changent.
   */
  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refreshMe, logout }),
    [user, loading, refreshMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook personnalisé pour accéder au contexte d'authentification.
 *
 * Doit être utilisé uniquement dans des composants enfants de AuthProvider.
 * Lève une erreur explicite si utilisé en dehors du contexte.
 *
 * @returns Les valeurs du contexte d'authentification.
 * @throws {Error} Si appelé en dehors d'un AuthProvider.
 *
 * @example
 * function MonComposant() {
 *   const { user, logout } = useAuth();
 *   if (!user) return <Redirect to="/login" />;
 *   return <div>Bonjour {user.prenom}</div>;
 * }
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
