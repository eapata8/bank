"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardHome() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === "ADMIN") {
      router.replace("/dashboard/admin");
      return;
    }

    router.replace("/dashboard/clients");
  }, [router, user]);

  return null;
}

