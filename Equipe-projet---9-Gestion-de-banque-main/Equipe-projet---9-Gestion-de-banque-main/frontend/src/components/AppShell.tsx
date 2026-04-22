"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const icons = {
  accounts: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  users: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  transfer: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0-4-4m4 4-4 4M16 17H4m0 0 4 4m-4-4 4-4" />
    </svg>
  ),
  invoice: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  admin: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  creditcard: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="9" y2="15" /><line x1="11" y1="15" x2="14" y2="15" />
    </svg>
  ),
  cheque: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h4M6 14h8M16 10h2" />
    </svg>
  ),
  interac: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8M14 9l3 3-3 3" />
    </svg>
  ),
  simulation: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  ),
  logout: (
    <svg className="h-[14px] w-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  menu: (
    <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
      <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
    </svg>
  ),
  store: (
    <svg className="h-[16px] w-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.015 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  ),
};

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: "linear-gradient(135deg, #533afd 0%, #1c1e54 100%)",
      flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "rgba(83,58,253,0.35) 0px 4px 12px -2px",
    }}>
      <svg width={size * 0.50} height={size * 0.50} viewBox="0 0 20 20" fill="none">
        <path d="M10 2L3 6v4c0 4.418 3.134 8.556 7 9.5C13.866 18.556 17 14.418 17 10V6L10 2z"
          fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} />
        <path d="M7 10.5l2 2 4-4" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function NavLink({ href, icon, label, active, onClick }: { href: string; icon: React.ReactNode; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link href={href} className={`lb-nav ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function Avatar({ prenom, nom, size = 32 }: { prenom?: string; nom?: string; size?: number }) {
  const initials = ((prenom ?? "").charAt(0) + (nom ?? "").charAt(0)).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: "linear-gradient(135deg, #533afd 0%, #1c1e54 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 400, color: "#ffffff",
      flexShrink: 0, fontFeatureSettings: '"ss01"', letterSpacing: "-0.01em",
      boxShadow: "rgba(83,58,253,0.25) 0px 2px 8px -2px",
    }}>
      {initials || "?"}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "ADMIN") return (
    <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 4, background: "rgba(155,104,41,0.10)", border: "1px solid rgba(155,104,41,0.25)", color: "#7a5219", fontFeatureSettings: '"ss01"' }}>Admin</span>
  );
  if (role === "MODERATEUR") return (
    <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 4, background: "rgba(21,190,83,0.12)", border: "1px solid rgba(21,190,83,0.30)", color: "#108c3d", fontFeatureSettings: '"ss01"' }}>Mod</span>
  );
  return null;
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      type="button"
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        border: "1px solid var(--border)", background: "transparent",
        color: "var(--t3)", cursor: "pointer",
        transition: "background 120ms, color 120ms, border-color 120ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--t1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--t3)"; }}
    >
      {theme === "dark" ? (
        <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/* ── Sidebar content (réutilisé desktop + drawer mobile) ── */
function SidebarContent({ nav, isElevated, isAdmin, adminOnlyNav, elevatedAdminSharedNav, elevatedAdminClientsNav, managementNav, clientNav, user, role, roleLabel, onLogout, onNavClick }: {
  nav: any[]; isElevated: boolean; isAdmin: boolean;
  adminOnlyNav: any[]; elevatedAdminSharedNav: any[]; elevatedAdminClientsNav: any[];
  managementNav: any[]; clientNav: any[];
  user: any; role: string; roleLabel: string;
  onLogout: () => void; onNavClick?: () => void;
}) {
  return (
    <>
      {/* Brand + ThemeToggle (toujours visible en haut, desktop + mobile) */}
      <div style={{ padding: "20px 16px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 400, color: "var(--t1)", letterSpacing: "-0.01em", fontFeatureSettings: '"ss01"' }}>Leon Bank</p>
            <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 1, fontFeatureSettings: '"ss01"', fontWeight: 300 }}>Banque privée digitale</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Nav (minHeight:0 pour que le footer reste visible quand la nav déborde) */}
      <nav style={{ flex: 1, minHeight: 0, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
        {isElevated ? (
          <>
            <p className="lb-nav-section">Gestion</p>
            {managementNav.map((item) => <NavLink key={item.href} {...item} onClick={onNavClick} />)}
            <p className="lb-nav-section" style={{ marginTop: 8 }}>Administration</p>
            {[...adminOnlyNav, ...elevatedAdminSharedNav, ...elevatedAdminClientsNav].map((item) => (
              <NavLink key={item.href} {...item} onClick={onNavClick} />
            ))}
          </>
        ) : (
          <>
            <p className="lb-nav-section">Mon espace</p>
            {clientNav.map((item) => <NavLink key={item.href} {...item} onClick={onNavClick} />)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Avatar prenom={user?.prenom} nom={user?.nom} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 400, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFeatureSettings: '"ss01"' }}>
              {user?.prenom} {user?.nom}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <p style={{ fontSize: 11, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: 300 }}>{roleLabel}</p>
              <RoleBadge role={role} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <ThemeToggle />
          <button
            onClick={onLogout}
            type="button"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, padding: "7px 14px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--t3)", fontSize: 13, fontWeight: 400, cursor: "pointer", fontFamily: "inherit", fontFeatureSettings: '"ss01"', transition: "background 120ms, color 120ms" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--t1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--t3)"; }}
          >
            {icons.logout} Déconnexion
          </button>
        </div>
      </div>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fermer le drawer quand on change de page
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Bloquer le scroll body quand le drawer est ouvert
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const role = user?.role ?? "";
  const isElevated = role === "ADMIN" || role === "MODERATEUR";
  const isAdmin = role === "ADMIN";
  const onLogout = async () => { await logout(); router.push("/login"); };
  const roleLabel = role === "ADMIN" ? "Administrateur" : role === "MODERATEUR" ? "Modérateur" : "Client";

  const clientNav = [
    { href: "/dashboard/clients",   icon: icons.accounts,   label: "Mes comptes",  active: pathname.startsWith("/dashboard/clients") || pathname.startsWith("/dashboard/comptes") },
    { href: "/dashboard/virements", icon: icons.transfer,   label: "Virements",    active: pathname.startsWith("/dashboard/virements") },
    { href: "/dashboard/factures",  icon: icons.invoice,    label: "Factures",     active: pathname.startsWith("/dashboard/factures") },
    { href: "/dashboard/cartes",    icon: icons.creditcard, label: "Cartes",       active: pathname.startsWith("/dashboard/cartes") },
    { href: "/dashboard/depots",    icon: icons.cheque,     label: "Dépôts",       active: pathname.startsWith("/dashboard/depots") },
    { href: "/dashboard/retraits",  icon: icons.transfer,   label: "Retraits",     active: pathname.startsWith("/dashboard/retraits") },
    { href: "/dashboard/interac",   icon: icons.interac,    label: "Interac",      active: pathname.startsWith("/dashboard/interac") },
    { href: "/dashboard/produits",  icon: icons.store,      label: "Produits",     active: pathname.startsWith("/dashboard/produits") },
  ];
  const managementNav = [
    { href: "/dashboard/clients",   icon: icons.users,      label: "Clients",      active: pathname.startsWith("/dashboard/clients") || pathname.startsWith("/dashboard/comptes") },
    { href: "/dashboard/virements", icon: icons.transfer,   label: "Virements",    active: pathname.startsWith("/dashboard/virements") },
    { href: "/dashboard/factures",  icon: icons.invoice,    label: "Factures",     active: pathname.startsWith("/dashboard/factures") },
    { href: "/dashboard/cartes",    icon: icons.creditcard, label: "Cartes",       active: pathname.startsWith("/dashboard/cartes") },
    { href: "/dashboard/depots",    icon: icons.cheque,     label: "Dépôts",       active: pathname.startsWith("/dashboard/depots") },
    { href: "/dashboard/retraits",  icon: icons.transfer,   label: "Retraits",     active: pathname.startsWith("/dashboard/retraits") },
    { href: "/dashboard/interac",   icon: icons.interac,    label: "Interac",      active: pathname.startsWith("/dashboard/interac") },
    { href: "/dashboard/produits",  icon: icons.store,      label: "Produits",     active: pathname.startsWith("/dashboard/produits") },
  ];
  const adminOnlyNav = isAdmin ? [
    { href: "/dashboard/admin", icon: icons.admin, label: "Audit", active: pathname === "/dashboard/admin" },
  ] : [];
  const elevatedAdminClientsNav = isElevated ? [{ href: "/dashboard/admin/clients", icon: icons.users, label: "Gestion des clients", active: pathname.startsWith("/dashboard/admin/clients") }] : [];
  const elevatedAdminSharedNav = [
    { href: "/dashboard/admin/utilisateurs", icon: icons.users,  label: "Utilisateurs",      active: pathname.startsWith("/dashboard/admin/utilisateurs") },
  ];
  const nav = isElevated ? managementNav : clientNav;

  const sidebarProps = { nav, isElevated, isAdmin, adminOnlyNav, elevatedAdminSharedNav, elevatedAdminClientsNav, managementNav, clientNav, user, role, roleLabel, onLogout };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Sidebar desktop ── */}
      <aside className="lb-sidebar hidden xl:flex xl:flex-col" style={{ width: 240, minHeight: "100vh" }}>
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="xl:hidden"
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className="flex flex-col xl:hidden"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
          width: 272,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
          transform: drawerOpen ? "translateX(0)" : "translateX(calc(-100% - 2px))",
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: drawerOpen ? "rgba(0,0,0,0.25) 4px 0 24px" : "none",
          overflowY: "auto",
        }}
      >
        {/* Bouton fermeture */}
        <button
          onClick={() => setDrawerOpen(false)}
          style={{ position: "absolute", top: 14, right: 14, zIndex: 1, width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--t3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          {icons.close}
        </button>
        <SidebarContent {...sidebarProps} onNavClick={() => setDrawerOpen(false)} />
      </aside>

      {/* ── Content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Mobile top bar */}
        <header
          className="flex items-center justify-between xl:hidden"
          style={{
            position: "sticky", top: 0, zIndex: 20,
            background: "color-mix(in srgb, var(--bg) 95%, transparent)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border)",
            boxShadow: "rgba(0,55,112,0.06) 0px 1px 0px",
            padding: "0 16px",
            height: 52,
            gap: 8,
          }}
        >
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            type="button"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--t2)", cursor: "pointer", flexShrink: 0 }}
          >
            {icons.menu}
          </button>

          {/* Logo centre */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}>
            <BrandMark size={24} />
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--t1)", fontFeatureSettings: '"ss01"' }}>Leon Bank</span>
          </div>

          {/* Actions droite */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <ThemeToggle />
            <button
              onClick={onLogout}
              type="button"
              title="Déconnexion"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--t3)", cursor: "pointer" }}
            >
              {icons.logout}
            </button>
          </div>
        </header>

        <main className="lb-page lb-main-content" style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
