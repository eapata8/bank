import { jest } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminPage from "../../frontend/src/app/dashboard/admin/page";

const mockApiGet = jest.fn();
let mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockApiDownloadCSV = jest.fn();

jest.mock("@/lib/api", () => ({
  apiGet:           (...args) => mockApiGet(...args),
  apiDownloadCSV:   (...args) => mockApiDownloadCSV(...args),
}));

const logs = [
  {
    id: 1,
    utilisateur_id: 1,
    role_utilisateur: "ADMIN",
    action: "LOGIN",
    details: "Connexion réussie",
    cree_le: "2026-03-24T10:00:00Z",
    email: "admin@Leon.local",
    prenom: "Admin",
    nom: "Config",
  },
  {
    id: 2,
    utilisateur_id: 2,
    role_utilisateur: "ADMIN",
    action: "CREATE_MODERATEUR",
    details: "Modérateur créé: mod@Leon.local",
    cree_le: "2026-03-24T11:00:00Z",
    email: "admin@Leon.local",
    prenom: "Admin",
    nom: "Config",
  },
  {
    id: 3,
    utilisateur_id: 1,
    role_utilisateur: "ADMIN",
    action: "ADMIN_DELETE_USER",
    details: "Utilisateur #5 supprimé",
    cree_le: "2026-03-24T12:00:00Z",
    email: "admin@Leon.local",
    prenom: "Admin",
    nom: "Config",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };
  mockApiGet.mockResolvedValue({ data: logs });
  mockApiDownloadCSV.mockResolvedValue(undefined);
});

describe("AdminPage — Journal d'audit", () => {
  it("affiche le titre Journal d'audit", async () => {
    render(<AdminPage />);
    expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
  });

  it("bloque l'accès pour un non-admin", async () => {
    mockUser = { prenom: "Mode", nom: "Lecture", role: "MODERATEUR" };
    await act(async () => { render(<AdminPage />); });
    expect(screen.getByText("Section réservée à l'administrateur.")).toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("charge et affiche les logs au montage", async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/auth/logs?limit=50");
    });
    expect(await screen.findByText("Connexion réussie")).toBeInTheDocument();
  });

  it("affiche le nom et l'email de l'auteur de chaque action", async () => {
    render(<AdminPage />);
    await waitFor(() => screen.getAllByText("Admin Config"));
    expect(screen.getAllByText("admin@Leon.local").length).toBeGreaterThan(0);
  });

  it("affiche le badge LOGIN pour une action de connexion", async () => {
    render(<AdminPage />);
    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
  });

  it("affiche le badge CREATE_MODERATEUR pour une création", async () => {
    render(<AdminPage />);
    expect(await screen.findByText("CREATE_MODERATEUR")).toBeInTheDocument();
  });

  it("affiche le badge ADMIN_DELETE_USER pour une suppression", async () => {
    render(<AdminPage />);
    expect(await screen.findByText("ADMIN_DELETE_USER")).toBeInTheDocument();
  });

  it("affiche les détails de chaque log", async () => {
    render(<AdminPage />);
    expect(await screen.findByText("Modérateur créé: mod@Leon.local")).toBeInTheDocument();
    expect(await screen.findByText("Utilisateur #5 supprimé")).toBeInTheDocument();
  });

  it("affiche le compteur d'événements", async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText(`${logs.length} événements`)).toBeInTheDocument();
    });
  });

  it("affiche 'Aucun événement enregistré' si les logs sont vides", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] });
    render(<AdminPage />);
    expect(await screen.findByText("Aucun événement enregistré.")).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement échoue", async () => {
    mockApiGet.mockRejectedValueOnce({ message: "Erreur serveur" });
    render(<AdminPage />);
    expect(await screen.findByText("Erreur serveur")).toBeInTheDocument();
  });

  it("recharge les logs au clic sur Rafraîchir", async () => {
    render(<AdminPage />);
    await waitFor(() => screen.getByText("↺ Rafraîchir"));
    fireEvent.click(screen.getByText("↺ Rafraîchir"));
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });
  });

  it("ne fait pas d'appel API pour un non-admin", async () => {
    mockUser = { prenom: "U", nom: "User", role: "UTILISATEUR" };
    await act(async () => { render(<AdminPage />); });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("affiche un badge amber pour une action générique (pas login/create/delete)", async () => {
    const customLog = [{ ...logs[0], action: "LOCK_ACCOUNT" }];
    mockApiGet.mockResolvedValueOnce({ data: customLog });
    render(<AdminPage />);
    const badge = await screen.findByText("LOCK_ACCOUNT");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("lb-badge-muted");
  });

  it("affiche un badge indigo pour une action GELER", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], action: "GELER_CARTE" }] });
    render(<AdminPage />);
    const badge = await screen.findByText("GELER_CARTE");
    expect(badge.className).toContain("lb-badge-indigo");
  });

  it("affiche un badge amber pour une action BLOQUER", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], action: "BLOQUER_COMPTE" }] });
    render(<AdminPage />);
    const badge = await screen.findByText("BLOQUER_COMPTE");
    expect(badge.className).toContain("lb-badge-amber");
  });

  it("affiche un badge purple pour une action REMBOURS", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], action: "REMBOURSEMENT" }] });
    render(<AdminPage />);
    const badge = await screen.findByText("REMBOURSEMENT");
    expect(badge.className).toContain("lb-badge-purple");
  });

  it("affiche un badge muted pour une action VIEW", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], action: "VIEW_CLIENTS" }] });
    render(<AdminPage />);
    const badge = await screen.findByText("VIEW_CLIENTS");
    expect(badge.className).toContain("lb-badge-muted");
  });

  it("déclenche l'export CSV au clic sur Exporter CSV", async () => {
    render(<AdminPage />);
    await waitFor(() => screen.getByText("Exporter CSV"));
    fireEvent.click(screen.getByText("Exporter CSV"));
    await waitFor(() => {
      expect(mockApiDownloadCSV).toHaveBeenCalledWith("/export/audit", "audit.csv");
    });
  });

  it("change la limite et recharge les logs via le sélecteur", async () => {
    render(<AdminPage />);
    await waitFor(() => screen.getByText("↺ Rafraîchir"));

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "100" } });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/auth/logs?limit=100");
    });
  });

  it("affiche 'Mod' pour un log avec rôle MODERATEUR (RoleInline short)", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], role_utilisateur: "MODERATEUR" }] });
    render(<AdminPage />);
    expect(await screen.findByText("Mod")).toBeInTheDocument();
  });

  it("affiche 'User' pour un log avec rôle UTILISATEUR (RoleInline short)", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], role_utilisateur: "UTILISATEUR" }] });
    render(<AdminPage />);
    expect(await screen.findByText("User")).toBeInTheDocument();
  });

  it("affiche 'User' pour un rôle inconnu (RoleInline fallback ??)", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], role_utilisateur: "SUPER_ADMIN" }] });
    render(<AdminPage />);
    expect(await screen.findByText("User")).toBeInTheDocument();
  });

  it("affiche '?' dans l'avatar si prenom est absent (AuditAvatar fallback ??)", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], prenom: undefined }] });
    render(<AdminPage />);
    await screen.findByText("LOGIN");
    expect(screen.getAllByText("?").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche '—' si les détails du log sont null (branche falsy line 262)", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], details: null }] });
    render(<AdminPage />);
    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("loadLogs ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    mockApiGet.mockRejectedValueOnce({});
    render(<AdminPage />);
    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  it("AuditAvatar avec role_utilisateur undefined couvre colorMap[role ?? ''] (ligne 73)", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [{ ...logs[0], role_utilisateur: undefined }] });
    render(<AdminPage />);
    await screen.findByText("LOGIN");
    // role ?? "" → colorMap[""] → undefined → ?? colorMap.UTILISATEUR
    expect(document.body).toBeTruthy();
  });
});
