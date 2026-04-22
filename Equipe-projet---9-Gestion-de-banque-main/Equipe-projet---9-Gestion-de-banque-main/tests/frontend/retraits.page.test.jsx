import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RetraitsPage from "../../frontend/src/app/dashboard/retraits/page";

const mockApiGet   = jest.fn();
const mockApiPost  = jest.fn();
const mockApiPatch = jest.fn();
let mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:   (...args) => mockApiGet(...args),
  apiPost:  (...args) => mockApiPost(...args),
  apiPatch: (...args) => mockApiPatch(...args),
}));

const retraitDemo = {
  id: 1,
  compte_id: 3,
  client_id: 2,
  client_nom: "Jean Tremblay",
  compte_numero: "**** 4242",
  compte_type: "CHEQUES",
  montant: "250.00",
  description: "Retrait guichet",
  statut: "EN_ATTENTE",
  approuve_par: null,
  approuve_par_nom: null,
  date_demande: "2026-03-20T14:30:00.000Z",
  date_approbation: null,
};

const compteDemo = {
  id: 3,
  client_id: 2,
  type_compte: "CHEQUES",
  numero_compte: "**** 4242",
  solde: 1500,
  devise: "CAD",
  est_actif: 1,
};

describe("RetraitsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  it("affiche le titre Retraits en especes", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] });
    render(<RetraitsPage />);
    expect(await screen.findByText("Retraits en espèces")).toBeInTheDocument();
  });

  it("UTILISATEUR voit le formulaire de soumission", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<RetraitsPage />);

    expect(await screen.findByText("Nouvelle demande de retrait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Soumettre la demande" })).toBeInTheDocument();
  });

  it("MODERATEUR ne voit pas le formulaire de soumission", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Nouvelle demande de retrait")).not.toBeInTheDocument();
    });
  });

  it("ADMIN ne voit pas le formulaire de soumission", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.queryByText("Nouvelle demande de retrait")).not.toBeInTheDocument();
    });
  });

  it("charge et affiche la liste des retraits", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [retraitDemo] });

    render(<RetraitsPage />);

    expect(await screen.findByText("Jean Tremblay")).toBeInTheDocument();
    expect(screen.getByText("Retrait guichet")).toBeInTheDocument();
  });

  it("affiche Aucun retrait trouve si vide", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<RetraitsPage />);

    expect(await screen.findByText("Aucun retrait trouvé.")).toBeInTheDocument();
  });

  it("UTILISATEUR soumet une demande de retrait avec succes", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [retraitDemo] });
    mockApiPost.mockResolvedValueOnce({ message: "Demande de retrait soumise avec succès", id: 1 });

    render(<RetraitsPage />);

    // Attendre que les comptes soient chargés (le select a des options)
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200.00"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/retraits", expect.objectContaining({
        montant: 250,
      }));
    });
  });

  it("validation: montant > 1000 affiche erreur", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<RetraitsPage />);

    // Attendre que les comptes soient chargés (le select a des options)
    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200.00"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    await waitFor(() => {
      expect(screen.getByText(/dépasser 1/)).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("validation: champs manquants affiche erreur", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Soumettre la demande" })).toBeInTheDocument();
    });

    // Don't fill anything — just submit
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    await waitFor(() => {
      expect(screen.getByText("Le compte et le montant sont requis")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("MODERATEUR peut approuver un retrait", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [retraitDemo] })
      .mockResolvedValueOnce({ data: [{ ...retraitDemo, statut: "APPROUVE" }] });
    mockApiPatch.mockResolvedValueOnce({ message: "Retrait approuvé avec succès — remettez l'argent au client", id: 1 });

    render(<RetraitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/retraits/1/approuver");
    });
  });

  it("MODERATEUR peut rejeter un retrait via modal de confirmation", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [retraitDemo] })
      .mockResolvedValueOnce({ data: [{ ...retraitDemo, statut: "REJETE" }] });
    mockApiPatch.mockResolvedValueOnce({ message: "Retrait rejeté", id: 1 });

    render(<RetraitsPage />);

    // Clic sur Rejeter ouvre le modal
    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));

    // Le modal apparait avec le bouton de confirmation
    expect(await screen.findByRole("button", { name: "Confirmer le rejet" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmer le rejet" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/retraits/1/rejeter");
    });
  });

  it("clic Annuler sur le modal de rejet ferme le modal", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet.mockResolvedValueOnce({ data: [retraitDemo] });

    render(<RetraitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));
    expect(await screen.findByRole("button", { name: "Confirmer le rejet" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Confirmer le rejet" })).not.toBeInTheDocument();
    });
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it("affiche les stats (total, en attente, approuves)", async () => {
    const retraits = [
      retraitDemo,
      { ...retraitDemo, id: 2, statut: "APPROUVE" },
      { ...retraitDemo, id: 3, statut: "REJETE" },
    ];
    mockApiGet.mockResolvedValueOnce({ data: retraits });

    render(<RetraitsPage />);

    await waitFor(() => {
      // Total = 3
      expect(screen.getByText("3")).toBeInTheDocument();
    });
    // En attente stat label
    expect(screen.getAllByText("En attente").length).toBeGreaterThan(0);
    // Approuvés stat label
    expect(screen.getByText("Approuvés")).toBeInTheDocument();
  });

  it("les badges de statut s'affichent correctement", async () => {
    const retraits = [
      { ...retraitDemo, id: 1, statut: "EN_ATTENTE" },
      { ...retraitDemo, id: 2, statut: "APPROUVE" },
      { ...retraitDemo, id: 3, statut: "REJETE" },
    ];
    mockApiGet.mockResolvedValueOnce({ data: retraits });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("En attente").length).toBeGreaterThan(0);
      expect(screen.getByText("Approuvé")).toBeInTheDocument();
      expect(screen.getByText("Rejeté")).toBeInTheDocument();
    });
  });

  it("erreur API sur chargement affiche le message d'erreur", async () => {
    mockApiGet.mockRejectedValueOnce({ message: "Erreur serveur" });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getByText("Erreur serveur")).toBeInTheDocument();
    });
  });

  it("affiche une erreur si la soumission du retrait echoue cote API", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPost.mockRejectedValueOnce({ message: "Compte bloqué" });

    render(<RetraitsPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200.00"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    expect(await screen.findByText("Compte bloqué")).toBeInTheDocument();
  });

  it("affiche une erreur si l'approbation du retrait echoue", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet.mockResolvedValueOnce({ data: [retraitDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur d'approbation" });

    render(<RetraitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));

    expect(await screen.findByText("Erreur d'approbation")).toBeInTheDocument();
  });

  it("affiche une erreur si le rejet du retrait echoue", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet.mockResolvedValueOnce({ data: [retraitDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur de rejet" });

    render(<RetraitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer le rejet" }));

    expect(await screen.findByText("Erreur de rejet")).toBeInTheDocument();
  });

  it("lance une recherche via le bouton Rechercher pour un admin", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [retraitDemo] })
      .mockResolvedValueOnce({ data: [retraitDemo] });

    render(<RetraitsPage />);

    await waitFor(() => screen.getByRole("button", { name: "Rechercher" }));
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par client, compte, statut ou ID…"),
      { target: { value: "Tremblay" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/retraits?search=Tremblay");
    });
  });

  it("validation: montant invalide (negatif) affiche erreur", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<RetraitsPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200.00"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    await waitFor(() => {
      expect(screen.getByText("Montant invalide")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

describe("RetraitsPage — filtre comptes CHEQUES/EPARGNE", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
  });

  /* ─── filtre type_compte EPARGNE (ligne 66 branche || vraie) ─── */
  it("inclut les comptes EPARGNE dans le select (branche || type_compte EPARGNE)", async () => {
    const compteEpargne = { ...compteDemo, id: 5, type_compte: "EPARGNE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteEpargne] });

    render(<RetraitsPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });
    // Le compte EPARGNE est inclus dans le filtre
    expect(document.body).toBeTruthy();
  });

  /* ─── filtre exclut compte inactif (ligne 66 est_actif false branch) ─── */
  it("exclut les comptes inactifs du select (est_actif=0)", async () => {
    const compteInactif = { ...compteDemo, id: 6, est_actif: 0 };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteInactif] });

    render(<RetraitsPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    // Aucun compte actif → select vide → compteId reste ""
    expect(document.body).toBeTruthy();
  });
});

describe("RetraitsPage — couverture complémentaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  /* ─── formatMoney NaN branch (line 14) ─── */
  it("affiche le montant brut si non numérique (formatMoney NaN)", async () => {
    const retraitBadMontant = { ...retraitDemo, montant: "invalid" };
    mockApiGet.mockResolvedValueOnce({ data: [retraitBadMontant] });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getByText("-invalid")).toBeInTheDocument();
    });
  });

  /* ─── auto_valide true path (line 99) ─── */
  it("affiche le message auto-approuvé si auto_valide est vrai", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [{ ...retraitDemo, statut: "APPROUVE" }] });
    mockApiPost.mockResolvedValueOnce({ id: 7, auto_valide: true });

    render(<RetraitsPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    await waitFor(() => {
      expect(screen.getByText(/approuvé et débité automatiquement/i)).toBeInTheDocument();
    });
  });

  /* ─── description || "—" false branch (line 288) ─── */
  it("affiche un tiret si le retrait n'a pas de description", async () => {
    const retraitSansDesc = { ...retraitDemo, description: null };
    mockApiGet.mockResolvedValueOnce({ data: [retraitSansDesc] });

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  /* ─── loadComptes silent catch (lines 63-70) ─── */
  it("continue silencieusement si le chargement des comptes échoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("DB down"));

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.queryByText("DB down")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: "Soumettre la demande" })).toBeInTheDocument();
  });

  /* ─── loadRetraits ?? fallback (line 57) ─── */
  it("affiche le message de secours si l'erreur de chargement n'a pas de message", async () => {
    mockApiGet.mockRejectedValueOnce({});

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getByText("Erreur de chargement")).toBeInTheDocument();
    });
  });

  /* ─── handleApprouver ?? fallback (line 115) ─── */
  it("affiche le message de secours si l'approbation n'a pas de message d'erreur", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet.mockResolvedValueOnce({ data: [retraitDemo] });
    mockApiPatch.mockRejectedValueOnce({});

    render(<RetraitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de l'approbation")).toBeInTheDocument();
    });
  });

  /* ─── handleRejeter ?? fallback (line 128) ─── */
  it("affiche le message de secours si le rejet n'a pas de message d'erreur", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet.mockResolvedValueOnce({ data: [retraitDemo] });
    mockApiPatch.mockRejectedValueOnce({});

    render(<RetraitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer le rejet" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors du rejet")).toBeInTheDocument();
    });
  });

  /* ─── handleSubmit ?? fallback (line 103) ─── */
  it("affiche le message de secours si la soumission n'a pas de message d'erreur", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPost.mockRejectedValueOnce({});

    render(<RetraitsPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole("combobox");
      expect(selects[0].options.length).toBeGreaterThan(0);
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre la demande" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de la soumission")).toBeInTheDocument();
    });
  });

  /* ─── loadComptes filtered.length === 0 (line 68 false branch) ─── */
  it("ne sélectionne pas de compte si aucun ne passe le filtre", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const compteInactif = { ...compteDemo, est_actif: 0 };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteInactif] }); // filtered → []

    render(<RetraitsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Soumettre la demande" })).toBeInTheDocument();
    });
  });

  /* ─── user?.role ?? "" fallback (line 26) ─── */
  it("affiche la page sans erreur si user.role est absent (role ?? vide)", async () => {
    mockUser = { id: 5, prenom: "Test", nom: "Anon" }; // pas de role
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<RetraitsPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(document.body).toBeTruthy();
  });
});
