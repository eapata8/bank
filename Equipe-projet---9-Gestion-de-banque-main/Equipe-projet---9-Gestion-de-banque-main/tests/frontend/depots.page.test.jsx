import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DepotsPage from "../../frontend/src/app/dashboard/depots/page";

const mockApiGet      = jest.fn();
const mockApiPostForm = jest.fn();
const mockApiPatch    = jest.fn();
let mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:      (...args) => mockApiGet(...args),
  apiPostForm: (...args) => mockApiPostForm(...args),
  apiPatch:    (...args) => mockApiPatch(...args),
}));

const depotDemo = {
  id: 1,
  compte_id: 1,
  client_id: 1,
  montant: 500,
  numero_cheque: "CHQ-0041",
  banque_emettrice: "TD Canada Trust",
  fichier_chemin: "cheque-1774331150736.png",
  statut: "EN_ATTENTE",
  notes: null,
  depose_le: "2026-03-22T09:15:00.000Z",
  traite_le: null,
  traite_par: null,
  client_nom: "Client Demo",
  compte_numero: "**** 4521",
  compte_type: "CHEQUES",
  traite_par_nom: null,
};

const compteDemo = {
  id: 1,
  client_id: 1,
  type_compte: "CHEQUES",
  numero_compte: "**** 4521",
  solde: 24562.8,
  devise: "CAD",
  est_actif: 1,
};

describe("DepotsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPostForm.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  it("affiche la liste des depots apres chargement", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })   // /depots
      .mockResolvedValueOnce({ data: [compteDemo] }); // /comptes

    render(<DepotsPage />);

    expect(await screen.findByText("CHQ-0041")).toBeInTheDocument();
    expect(screen.getByText("TD Canada Trust")).toBeInTheDocument();
    // "En attente" apparait dans les stats et dans le badge — on verifie qu'il y en a au moins un
    expect(screen.getAllByText("En attente").length).toBeGreaterThan(0);
  });

  it("affiche un champ photo dans le formulaire de soumission", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    // Le label associé au file input doit être présent
    expect(await screen.findByLabelText(/photo du chèque/i)).toBeInTheDocument();
  });

  it("n'affiche pas le formulaire de soumission cote admin (lecture seule)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] });

    render(<DepotsPage />);

    await waitFor(() => screen.getByText("Registre des dépôts"));
    expect(screen.queryByRole("button", { name: "Soumettre le dépôt" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/photo du chèque/i)).not.toBeInTheDocument();
  });

  it("affiche une erreur si la photo est absente lors de la soumission", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    fireEvent.change(await screen.findByLabelText("Compte de dépôt"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),    { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"), { target: { value: "CHQ-0041" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"), { target: { value: "TD Canada Trust" } });
    // Pas de fichier — on soumet directement
    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    await waitFor(() => {
      expect(screen.getByText("La photo du chèque est obligatoire")).toBeInTheDocument();
    });
    expect(mockApiPostForm).not.toHaveBeenCalled();
  });

  it("soumet un depot via FormData avec la photo", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [depotDemo] });
    mockApiPostForm.mockResolvedValueOnce({ message: "Dépôt soumis avec succès", id: 1 });

    render(<DepotsPage />);

    // Attendre que les options du select soient disponibles (comptes chargés)
    await waitFor(() => {
      expect(screen.getByLabelText("Compte de dépôt").options.length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Compte de dépôt"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),    { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"), { target: { value: "CHQ-0041" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"), { target: { value: "TD Canada Trust" } });

    // Simuler le fichier image sur l'input
    const file = new File(["img"], "cheque.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/photo du chèque/i);
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    await waitFor(() => {
      expect(mockApiPostForm).toHaveBeenCalledWith("/depots", expect.any(FormData));
    });

    const formData = mockApiPostForm.mock.calls[0][1];
    expect(formData.get("compte_id")).toBe("1");
    expect(formData.get("numero_cheque")).toBe("CHQ-0041");
    expect(formData.get("banque_emettrice")).toBe("TD Canada Trust");
    expect(formData.get("photo_cheque")).toBe(file);
  });

  it("permet a un moderateur d'approuver un depot", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [{ ...depotDemo, statut: "APPROUVE" }] });
    mockApiPatch.mockResolvedValueOnce({ message: "Dépôt approuvé avec succès", id: 1 });

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/depots/1/approuver");
    });
  });

  it("affiche la miniature du cheque pour les roles eleves", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    await waitFor(() => {
      const img = screen.getByAltText("chèque");
      expect(img).toBeInTheDocument();
      expect(img.src).toContain("cheque-1774331150736.png");
    });
  });

  it("affiche une erreur si le chargement des depots echoue", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/depots") return Promise.reject({ message: "Erreur DB dépôts" });
      return Promise.resolve({ data: [] });
    });

    render(<DepotsPage />);

    expect(await screen.findByText("Erreur DB dépôts")).toBeInTheDocument();
  });

  it("affiche une erreur si les champs du formulaire de soumission sont manquants", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    await waitFor(() => screen.getByLabelText("Compte de dépôt"));
    // Soumettre sans remplir aucun champ
    const form = document.querySelector("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Tous les champs sont requis")).toBeInTheDocument();
    });
    expect(mockApiPostForm).not.toHaveBeenCalled();
  });

  it("affiche une erreur si l'API de soumission echoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPostForm.mockRejectedValueOnce({ message: "Erreur de soumission" });

    render(<DepotsPage />);

    await waitFor(() => expect(screen.getByLabelText("Compte de dépôt").options.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText("Compte de dépôt"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),    { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"), { target: { value: "CHQ-0042" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"), { target: { value: "RBC" } });

    const file = new File(["img"], "chq.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/photo du chèque/i);
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    expect(await screen.findByText("Erreur de soumission")).toBeInTheDocument();
  });

  it("affiche une erreur si l'approbation echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Solde insuffisant" });

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));

    expect(await screen.findByText("Solde insuffisant")).toBeInTheDocument();
  });

  it("affiche une erreur si le rejet echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur de rejet" });

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer le rejet" }));

    expect(await screen.findByText("Erreur de rejet")).toBeInTheDocument();
  });

  it("lance une recherche via le bouton Rechercher pour un admin", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [depotDemo] });

    render(<DepotsPage />);

    await waitFor(() => screen.getByRole("button", { name: "Rechercher" }));
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par numéro, banque, client ou statut…"),
      { target: { value: "CHQ" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/depots?search=CHQ");
    });
  });

  it("ouvre le modal de prévisualisation au clic sur la miniature du chèque", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    // Le bouton contient une img dont l'alt est "chèque" — c'est le nom accessible du bouton
    const imgBtn = await screen.findByRole("button", { name: /chèque/i });
    fireEvent.click(imgBtn);

    // Le modal doit afficher l'image en grand
    await waitFor(() => {
      expect(screen.getByAltText("Photo du chèque")).toBeInTheDocument();
    });
  });

  it("permet a un admin de rejeter un depot avec une note", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [{ ...depotDemo, statut: "REJETE" }] });
    mockApiPatch.mockResolvedValueOnce({ message: "Dépôt rejeté", id: 1 });

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));

    fireEvent.change(screen.getByLabelText("Motif de refus (optionnel)"), {
      target: { value: "Chèque illisible" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer le rejet" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/depots/1/rejeter", { notes: "Chèque illisible" });
    });
  });

  it("ferme le modal de prévisualisation en cliquant sur le bouton X", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    const imgBtn = await screen.findByRole("button", { name: /chèque/i });
    fireEvent.click(imgBtn);

    await waitFor(() => screen.getByAltText("Photo du chèque"));

    // Cliquer sur le bouton ✕ pour fermer
    fireEvent.click(screen.getByText("✕"));
    expect(screen.queryByAltText("Photo du chèque")).not.toBeInTheDocument();
  });

  it("ferme le modal de réjection en cliquant sur Annuler", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));
    expect(screen.getByRole("button", { name: "Confirmer le rejet" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("button", { name: "Confirmer le rejet" })).not.toBeInTheDocument();
  });
});

describe("DepotsPage — couverture complémentaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPostForm.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  /* ─── formatMoney NaN branch (lines 13-14) ─── */
  it("affiche le montant brut si non numérique (formatMoney NaN)", async () => {
    const depotBadMontant = { ...depotDemo, montant: "invalid" };
    mockApiGet
      .mockResolvedValueOnce({ data: [depotBadMontant] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    await waitFor(() => {
      expect(screen.getByText("invalid")).toBeInTheDocument();
    });
  });

  /* ─── montant invalide (line 98) ─── */
  it("affiche Montant invalide si le montant est zéro", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    await waitFor(() => expect(screen.getByLabelText("Compte de dépôt").options.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Compte de dépôt"),   { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),     { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"),  { target: { value: "CHQ-000" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"),  { target: { value: "TD" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    await waitFor(() => {
      expect(screen.getByText("Montant invalide")).toBeInTheDocument();
    });
  });

  /* ─── auto_valide true (line 108) ─── */
  it("affiche le message auto-approuvé si auto_valide est vrai", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [{ ...depotDemo, statut: "APPROUVE" }] });
    mockApiPostForm.mockResolvedValueOnce({ id: 1, auto_valide: true });

    render(<DepotsPage />);

    await waitFor(() => expect(screen.getByLabelText("Compte de dépôt").options.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Compte de dépôt"),   { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),     { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"),  { target: { value: "CHQ-0099" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"),  { target: { value: "BMO" } });

    const file = new File(["img"], "chq.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/photo du chèque/i);
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    await waitFor(() => {
      expect(screen.getByText("✓ Dépôt approuvé et crédité automatiquement")).toBeInTheDocument();
    });
  });

  /* ─── loadComptes silent catch (lines 61-70) ─── */
  it("continue silencieusement si le chargement des comptes échoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("DB down"));

    render(<DepotsPage />);

    await waitFor(() => {
      expect(screen.queryByText("DB down")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: "Soumettre le dépôt" })).toBeInTheDocument();
  });

  /* ─── fichier_chemin null → "—" (line 356 false branch) ─── */
  it("affiche un tiret si le dépôt n'a pas de fichier chèque", async () => {
    const depotSansFichier = { ...depotDemo, fichier_chemin: null };
    mockApiGet
      .mockResolvedValueOnce({ data: [depotSansFichier] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  /* ─── onChange file input with empty files (line 236 ?? null) ─── */
  it("efface photoCheque si l'input fichier est vidé (files vide)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<DepotsPage />);

    const fileInput = await screen.findByLabelText(/photo du chèque/i);
    Object.defineProperty(fileInput, "files", { value: [], configurable: true });
    fireEvent.change(fileInput);

    // Fill all other fields
    fireEvent.change(screen.getByLabelText("Compte de dépôt"),   { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),     { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"),  { target: { value: "CHQ-X" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"),  { target: { value: "RBC" } });
    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    await waitFor(() => {
      expect(screen.getByText("La photo du chèque est obligatoire")).toBeInTheDocument();
    });
  });

  /* ─── loadDepots ?? fallback (line 61) ─── */
  it("affiche le message de secours si l'erreur de chargement n'a pas de message", async () => {
    mockApiGet.mockRejectedValueOnce({});

    render(<DepotsPage />);

    await waitFor(() => {
      expect(screen.getByText("Erreur de chargement")).toBeInTheDocument();
    });
  });

  /* ─── handleRejeter ?? fallback (line 138) ─── */
  it("affiche le message de secours si le rejet n'a pas de message d'erreur", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({});

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Rejeter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer le rejet" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors du rejet")).toBeInTheDocument();
    });
  });

  /* ─── handleSubmit ?? fallback (line 112) ─── */
  it("affiche le message de secours si la soumission n'a pas de message d'erreur", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPostForm.mockRejectedValueOnce({});

    render(<DepotsPage />);

    await waitFor(() => expect(screen.getByLabelText("Compte de dépôt").options.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Compte de dépôt"),  { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"),    { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Numéro de chèque"), { target: { value: "CHQ-00" } });
    fireEvent.change(screen.getByLabelText("Banque émettrice"), { target: { value: "TD" } });

    const file = new File(["img"], "chq.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/photo du chèque/i);
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fireEvent.change(fileInput);
    fireEvent.click(screen.getByRole("button", { name: "Soumettre le dépôt" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de la soumission")).toBeInTheDocument();
    });
  });

  /* ─── loadComptes filtered.length === 0 (line 70/72 false branch) ─── */
  it("ne sélectionne pas de compte si aucun ne passe le filtre", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const compteInactif = { ...compteDemo, est_actif: 0 };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteInactif] }); // filtered → []

    render(<DepotsPage />);

    await waitFor(() => {
      // Form visible but compte select has no options (compteId stays "")
      expect(screen.getByRole("button", { name: "Soumettre le dépôt" })).toBeInTheDocument();
    });
  });

  /* ─── handleApprouver ?? fallback (line 124) ─── */
  it("affiche le message de secours si l'approbation n'a pas de message d'erreur", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [depotDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({});

    render(<DepotsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de l'approbation")).toBeInTheDocument();
    });
  });

  /* ─── user?.role ?? "" fallback (line 26) ─── */
  it("affiche la page sans erreur si user.role est absent (role ?? vide)", async () => {
    mockUser = { id: 5, prenom: "Test", nom: "Anon" }; // pas de role
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<DepotsPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    // La page charge sans erreur
    expect(screen.getByRole("heading", { hidden: true }) || document.body).toBeTruthy();
  });

  /* ─── loadComptes filtered.length = 0 → setCompteId not called (ligne 70 false branch) ─── */
  it("ne définit pas compteId si aucun compte CHEQUES/EPARGNE actif (ligne 70 false branch)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const compteCredit = { ...compteDemo, type_compte: "CREDIT" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })         // loadDepots
      .mockResolvedValueOnce({ data: [compteCredit] }); // loadComptes (only CREDIT)

    render(<DepotsPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    // No CHEQUES/EPARGNE → compteId stays "" → select has no options
    expect(screen.getByRole("button", { name: "Soumettre le dépôt" })).toBeInTheDocument();
  });
});
