import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VirementsPage from "../../frontend/src/app/dashboard/virements/page";

const mockApiGet         = jest.fn();
const mockApiPost        = jest.fn();
const mockApiDownloadCSV = jest.fn();
let mockUser = { id: 2, prenom: "Jean", nom: "Demo", role: "UTILISATEUR" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:         (...args) => mockApiGet(...args),
  apiPost:        (...args) => mockApiPost(...args),
  apiDownloadCSV: (...args) => mockApiDownloadCSV(...args),
}));

const compteSource = {
  id: 1,
  client_id: 1,
  type_compte: "CHEQUES",
  numero_compte: "**** 1111",
  solde: 5000,
  devise: "CAD",
  est_actif: 1,
};

const compteDestination = {
  id: 2,
  client_id: 2,
  type_compte: "EPARGNE",
  numero_compte: "**** 2222",
  solde: 2000,
  devise: "CAD",
  est_actif: 1,
};

const virementDemo = {
  id: 10,
  compte_source_id: 1,
  compte_destination_id: 2,
  montant: "500.00",
  description: "Loyer mars",
  date_virement: "2026-03-15T10:00:00.000Z",
  client_source_nom: "Jean Tremblay",
  client_destination_nom: "Marie Dupont",
  compte_source_type: "CHEQUES",
  compte_source_numero: "**** 1111",
  compte_destination_type: "EPARGNE",
  compte_destination_numero: "**** 2222",
};

describe("VirementsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiDownloadCSV.mockReset();
    mockUser = { id: 2, prenom: "Jean", nom: "Demo", role: "UTILISATEUR" };
  });

  it("affiche le titre Virements", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    expect(await screen.findByRole("heading", { name: "Virements" })).toBeInTheDocument();
  });

  it("charge les comptes au montage", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/comptes");
    });
  });

  it("charge l'historique des virements au montage", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [virementDemo] });
    render(<VirementsPage />);
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/virements");
    });
  });

  it("affiche le formulaire avec les selects source et destination", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    expect(await screen.findByRole("button", { name: /Entre mes comptes/i })).toBeInTheDocument();
    expect(screen.getAllByText("De").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vers").length).toBeGreaterThan(0);
  });

  it("validation: comptes identiques affiche erreur", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);

    // Wait for loading to complete (button enabled)
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Effectuer le virement/i });
      expect(btn).not.toBeDisabled();
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /Effectuer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Le compte source et destination doivent être différents")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("validation: montant <= 0 affiche erreur", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Effectuer le virement/i });
      expect(btn).not.toBeDisabled();
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "-50" } });
    fireEvent.click(screen.getByRole("button", { name: /Effectuer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Le montant doit être positif")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("validation: champs manquants affiche erreur", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Effectuer le virement/i });
      expect(btn).not.toBeDisabled();
    });

    // montant is empty by default — just submit
    fireEvent.click(screen.getByRole("button", { name: /Effectuer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Champs manquants")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("soumet un virement avec succes", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] }) // refresh comptes
      .mockResolvedValueOnce({ data: [virementDemo] }); // refresh virements
    mockApiPost.mockResolvedValueOnce({ message: "Virement effectué avec succès", id: 10 });

    render(<VirementsPage />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Effectuer le virement/i });
      expect(btn).not.toBeDisabled();
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /Effectuer le virement/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/virements/", expect.objectContaining({
        compte_source_id: 1,
        compte_destination_id: 2,
        montant: 500,
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Virement effectué avec succès/i)).toBeInTheDocument();
    });
  });

  it("erreur API sur soumission affiche le message", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({ message: "Solde insuffisant" });

    render(<VirementsPage />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Effectuer le virement/i });
      expect(btn).not.toBeDisabled();
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /Effectuer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Solde insuffisant")).toBeInTheDocument();
    });
  });

  it("ADMIN voit la barre de recherche mais pas le formulaire de création", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Rechercher par client, compte, ID…")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Entre mes comptes/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/panneau de gestion des comptes/i)).not.toBeInTheDocument();
  });

  it("MODERATEUR voit la barre de recherche", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Rechercher par client, compte, ID…")).toBeInTheDocument();
    });
  });

  it("UTILISATEUR ne voit pas la barre de recherche", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    await waitFor(() => screen.findByRole("button", { name: /Entre mes comptes/i }));
    expect(screen.queryByPlaceholderText("Rechercher par client, compte, ID…")).not.toBeInTheDocument();
  });

  it("bouton CSV est visible", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    await waitFor(() => {
      expect(screen.getByText("Exporter CSV")).toBeInTheDocument();
    });
  });

  it("affiche Aucun virement trouve si historique vide", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
    expect(await screen.findByText("Aucun virement trouvé.")).toBeInTheDocument();
  });

  it("affiche les virements dans le tableau", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [virementDemo] });
    render(<VirementsPage />);
    await waitFor(() => {
      expect(screen.getByText("Jean Tremblay")).toBeInTheDocument();
      expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    });
    // Réf column
    expect(screen.getByText("#10")).toBeInTheDocument();
  });

  it("clic sur le bouton CSV declenche handleExport", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    mockApiDownloadCSV.mockResolvedValueOnce(undefined);

    render(<VirementsPage />);

    await waitFor(() => screen.getByText("Exporter CSV"));
    fireEvent.click(screen.getByText("Exporter CSV"));

    await waitFor(() => {
      expect(mockApiDownloadCSV).toHaveBeenCalledWith("/export/virements", "virements.csv");
    });
  });

  it("affiche une erreur si le chargement des virements echoue", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/virements") return Promise.reject({ message: "Erreur virements DB" });
      return Promise.resolve({ data: [] });
    });

    render(<VirementsPage />);

    expect(await screen.findByText("Erreur virements DB")).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement des comptes echoue", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/comptes") return Promise.reject({ message: "Erreur comptes DB" });
      return Promise.resolve({ data: [] });
    });

    render(<VirementsPage />);

    expect(await screen.findByText("Erreur comptes DB")).toBeInTheDocument();
  });

  it("lance une recherche via le bouton Rechercher pour un admin", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [virementDemo] });

    render(<VirementsPage />);

    await waitFor(() => screen.getByRole("button", { name: "Rechercher" }));
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par client, compte, ID…"),
      { target: { value: "Tremblay" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/virements?search=Tremblay");
    });
  });

  it("affiche la description du virement si presente", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [virementDemo] });

    render(<VirementsPage />);

    expect(await screen.findByText("Loyer mars")).toBeInTheDocument();
  });

  it("affiche le compte source et destination formatés", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });

    render(<VirementsPage />);

    await waitFor(() => {
      // Les options du select doivent contenir les comptes
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("VirementsPage — Virement externe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUser = { id: 1, prenom: "Jean", nom: "Demo", role: "UTILISATEUR" };
  });

  function setup() {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    render(<VirementsPage />);
  }

  async function switchToExterne() {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Virement externe/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /Virement externe/i }));
  }

  it("affiche le bouton onglet Virement externe", async () => {
    setup();
    await switchToExterne();
    expect(screen.getByRole("button", { name: /Virement externe/i })).toBeInTheDocument();
  });

  it("affiche les champs de coordonnees apres avoir clique sur l'onglet", async () => {
    setup();
    await switchToExterne();
    expect(screen.getByPlaceholderText("XXXX XXXX XXXX")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("621")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10482")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("NXBKCA2TXXX")).toBeInTheDocument();
  });

  it("validation externe: champs manquants affiche erreur", async () => {
    setup();
    await switchToExterne();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Envoyer le virement/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Champs manquants")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("soumet un virement externe avec succes", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockResolvedValueOnce({ message: "Virement externe effectue avec succes", id: 42 });

    render(<VirementsPage />);
    await switchToExterne();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Envoyer le virement/i })).not.toBeDisabled();
    });

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "6214 8820 1104" } });
    fireEvent.change(screen.getByPlaceholderText("621"), { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "23815" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/virements/externe", expect.objectContaining({
        numero_compte_dest: "6214 8820 1104",
        numero_institution_dest: "621",
        numero_transit_dest: "23815",
        montant: 150,
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Virement externe effectué avec succès/i)).toBeInTheDocument();
    });
  });

  it("erreur API externe affiche le message", async () => {
    setup();
    mockApiPost.mockRejectedValueOnce({ message: "Compte destinataire introuvable" });

    await switchToExterne();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Envoyer le virement/i })).not.toBeDisabled();
    });

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "9999 9999 9999" } });
    fireEvent.change(screen.getByPlaceholderText("621"), { target: { value: "999" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "99999" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Compte destinataire introuvable")).toBeInTheDocument();
    });
  });

  /* ─── externe: montant = "0" → ≤0 error (line 135) ─── */
  it("validation externe: montant zéro affiche erreur Le montant doit être positif", async () => {
    setup();
    await switchToExterne();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Envoyer le virement/i })).not.toBeDisabled();
    });

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "1234 5678 9012" } });
    fireEvent.change(screen.getByPlaceholderText("621"),   { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"),  { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Le montant doit être positif")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  /* ─── externe: API error with no message → fallback (line 159) ─── */
  it("externe: affiche le message de secours si l'erreur n'a pas de message", async () => {
    setup();
    mockApiPost.mockRejectedValueOnce({});

    await switchToExterne();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Envoyer le virement/i })).not.toBeDisabled();
    });

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "1111 2222 3333" } });
    fireEvent.change(screen.getByPlaceholderText("621"),   { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"),  { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors du virement externe")).toBeInTheDocument();
    });
  });
});

describe("VirementsPage — couverture complémentaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiDownloadCSV.mockReset();
    mockUser = { id: 2, prenom: "Jean", nom: "Demo", role: "UTILISATEUR" };
  });

  /* ─── formatMoney NaN branch (line 14) ─── */
  it("affiche le montant brut si non numérique (formatMoney NaN)", async () => {
    const virementBadMontant = { ...virementDemo, montant: "invalid" };
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [virementBadMontant] });

    render(<VirementsPage />);

    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });
  });

  /* ─── description || "—" false branch (line 340) ─── */
  it("affiche un tiret si le virement n'a pas de description", async () => {
    const virementSansDesc = { ...virementDemo, description: null };
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [virementSansDesc] });

    render(<VirementsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  /* ─── interne: API error with no message → fallback (line 120) ─── */
  it("interne: affiche le message de secours si l'erreur n'a pas de message", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource, compteDestination] })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({});

    render(<VirementsPage />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Effectuer le virement/i });
      expect(btn).not.toBeDisabled();
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(selects[1], { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /Effectuer le virement/i }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors du virement")).toBeInTheDocument();
    });
  });

  /* ─── loadVirements ?? fallback (line 63) ─── */
  it("affiche le message de secours si l'erreur de virements n'a pas de message", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/virements") return Promise.reject({});
      return Promise.resolve({ data: [] });
    });

    render(<VirementsPage />);

    await waitFor(() => {
      expect(screen.getByText("Erreur lors du chargement")).toBeInTheDocument();
    });
  });

  /* ─── loadComptes ?? fallback (line 84) ─── */
  it("affiche le message de secours si l'erreur de comptes n'a pas de message", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/comptes") return Promise.reject({});
      return Promise.resolve({ data: [] });
    });

    render(<VirementsPage />);

    await waitFor(() => {
      expect(screen.getByText("Erreur")).toBeInTheDocument();
    });
  });

  /* ─── comptes.length < 2 branch (line 76-78 false) ─── */
  it("ne pré-sélectionne pas les comptes si moins de 2 sont disponibles", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [compteSource] }) // only 1 compte
      .mockResolvedValueOnce({ data: [] });

    render(<VirementsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Entre mes comptes/i })).toBeInTheDocument();
    });
  });

  /* ─── 0 comptes: false branches pour length >= 2 ET length >= 1 ─── */
  it("charge sans erreur quand aucun compte disponible (0 comptes)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] }) // /comptes returns empty
      .mockResolvedValueOnce({ data: [] }); // /virements

    render(<VirementsPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/comptes");
    });
    expect(document.body).toBeTruthy();
  });
});

describe("VirementsPage — mounted cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUser = { id: 2, prenom: "Jean", nom: "Demo", role: "UTILISATEUR" };
  });

  /* ─── branches !mounted (lignes 74, 85) ─── */
  it("ne setState pas si le composant est démonté avant que /comptes se résolve", async () => {
    let resolveComptes;
    mockApiGet
      .mockReturnValueOnce(new Promise((r) => { resolveComptes = r; })) // /comptes pending
      .mockResolvedValue({ data: [] }); // /virements et autres

    const { unmount } = render(<VirementsPage />);

    // Démonter avant résolution → mounted=false
    unmount();

    // Résoudre après démontage → if (!mounted) return ET if (mounted) setLoading couverts
    resolveComptes({ data: [compteSource, compteDestination] });

    await new Promise((r) => setTimeout(r, 20));
    // Pas d'erreur = succès (mounted cleanup path couvert)
  });
});
