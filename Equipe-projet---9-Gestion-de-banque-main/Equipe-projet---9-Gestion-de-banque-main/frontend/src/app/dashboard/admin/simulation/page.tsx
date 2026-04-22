"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * La simulation est maintenant intégrée directement dans la page de gestion
 * des clients (onglet "Simulation" par client).
 * Cette page redirige automatiquement.
 */
export default function SimulationRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin/clients");
  }, [router]);
  return null;
}
