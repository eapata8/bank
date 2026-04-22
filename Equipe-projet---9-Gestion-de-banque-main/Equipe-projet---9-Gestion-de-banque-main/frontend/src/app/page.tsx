"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { refreshMe } = useAuth();

  useEffect(() => {
    refreshMe().then((user) => {
      if (user) router.push("/dashboard");
      else router.push("/login");
    });
  }, [refreshMe, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", fontFeatureSettings: '"ss01"' }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: "2px solid rgba(83,58,253,0.15)",
          borderTopColor: "#533afd",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto",
        }} />
        <p style={{ marginTop: 16, fontSize: 13, fontWeight: 300, color: "var(--t3)" }}>
          Chargement…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

