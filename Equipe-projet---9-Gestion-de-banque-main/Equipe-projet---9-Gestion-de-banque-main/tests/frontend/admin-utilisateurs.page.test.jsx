import { jest } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminUtilisateursPage from "../../frontend/src/app/dashboard/admin/utilisateurs/page";

const mockApiGet    = jest.fn();
const mockApiPost   = jest.fn();
const mockApiPatch  = jest.fn();
const mockApiDelete = jest.fn();
let mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockApiDownloadCSV = jest.fn();

jest.mock("@/lib/api", () => ({
  apiGet:           (...args) => mockApiGet(...args),
  apiPost:          (...args) => mockApiPost(...args),
  apiPatch:         (...args) => mockApiPatch(...args),
  apiDelete:        (...args) => mockApiDelete(...args),
  apiDownloadCSV:   (...args) => mockApiDownloadCSV(...args),
}));

const users = [
  { id: 1, email: "admin@bank.com",  role: "ADMIN",       prenom: "Super", nom: "Admin", cree_le: "2024-01-01" },
  { id: 2, email: "mod@bank.com",    role: "MODERATEUR",  prenom: "Mod",   nom: "One",   cree_le: "2024-01-02" },
  { id: 3, email: "user@bank.com",   role: "UTILISATEUR", prenom: "Jean",  nom: "Dupont",cree_le: "2024-01-03" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };
  mockApiGet.mockResolvedValue({ data: users });
  mockApiDownloadCSV.mockResolvedValue(undefined);
});

describe("AdminUtilisateursPage — ADMIN", () => {
  it("affiche le titre de la page", async () => {
    render(<AdminUtilisateursPage />);
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument();
  });

  it("refuse l'accès aux utilisateurs normaux", async () => {
    mockUser = { prenom: "User", nom: "Test", role: "UTILISATEUR" };
    await act(async () => { render(<AdminUtilisateursPage />); });
    expect(screen.getByText(/Section réservée/i)).toBeInTheDocument();
  });

  it("affiche tous les utilisateurs", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => {
      expect(screen.getByText("Super Admin")).toBeInTheDocument();
      expect(screen.getByText("Mod One")).toBeInTheDocument();
      expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    });
  });

  it("affiche les compteurs de rôles", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => {
      const ones = screen.getAllByText("1");
      expect(ones.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("affiche les boutons 'Nouvel admin' et 'Nouveau modérateur'", async () => {
    await act(async () => { render(<AdminUtilisateursPage />); });
    expect(screen.getByText("+ Nouvel admin")).toBeInTheDocument();
    expect(screen.getByText("+ Nouveau modérateur")).toBeInTheDocument();
  });

  it("affiche le formulaire de création admin au clic", async () => {
    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouvel admin"));
    expect(screen.getByText("Créer un nouvel administrateur")).toBeInTheDocument();
    expect(screen.getByText("Créer l'administrateur")).toBeInTheDocument();
  });

  it("crée un administrateur via le formulaire", async () => {
    mockApiPost.mockResolvedValueOnce({ message: "Administrateur créé", id: 10 });
    mockApiGet.mockResolvedValue({ data: users });

    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouvel admin"));

    await waitFor(() => screen.getByText("Créer l'administrateur"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Nouveau" } });
    fireEvent.change(inputs[1], { target: { value: "Admin" } });
    fireEvent.change(inputs[2], { target: { value: "new@admin.com" } });
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    if (pwdInputs.length > 0) fireEvent.change(pwdInputs[0], { target: { value: "password123" } });

    fireEvent.click(screen.getByText("Créer l'administrateur"));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/utilisateurs/admin",
        expect.objectContaining({ prenom: "Nouveau" })
      );
    });
  });

  it("affiche les boutons Rôle, Mot de passe et Supprimer pour chaque utilisateur", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    expect(screen.getAllByText("Rôle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mot de passe").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Supprimer").length).toBeGreaterThanOrEqual(1);
  });

  it("le sélecteur de rôle contient ADMIN pour un admin", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Rôle")[0]);
    await waitFor(() => screen.getByRole("combobox"));

    const options = Array.from(screen.getByRole("combobox").querySelectorAll("option")).map((o) => o.value);
    expect(options).toContain("ADMIN");
    expect(options).toContain("MODERATEUR");
    expect(options).toContain("UTILISATEUR");
  });

  it("change le rôle d'un utilisateur", async () => {
    mockApiPatch.mockResolvedValueOnce({ message: "Rôle modifié", role: "MODERATEUR" });
    mockApiGet.mockResolvedValue({ data: users });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Rôle")[0]);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "MODERATEUR" } });
    fireEvent.click(screen.getByText("✓"));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/utilisateurs/"),
        { role: "MODERATEUR" }
      );
    });
  });

  it("annule la modification de rôle au clic sur ✕", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Rôle")[0]);
    await waitFor(() => screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("✕"));

    await waitFor(() => {
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  it("déclenche l'export CSV au clic sur ⬇ CSV", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getByText("⬇ CSV"));

    await waitFor(() => {
      expect(mockApiDownloadCSV).toHaveBeenCalledWith("/export/utilisateurs", "utilisateurs.csv");
    });
  });

  it("affiche une erreur si le chargement des utilisateurs echoue", async () => {
    mockApiGet.mockRejectedValueOnce({ message: "Erreur DB" });

    render(<AdminUtilisateursPage />);

    expect(await screen.findByText(/Erreur DB/)).toBeInTheDocument();
  });

  it("affiche une erreur si le changement de role echoue", async () => {
    mockApiPatch.mockRejectedValueOnce({ message: "Accès refusé" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Rôle")[0]);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "UTILISATEUR" } });
    fireEvent.click(screen.getByText("✓"));

    expect(await screen.findByText(/Accès refusé/)).toBeInTheDocument();
  });

  it("affiche le formulaire de réinitialisation de mot de passe au clic", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Mot de passe")[0]);

    expect(screen.getByPlaceholderText("Nouveau mdp")).toBeInTheDocument();
  });

  it("réinitialise le mot de passe avec succès", async () => {
    mockApiPatch.mockResolvedValueOnce({ message: "Mot de passe réinitialisé" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Mot de passe")[0]);
    fireEvent.change(screen.getByPlaceholderText("Nouveau mdp"), { target: { value: "NouveauPass123!" } });
    fireEvent.click(screen.getAllByText("✓").at(-1));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        expect.stringContaining("/password"),
        { nouveau_mot_de_passe: "NouveauPass123!" }
      );
    });
    expect(await screen.findByText(/Mot de passe réinitialisé/)).toBeInTheDocument();
  });

  it("annule la réinitialisation du mot de passe au clic sur ✕", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Mot de passe")[0]);
    expect(screen.getByPlaceholderText("Nouveau mdp")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("✕").at(-1));
    expect(screen.queryByPlaceholderText("Nouveau mdp")).not.toBeInTheDocument();
  });

  it("affiche une erreur si les champs du formulaire de creation sont manquants", async () => {
    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouvel admin"));

    await waitFor(() => screen.getByText("Créer l'administrateur"));
    // Utiliser fireEvent.submit pour contourner la validation HTML5 native (required)
    const form = document.querySelector("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Tous les champs sont obligatoires/)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si la creation d'un admin echoue cote API", async () => {
    mockApiPost.mockRejectedValueOnce({ message: "Email déjà utilisé" });

    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouvel admin"));

    await waitFor(() => screen.getByText("Créer l'administrateur"));
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Test" } });
    fireEvent.change(inputs[1], { target: { value: "Admin" } });
    fireEvent.change(inputs[2], { target: { value: "dup@test.com" } });
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    if (pwdInputs.length > 0) fireEvent.change(pwdInputs[0], { target: { value: "password123" } });

    fireEvent.click(screen.getByText("Créer l'administrateur"));

    expect(await screen.findByText(/Email déjà utilisé/)).toBeInTheDocument();
  });

  it("n'appelle pas l'API de suppression si l'utilisateur annule la confirmation", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Supprimer")[0]);
    // Modal de confirmation — cliquer "Annuler"
    await waitFor(() => screen.getByText("Annuler"));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it("supprime un utilisateur avec succès après confirmation", async () => {
    mockApiDelete.mockResolvedValueOnce({ message: "Utilisateur supprimé" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Supprimer")[0]);
    // Modal de confirmation — cliquer "Confirmer la suppression"
    await waitFor(() => screen.getByRole("button", { name: "Confirmer la suppression" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith(expect.stringContaining("/admin/utilisateurs/"));
    });
    expect(await screen.findByText(/Utilisateur supprimé/)).toBeInTheDocument();
  });

  it("affiche une erreur API si la suppression échoue", async () => {
    mockApiDelete.mockRejectedValueOnce({ message: "Protection premier admin" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Supprimer")[0]);
    // Modal de confirmation — cliquer "Confirmer la suppression"
    await waitFor(() => screen.getByRole("button", { name: "Confirmer la suppression" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    await waitFor(() => {
      expect(screen.getByText(/Protection premier admin/i)).toBeInTheDocument();
    });
  });
});

describe("AdminUtilisateursPage — MODERATEUR", () => {
  beforeEach(() => {
    mockUser = { prenom: "Mod", nom: "One", role: "MODERATEUR" };
    mockApiGet.mockResolvedValue({ data: users });
  });

  it("affiche la page pour un modérateur", async () => {
    render(<AdminUtilisateursPage />);
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument();
  });

  it("affiche uniquement le bouton 'Nouveau modérateur' (pas 'Nouvel admin')", async () => {
    render(<AdminUtilisateursPage />);
    expect(screen.getByText("+ Nouveau modérateur")).toBeInTheDocument();
    expect(screen.queryByText("+ Nouvel admin")).not.toBeInTheDocument();
  });

  it("affiche le formulaire de création modérateur au clic", async () => {
    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouveau modérateur"));
    expect(screen.getByText("Créer un nouveau modérateur")).toBeInTheDocument();
    expect(screen.getByText("Créer le modérateur")).toBeInTheDocument();
  });

  it("crée un modérateur via le formulaire", async () => {
    mockApiPost.mockResolvedValueOnce({ message: "Modérateur créé", id: 22 });
    mockApiGet.mockResolvedValue({ data: users });

    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouveau modérateur"));
    await waitFor(() => screen.getByText("Créer le modérateur"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Nouveau" } });
    fireEvent.change(inputs[1], { target: { value: "Modo" } });
    fireEvent.change(inputs[2], { target: { value: "nuevo@mod.com" } });
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    if (pwdInputs.length > 0) fireEvent.change(pwdInputs[0], { target: { value: "password123" } });

    fireEvent.click(screen.getByText("Créer le modérateur"));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/utilisateurs/moderateur",
        expect.objectContaining({ prenom: "Nouveau" })
      );
    });
  });

  it("n'affiche pas les boutons Mot de passe et Supprimer", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));
    expect(screen.queryByText("Mot de passe")).not.toBeInTheDocument();
    expect(screen.queryByText("Supprimer")).not.toBeInTheDocument();
  });

  it("le sélecteur de rôle ne contient pas ADMIN pour un modérateur", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Rôle")[0]);
    await waitFor(() => screen.getByRole("combobox"));

    const options = Array.from(screen.getByRole("combobox").querySelectorAll("option")).map((o) => o.value);
    expect(options).not.toContain("ADMIN");
    expect(options).toContain("MODERATEUR");
    expect(options).toContain("UTILISATEUR");
  });
});

/* ── Tests supplémentaires pour lignes non couvertes ── */
describe("AdminUtilisateursPage — couverture complémentaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet.mockResolvedValue({ data: users });
  });

  it("ferme le formulaire de création de modérateur via Annuler", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("+ Nouveau modérateur"));

    fireEvent.click(screen.getByText("+ Nouveau modérateur"));
    await waitFor(() => screen.getByText("Créer le modérateur"));

    fireEvent.click(screen.getByText("Annuler"));
    expect(screen.queryByText("Créer le modérateur")).not.toBeInTheDocument();
  });

  it("ferme le formulaire de création d'admin via Annuler", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("+ Nouvel admin"));

    fireEvent.click(screen.getByText("+ Nouvel admin"));
    await waitFor(() => screen.getByText("Créer l'administrateur"));

    fireEvent.click(screen.getByText("Annuler"));
    expect(screen.queryByText("Créer l'administrateur")).not.toBeInTheDocument();
  });

  it("bascule l'auto-validation d'un utilisateur", async () => {
    const usersWithAutoVal = [
      { ...users[2], auto_validation: 0 },
    ];
    mockApiGet
      .mockResolvedValueOnce({ data: usersWithAutoVal })
      .mockResolvedValueOnce({ data: usersWithAutoVal });
    mockApiPatch.mockResolvedValueOnce({ message: "Auto-validation activée" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    // Cliquer sur le bouton auto-validation (cherche par title)
    const toggleBtn = screen.getByTitle(/Auto-validation désactivée/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        expect.stringContaining("/auto_validation"),
        { auto_validation: true }
      );
    });
  });

  it("affiche une erreur si le toggle auto-validation echoue", async () => {
    const usersWithAutoVal = [
      { ...users[2], auto_validation: 0 },
    ];
    mockApiGet.mockResolvedValueOnce({ data: usersWithAutoVal });
    mockApiPatch.mockRejectedValueOnce({ message: "Toggle auto-validation échoué" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    const toggleBtn = screen.getByTitle(/Auto-validation désactivée/i);
    fireEvent.click(toggleBtn);

    expect(await screen.findByText(/Toggle auto-validation échoué/)).toBeInTheDocument();
  });

  it("affiche une erreur si la réinitialisation du mot de passe échoue", async () => {
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur de réinitialisation" });

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Mot de passe")[0]);
    fireEvent.change(screen.getByPlaceholderText("Nouveau mdp"), { target: { value: "NouveauPass123!" } });
    fireEvent.click(screen.getAllByText("✓").at(-1));

    expect(await screen.findByText(/Erreur de réinitialisation/)).toBeInTheDocument();
  });

  it("loadUsers ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    mockApiGet.mockRejectedValueOnce({});

    render(<AdminUtilisateursPage />);

    expect(await screen.findByText(/✗ Erreur$/)).toBeInTheDocument();
  });

  it("handleChangeRole ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    mockApiPatch.mockRejectedValueOnce({});

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Rôle")[0]);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "UTILISATEUR" } });
    fireEvent.click(screen.getByText("✓"));

    expect(await screen.findByText(/✗ Erreur$/)).toBeInTheDocument();
  });

  it("handleResetPassword ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    mockApiPatch.mockRejectedValueOnce({});

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Mot de passe")[0]);
    fireEvent.change(screen.getByPlaceholderText("Nouveau mdp"), { target: { value: "NouveauPass123!" } });
    fireEvent.click(screen.getAllByText("✓").at(-1));

    expect(await screen.findByText(/✗ Erreur$/)).toBeInTheDocument();
  });

  it("handleToggleAutoValidation ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    const usersWithAutoVal = [{ ...users[2], auto_validation: 0 }];
    mockApiGet.mockResolvedValueOnce({ data: usersWithAutoVal });
    mockApiPatch.mockRejectedValueOnce({});

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    const toggleBtn = screen.getByTitle(/Auto-validation désactivée/i);
    fireEvent.click(toggleBtn);

    expect(await screen.findByText(/✗ Erreur$/)).toBeInTheDocument();
  });

  it("confirmDelete ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    mockApiDelete.mockRejectedValueOnce({});

    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Super Admin"));

    fireEvent.click(screen.getAllByText("Supprimer")[0]);
    await waitFor(() => screen.getByRole("button", { name: "Confirmer la suppression" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la suppression" }));

    expect(await screen.findByText(/✗ Erreur$/)).toBeInTheDocument();
  });

  it("handleCreate ?? fallback : affiche 'Erreur' si l'erreur n'a pas de message", async () => {
    mockApiPost.mockRejectedValueOnce({});

    render(<AdminUtilisateursPage />);
    fireEvent.click(screen.getByText("+ Nouvel admin"));
    await waitFor(() => screen.getByText("Créer l'administrateur"));

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Test" } });
    fireEvent.change(inputs[1], { target: { value: "Admin" } });
    fireEvent.change(inputs[2], { target: { value: "test@admin.com" } });
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    if (pwdInputs.length > 0) fireEvent.change(pwdInputs[0], { target: { value: "password123" } });

    fireEvent.click(screen.getByText("Créer l'administrateur"));

    expect(await screen.findByText(/✗ Erreur$/)).toBeInTheDocument();
  });

  it("affiche 'Aucun utilisateur.' quand la liste est vide", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<AdminUtilisateursPage />);

    expect(await screen.findByText("Aucun utilisateur.")).toBeInTheDocument();
  });

  it("ne fait rien si le mot de passe est vide lors du clic ✓ (ligne 86 !editingPwd.pwd early return)", async () => {
    render(<AdminUtilisateursPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getAllByText("Mot de passe")[0]);
    expect(screen.getByPlaceholderText("Nouveau mdp")).toBeInTheDocument();

    // Cliquer ✓ sans entrer de mot de passe → early return, pas d'appel API
    fireEvent.click(screen.getAllByText("✓").at(-1));

    await waitFor(() => {
      expect(mockApiPatch).not.toHaveBeenCalled();
    });
  });

  it("affiche Auto-val. ON pour un utilisateur avec auto_validation activée (branches lignes 347-358 true)", async () => {
    const userAutoValOn = [{ ...users[2], auto_validation: 1 }];
    mockApiGet.mockResolvedValueOnce({ data: userAutoValOn });

    render(<AdminUtilisateursPage />);

    expect(await screen.findByText("Auto-val. ON")).toBeInTheDocument();
    expect(screen.getByTitle(/Auto-validation activée/i)).toBeInTheDocument();
  });

  it("affiche les couleurs fallback pour un utilisateur avec rôle inconnu (lignes 149, 284)", async () => {
    const userUnknownRole = [{ id: 99, email: "x@x.com", role: "SUPER_ADMIN", prenom: "Super", nom: "User", cree_le: "2024-01-01", auto_validation: 0 }];
    mockApiGet.mockResolvedValueOnce({ data: userUnknownRole });

    render(<AdminUtilisateursPage />);

    await waitFor(() => screen.getByText("Super User"));
    // Le rôle SUPER_ADMIN n'est pas dans counts → if (u.role in counts) false branch
    // roleColors[SUPER_ADMIN] est undefined → ?? "var(--blue-dim)" fallback
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });

  /* ─── ligne 155 : filteredUsers = q ? filter(...) : users — branche q truthy ─── */
  it("filtre les utilisateurs par nom quand une recherche est saisie (ligne 155)", async () => {
    render(<AdminUtilisateursPage />);

    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par nom, email, ID…"),
      { target: { value: "Jean" } }
    );

    await waitFor(() => {
      expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
      expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
    });
  });

  /* ─── ligne 155 : filtre par email ─── */
  it("filtre les utilisateurs par email (ligne 155 branche email)", async () => {
    render(<AdminUtilisateursPage />);

    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par nom, email, ID…"),
      { target: { value: "mod@bank.com" } }
    );

    await waitFor(() => {
      expect(screen.getByText("Mod One")).toBeInTheDocument();
      expect(screen.queryByText("Jean Dupont")).not.toBeInTheDocument();
    });
  });

  /* ─── ligne 287 : badge compteur avec search (branche search truthy) ─── */
  it("affiche le compteur filtré '1 / 3' quand une recherche est active (ligne 287)", async () => {
    render(<AdminUtilisateursPage />);

    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par nom, email, ID…"),
      { target: { value: "Jean" } }
    );

    await waitFor(() => {
      // Badge doit afficher "1 / 3" (1 résultat sur 3 total)
      expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
    });
  });

  /* ─── ligne 162 : roleOptions = isAdmin ? ROLES_ADMIN : ROLES_MODO — branche MODERATEUR ─── */
  it("affiche la page utilisateurs pour un MODERATEUR (ligne 162 branche ROLES_MODO)", async () => {
    mockUser = { prenom: "Mod", nom: "One", role: "MODERATEUR" };

    render(<AdminUtilisateursPage />);

    await waitFor(() => screen.getByText("Jean Dupont"));

    // Un MODERATEUR peut voir la liste mais les options de rôle sont limitées (ROLES_MODO)
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("Mod One")).toBeInTheDocument();
  });
});
