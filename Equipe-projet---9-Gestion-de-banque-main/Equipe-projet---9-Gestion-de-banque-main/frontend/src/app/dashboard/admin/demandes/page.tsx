import { redirect } from "next/navigation";

/**
 * Ancienne route déplacée vers /dashboard/produits.
 * Les admins et modérateurs accèdent maintenant à la gestion des demandes
 * via le menu "Produits" (la page s'adapte au rôle).
 */
export default function AdminDemandesRedirect() {
  redirect("/dashboard/produits");
}
