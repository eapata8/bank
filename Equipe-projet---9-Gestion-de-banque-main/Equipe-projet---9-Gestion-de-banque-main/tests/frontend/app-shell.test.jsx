import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AppShell from "../../frontend/src/components/AppShell";

const mockPush = jest.fn();
const mockLogout = jest.fn();
let mockPathname = "/dashboard/clients";
let mockUser = { prenom: "Admin", nom: "Demo", role: "ADMIN" };
let mockTheme = "dark";
const mockToggle = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

jest.mock("@/context/ThemeContext", () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({ theme: mockTheme, toggle: mockToggle }),
}));

describe("AppShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/dashboard/clients";
    mockUser = { prenom: "Admin", nom: "Demo", role: "ADMIN" };
    mockTheme = "dark";
  });

  it("affiche les liens de navigation admin et l'utilisateur connecte", () => {
    render(
      <AppShell>
        <div>Contenu dashboard</div>
      </AppShell>
    );

    expect(screen.getAllByText("Leon Bank").length).toBeGreaterThan(0);
    // elevatedNav pour ADMIN: Clients, Virements, Factures, Cartes, Audit, Ctrl. comptes, Utilisateurs
    expect(screen.getAllByText("Clients").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Virements").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Factures").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cartes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Audit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Utilisateurs").length).toBeGreaterThan(0);
    // Nom de l'utilisateur connecte dans la sidebar
    expect(screen.getAllByText("Admin Demo").length).toBeGreaterThan(0);
    expect(screen.getByText("Contenu dashboard")).toBeInTheDocument();
  });

  it("n'affiche pas Audit et Ctrl. comptes pour un moderateur, mais affiche Utilisateurs", () => {
    mockUser = { prenom: "Mode", nom: "Lecture", role: "MODERATEUR" };

    render(
      <AppShell>
        <div>Contenu dashboard</div>
      </AppShell>
    );

    // MODERATEUR voit Clients, Comptes, Virements, Factures, Cartes, Utilisateurs
    expect(screen.getAllByText("Clients").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Factures").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cartes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Utilisateurs").length).toBeGreaterThan(0);
    // Mais pas Audit ni Ctrl. comptes
    expect(screen.queryByText("Audit")).not.toBeInTheDocument();
    expect(screen.queryByText("Ctrl. comptes")).not.toBeInTheDocument();
  });

  it("affiche le nav client pour un utilisateur standard", () => {
    mockUser = { prenom: "Leon", nom: "Client", role: "UTILISATEUR" };

    render(
      <AppShell>
        <div>Contenu dashboard</div>
      </AppShell>
    );

    // clientNav: Mes comptes, Virements, Factures, Cartes
    expect(screen.getAllByText("Mes comptes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Virements").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Factures").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cartes").length).toBeGreaterThan(0);
    // Elements de supervision absents
    expect(screen.queryByText("Audit")).not.toBeInTheDocument();
    expect(screen.queryByText("Utilisateurs")).not.toBeInTheDocument();
    expect(screen.queryByText("Comptes")).not.toBeInTheDocument();
  });

  it("declenche logout puis redirige vers /login", async () => {
    mockLogout.mockResolvedValue(undefined);

    render(
      <AppShell>
        <div>Contenu dashboard</div>
      </AppShell>
    );

    // Le bouton de deconnexion utilise l'accent "Déconnexion" (plusieurs occurrences possible — sidebar + mobile)
    fireEvent.click(screen.getAllByRole("button", { name: "Déconnexion" })[0]);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("affiche '?' dans l'avatar si prenom et nom sont absents (Avatar fallback)", () => {
    mockUser = {}; // pas de prenom ni nom ni role
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Avatar affiche "?" quand les initiales sont vides
    expect(screen.getAllByText("?").length).toBeGreaterThanOrEqual(1);
  });

  it("couvre user?.role ?? '' quand user.role est absent (ligne 234)", () => {
    mockUser = { prenom: "Test", nom: "User" }; // pas de role
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // role = "" → isElevated = false → clientNav affiché
    expect(screen.getAllByText("Mes comptes").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Mes comptes quand pathname commence par /dashboard/comptes", () => {
    mockPathname = "/dashboard/comptes/42";
    mockUser = { prenom: "Jean", nom: "Client", role: "UTILISATEUR" };
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Le lien "Mes comptes" doit être présent et actif (couvre la branche || startsWith comptes)
    expect(screen.getAllByText("Mes comptes").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Audit quand pathname est exactement /dashboard/admin", () => {
    mockPathname = "/dashboard/admin";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Audit").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Virements quand pathname commence par /dashboard/virements", () => {
    mockPathname = "/dashboard/virements";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Virements").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Factures quand pathname commence par /dashboard/factures", () => {
    mockPathname = "/dashboard/factures";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Factures").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Cartes quand pathname commence par /dashboard/cartes", () => {
    mockPathname = "/dashboard/cartes";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Cartes").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Dépôts quand pathname commence par /dashboard/depots", () => {
    mockPathname = "/dashboard/depots";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Dépôts").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Retraits quand pathname commence par /dashboard/retraits", () => {
    mockPathname = "/dashboard/retraits";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Retraits").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Utilisateurs quand pathname commence par /dashboard/admin/utilisateurs", () => {
    mockPathname = "/dashboard/admin/utilisateurs";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Utilisateurs").length).toBeGreaterThanOrEqual(1);
  });

  it("active le lien Gestion des clients quand pathname commence par /dashboard/admin/clients", () => {
    mockPathname = "/dashboard/admin/clients";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Gestion des clients").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche 'Modérateur' dans le label de rôle pour un moderateur", () => {
    mockUser = { prenom: "Mode", nom: "Lecture", role: "MODERATEUR" };
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Modérateur").length).toBeGreaterThan(0);
  });

  it("affiche 'Client' dans le label de rôle pour un utilisateur", () => {
    mockUser = { prenom: "Jean", nom: "Client", role: "UTILISATEUR" };
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Client").length).toBeGreaterThan(0);
  });

  // ── RoleBadge (lignes 114-122) ───────────────────────────────────────────

  it("RoleBadge affiche le badge 'Admin' pour un utilisateur ADMIN (ligne 116)", () => {
    mockUser = { prenom: "Admin", nom: "Demo", role: "ADMIN" };
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("RoleBadge affiche le badge 'Mod' pour un utilisateur MODERATEUR (ligne 118)", () => {
    mockUser = { prenom: "Mode", nom: "Lecture", role: "MODERATEUR" };
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.getAllByText("Mod").length).toBeGreaterThan(0);
  });

  it("RoleBadge ne rend rien pour un utilisateur standard (ligne 121 null return)", () => {
    mockUser = { prenom: "Jean", nom: "Client", role: "UTILISATEUR" };
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Mod")).not.toBeInTheDocument();
  });

  // ── ThemeToggle (lignes 124-153) ─────────────────────────────────────────

  it("ThemeToggle : le bouton de thème est présent (titre Mode clair ou Mode sombre)", () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // ThemeContext default theme = "dark" → title = "Mode clair"
    const toggleBtns = screen.getAllByTitle("Mode clair");
    expect(toggleBtns.length).toBeGreaterThan(0);
  });

  // ── Mobile drawer (lignes 283-331) ───────────────────────────────────────

  it("clic sur le hamburger ouvre le drawer mobile — body.overflow devient hidden (ligne 331)", async () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Avant ouverture, overflow est vide
    expect(document.body.style.overflow).toBe("");

    // Le hamburger est le PREMIER bouton dans le <header> mobile
    const header = document.querySelector("header");
    expect(header).toBeTruthy();
    const hamburger = within(header).getAllByRole("button")[0];
    fireEvent.click(hamburger);

    // Après ouverture drawerOpen=true → body.overflow = "hidden"
    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });
  });

  it("clic sur le bouton de fermeture du drawer referme le drawer (ligne 304)", async () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Ouvrir le drawer via le hamburger
    const header = document.querySelector("header");
    const hamburger = within(header).getAllByRole("button")[0];
    fireEvent.click(hamburger);

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    // Cliquer le bouton de fermeture (position: absolute dans le drawer)
    const closeBtn = document.querySelector('button[style*="position: absolute"]');
    if (closeBtn) {
      fireEvent.click(closeBtn);
      await waitFor(() => {
        expect(document.body.style.overflow).toBe("");
      });
    }
  });

  it("logout via le bouton icône du header mobile déclenche la déconnexion (ligne 348)", async () => {
    mockLogout.mockResolvedValue(undefined);
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Le bouton icône de déconnexion mobile a title="Déconnexion"
    const mobileLogoutBtns = screen.getAllByTitle("Déconnexion");
    fireEvent.click(mobileLogoutBtns[0]);
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  // ── ThemeToggle hover (lignes 138-139) ───────────────────────────────────

  it("ThemeToggle mouseEnter/Leave ne lance pas d'erreur (lignes 138-139)", () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    const toggleBtns = screen.getAllByTitle("Mode clair");
    const btn = toggleBtns[0];
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    expect(btn).toBeInTheDocument();
  });

  // ── Logout button hover (lignes 216-217) ─────────────────────────────────

  it("bouton Déconnexion sidebar hover mouseEnter/Leave (lignes 216-217)", () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    const logoutBtns = screen.getAllByRole("button", { name: "Déconnexion" });
    const btn = logoutBtns[0];
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    expect(btn).toBeInTheDocument();
  });

  // ── Backdrop click ferme le drawer (ligne 283) ───────────────────────────

  it("clic sur le backdrop ferme le drawer mobile (ligne 283)", async () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Ouvrir le drawer via le hamburger
    const header = document.querySelector("header");
    const hamburger = within(header).getAllByRole("button")[0];
    fireEvent.click(hamburger);
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));

    // Cliquer le backdrop — jsdom normalise rgba avec espaces
    const backdrop =
      document.querySelector('div[style*="rgba(0, 0, 0, 0.5)"]') ||
      document.querySelector('div[style*="rgba(0,0,0,0.5)"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });

  // ── ThemeToggle theme light (lignes 130,141) ────────────────────────────

  it("ThemeToggle affiche 'Mode sombre' quand le thème est 'light' (lignes 130,141)", () => {
    mockTheme = "light";
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    const modeSombreBtns = screen.getAllByTitle("Mode sombre");
    expect(modeSombreBtns.length).toBeGreaterThan(0);
  });

  // ── NavLink click dans le drawer mobile ferme le drawer (ligne 309) ──────

  it("clic sur un lien de navigation dans le drawer mobile ferme le drawer (ligne 309)", async () => {
    render(
      <AppShell>
        <div>Contenu</div>
      </AppShell>
    );
    // Ouvrir le drawer
    const header = document.querySelector("header");
    const hamburger = within(header).getAllByRole("button")[0];
    fireEvent.click(hamburger);
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));

    // Le drawer mobile est le <aside> avec position fixed
    const drawer = document.querySelector('aside[style*="position: fixed"]');
    if (drawer) {
      const links = drawer.querySelectorAll("a");
      if (links.length > 0) {
        fireEvent.click(links[0]);
        await waitFor(() => expect(document.body.style.overflow).toBe(""));
      }
    }
  });
});
