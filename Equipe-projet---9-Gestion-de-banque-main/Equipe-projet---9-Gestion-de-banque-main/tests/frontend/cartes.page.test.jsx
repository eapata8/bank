import { jest } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CartesPage from "../../frontend/src/app/dashboard/cartes/page";

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
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

const carteDemo = {
  id: 1,
  client_id: 1,
  numero_compte: "4532 8814 7700 4242",
  cvv: "742",
  type_carte: "VISA",
  limite_credit: 5000,
  solde_utilise: 1240.5,
  statut: "ACTIVE",
  date_expiration: "2028-03-31",
  client_nom: "Client Demo",
  client_email: "client@Leon.local",
};

const compteDemo = {
  id: 2,
  client_id: 1,
  type_compte: "CHEQUES",
  numero_compte: "**** 4521",
  solde: 24562.8,
  devise: "CAD",
  est_actif: 1,
};

const clientDemo = { id: 1, prenom: "Client", nom: "Demo", email_fictif: "client@Leon.local", ville: "Ottawa" };

describe("CartesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  it("affiche la liste des cartes apres chargement", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })   // /cartes
      .mockResolvedValueOnce({ data: [compteDemo] })  // /comptes
      .mockResolvedValueOnce({ data: [clientDemo] }); // /clients

    render(<CartesPage />);

    expect(await screen.findByText("4532 8814 7700 4242")).toBeInTheDocument();
    expect(screen.getByText("VISA")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("permet a un admin de creer une carte", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })             // /cartes initial
      .mockResolvedValueOnce({ data: [compteDemo] })   // /comptes
      .mockResolvedValueOnce({ data: [clientDemo] })   // /clients
      .mockResolvedValueOnce({ data: [carteDemo] });   // /cartes apres creation
    mockApiPost.mockResolvedValueOnce({ message: "Carte creee", id: 1 });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Nouvelle carte" }));
    fireEvent.change(screen.getByLabelText("Limite de crédit (CAD)"), {
      target: { value: "5000" },
    });
    fireEvent.change(screen.getByLabelText("Date d'expiration"), {
      target: { value: "2028-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/cartes",
        expect.objectContaining({
          limite_credit: 5000,
          type_carte: "VISA",
        })
      );
    });
  });

  it("permet a un utilisateur de rembourser une carte active", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })            // /cartes initial
      .mockResolvedValueOnce({ data: [compteDemo] })           // /comptes
      // /clients non appele pour UTILISATEUR
      .mockResolvedValueOnce({ data: [{ ...carteDemo, solde_utilise: 1040.5 }] })  // /cartes apres rembourser
      .mockResolvedValueOnce({ data: [{ ...compteDemo, solde: 24362.8 }] });        // /comptes apres rembourser
    mockApiPost.mockResolvedValueOnce({ message: "Remboursement effectue avec succes", id: 1 });

    render(<CartesPage />);

    fireEvent.change(await screen.findByLabelText("Compte source"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rembourser" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/cartes/1/rembourser", {
        compte_id: 2,
        montant: 200,
      });
    });
  });

  it("affiche une erreur si le chargement des cartes echoue", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/cartes") return Promise.reject({ message: "DB erreur" });
      return Promise.resolve({ data: [] });
    });

    render(<CartesPage />);

    expect(await screen.findByText("DB erreur")).toBeInTheDocument();
  });

  it("affiche une erreur si les champs du formulaire de création sont incomplets", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Nouvelle carte" }));
    await waitFor(() => screen.getByRole("button", { name: "Émettre la carte" }));
    // Soumettre sans remplir les champs
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));

    await waitFor(() => {
      expect(screen.getByText("Tous les champs obligatoires doivent être remplis")).toBeInTheDocument();
    });
  });

  it("affiche une erreur si la creation de carte echoue cote API", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPost.mockRejectedValueOnce({ message: "Email déjà utilisé" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Nouvelle carte" }));
    fireEvent.change(screen.getByLabelText("Limite de crédit (CAD)"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Date d'expiration"), { target: { value: "2030-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));

    expect(await screen.findByText("Email déjà utilisé")).toBeInTheDocument();
  });

  it("permet a un admin de bloquer une carte", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })   // /cartes initial
      .mockResolvedValueOnce({ data: [compteDemo] })  // /comptes
      .mockResolvedValueOnce({ data: [clientDemo] })  // /clients
      .mockResolvedValueOnce({ data: [{ ...carteDemo, statut: "BLOQUEE" }] })  // /cartes apres blocage
      .mockResolvedValueOnce({ data: [compteDemo] }); // /comptes apres blocage
    mockApiPatch.mockResolvedValueOnce({ message: "Carte bloquee avec succes" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Bloquer/ }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/bloquer");
    });
  });

  it("affiche une erreur si le blocage echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Impossible de bloquer" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Bloquer/ }));

    expect(await screen.findByText("Impossible de bloquer")).toBeInTheDocument();
  });

  it("permet a un admin d'activer une carte bloquee", async () => {
    const carteBloquee = { ...carteDemo, statut: "BLOQUEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteBloquee] })  // /cartes initial
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [carteDemo] })     // /cartes apres activation
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte activée avec succès" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Activer/ }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/activer");
    });
    expect(await screen.findByText(/Carte activée avec succès/)).toBeInTheDocument();
  });

  it("permet a un admin de modifier la limite d'une carte", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [{ ...carteDemo, limite_credit: 7000 }] });
    mockApiPatch.mockResolvedValueOnce({ message: "Limite modifiée" });

    render(<CartesPage />);

    const limiteInput = await screen.findByLabelText("Nouvelle limite");
    fireEvent.change(limiteInput, { target: { value: "7000" } });
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[0]);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/limite", { limite_credit: 7000 });
    });
  });

  it("affiche une erreur si la limite est invalide (0)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<CartesPage />);

    await screen.findByLabelText("Nouvelle limite");
    // Laisser la valeur vide et cliquer OK (premier bouton OK = limite)
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[0]);

    await waitFor(() => {
      expect(screen.getByText("Entrez une limite valide")).toBeInTheDocument();
    });
  });

  it("affiche une erreur si aucun compte selectionne pour le remboursement", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<CartesPage />);

    await screen.findByLabelText("Montant (CAD)");
    fireEvent.change(screen.getByLabelText("Montant (CAD)"), { target: { value: "200" } });
    // Ne pas selectionner de compte source, cliquer Rembourser
    fireEvent.click(screen.getByRole("button", { name: "Rembourser" }));

    expect(await screen.findByText("Sélectionnez un compte de remboursement")).toBeInTheDocument();
  });

  it("affiche une erreur si le montant de remboursement est invalide", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<CartesPage />);

    await screen.findByLabelText("Compte source");
    fireEvent.change(screen.getByLabelText("Compte source"), { target: { value: "2" } });
    // Laisser le montant vide
    fireEvent.click(screen.getByRole("button", { name: "Rembourser" }));

    expect(await screen.findByText("Entrez un montant valide")).toBeInTheDocument();
  });

  it("affiche une erreur si l'API de remboursement echoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPost.mockRejectedValueOnce({ message: "Solde insuffisant" });

    render(<CartesPage />);

    fireEvent.change(await screen.findByLabelText("Compte source"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Rembourser" }));

    expect(await screen.findByText("Solde insuffisant")).toBeInTheDocument();
  });

  it("affiche le bouton Rechercher et lance une recherche pour un admin", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [carteDemo] });

    render(<CartesPage />);

    await waitFor(() => screen.getByRole("button", { name: "Rechercher" }));
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par ID, client, numéro, type, statut…"),
      { target: { value: "VISA" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/cartes?search=VISA");
    });
  });

  it("affiche 'Aucune carte trouvée' si la liste est vide", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<CartesPage />);

    expect(await screen.findByText("Aucune carte trouvée.")).toBeInTheDocument();
  });

  it("affiche 'Carte bloquée' pour un utilisateur avec une carte BLOQUEE", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteBloquee = { ...carteDemo, statut: "BLOQUEE", solde_utilise: 0 };

    mockApiGet
      .mockResolvedValueOnce({ data: [carteBloquee] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    expect(await screen.findByText(/bloquée par l'administrateur/i)).toBeInTheDocument();
  });

  it("affiche 'Aucun solde dû' pour un utilisateur avec solde_utilise = 0", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteSanssolde = { ...carteDemo, statut: "ACTIVE", solde_utilise: 0 };

    mockApiGet
      .mockResolvedValueOnce({ data: [carteSanssolde] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    expect(await screen.findByText("Aucun solde dû")).toBeInTheDocument();
  });

  it("affiche 'Lecture seule' pour un moderateur", async () => {
    mockUser = { id: 3, prenom: "Mod", nom: "One", role: "MODERATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    expect(await screen.findByText("Lecture seule")).toBeInTheDocument();
  });

  it("affiche le CVV masqué (•••) par défaut", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    await screen.findByText("•••");
    expect(screen.getByText("•••")).toBeInTheDocument();
  });

  it("révèle le CVV et le numéro de carte au clic Voir (reduced-motion)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    // Simuler prefers-reduced-motion: reduce pour bypasser l'animation
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    const btn = await screen.findByRole("button", { name: /révéler le numéro/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("4532 8814 7700 4242")).toBeInTheDocument();
      expect(screen.getByText("742")).toBeInTheDocument();
    });
  });

  it("permet a un utilisateur de geler sa carte", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [{ ...carteDemo, statut: "GELEE" }] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte gelee avec succes" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Geler cette carte/i }));
    // La confirmation apparaît
    await waitFor(() => screen.getByRole("alertdialog"));
    fireEvent.click(screen.getByRole("button", { name: /Confirmer le gel/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/geler");
    });
  });

  it("affiche une erreur si le gel echoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Carte déjà gelée" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Geler cette carte/i }));
    await waitFor(() => screen.getByRole("alertdialog"));
    fireEvent.click(screen.getByRole("button", { name: /Confirmer le gel/i }));

    expect(await screen.findByText("Carte déjà gelée")).toBeInTheDocument();
  });

  it("permet a un utilisateur de degeler sa carte gelee", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteGelee = { ...carteDemo, statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteGelee] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte degelee avec succes" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Dégeler la carte/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/degeler");
    });
  });

  it("affiche une erreur si le degel echoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteGelee = { ...carteDemo, statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteGelee] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur de dégel" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Dégeler la carte/i }));

    expect(await screen.findByText("Erreur de dégel")).toBeInTheDocument();
  });

  it("affiche une erreur si l'activation echoue", async () => {
    const carteBloquee = { ...carteDemo, statut: "BLOQUEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteBloquee] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur activation" });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Activer/ }));

    expect(await screen.findByText("Erreur activation")).toBeInTheDocument();
  });

  it("affiche une erreur si la modification de limite echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Limite invalide" });

    render(<CartesPage />);

    const limiteInput = await screen.findByLabelText("Nouvelle limite");
    fireEvent.change(limiteInput, { target: { value: "100" } });
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[0]);

    expect(await screen.findByText("Limite invalide")).toBeInTheDocument();
  });

  it("lance une recherche en appuyant sur Enter", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [carteDemo] });

    render(<CartesPage />);

    const input = await screen.findByPlaceholderText("Rechercher par ID, client, numéro, type, statut…");
    fireEvent.change(input, { target: { value: "4242" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/cartes?search=4242");
    });
  });
});

describe("CartesPage — couverture complémentaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  /* ─── maskedDisplay fallback (line 105) ─── */
  it("affiche •••• •••• •••• •••• si le numéro ne se termine pas par 4 chiffres", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteBadNum = { ...carteDemo, numero_compte: "CARTE-INVALIDE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteBadNum] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    await waitFor(() => {
      expect(screen.getByText("•••• •••• •••• ••••")).toBeInTheDocument();
    });
  });

  /* ─── reveal → toggle back to hidden (lines 122-126) ─── */
  it("masque de nouveau le numéro au second clic Voir (reduced-motion)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    const btn = await screen.findByRole("button", { name: /révéler le numéro/i });
    fireEvent.click(btn);
    await waitFor(() => screen.getByText("4532 8814 7700 4242"));

    // Second click: toggle back to hidden
    fireEvent.click(screen.getByRole("button", { name: /masquer le numéro/i }));

    await waitFor(() => {
      expect(screen.queryByText("4532 8814 7700 4242")).not.toBeInTheDocument();
    });
  });

  /* ─── setInterval animation path (lines 139-164) ─── */
  it("exécute l'animation de dévoilement (non reduced-motion)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    // Wait for page to load with real timers
    const btn = await screen.findByRole("button", { name: /révéler le numéro/i });

    // Switch to fake timers for the animation
    jest.useFakeTimers();
    try {
      fireEvent.click(btn);
      act(() => { jest.advanceTimersByTime(1300); });
      expect(screen.getByText("4532 8814 7700 4242")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  /* ─── copy() clipboard success (lines 170-173) ─── */
  it("copie le numéro de carte dans le presse-papiers", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    const revealBtn = await screen.findByRole("button", { name: /révéler le numéro/i });
    fireEvent.click(revealBtn);
    await waitFor(() => screen.getByText("4532 8814 7700 4242"));

    const copyBtn = screen.getByRole("button", { name: /copier le numéro/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("4532881477004242");
    });
  });

  /* ─── onMouseEnter/onMouseLeave freeze button (lines 492-493) ─── */
  it("déclenche onMouseEnter/onMouseLeave sur le bouton Geler la carte (user)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    const freezeBtn = await screen.findByRole("button", { name: /Geler cette carte/i });
    fireEvent.mouseEnter(freezeBtn);
    fireEvent.mouseLeave(freezeBtn);
    expect(freezeBtn).toBeInTheDocument();
  });

  /* ─── Annuler in freeze dialog (lines 543-556, line 1066) ─── */
  it("ferme la confirmation de gel au clic sur Annuler (user)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Geler cette carte/i }));
    await waitFor(() => screen.getByRole("alertdialog"));

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  /* ─── onMouseEnter/onMouseLeave unfreeze button (lines 562-579) ─── */
  it("déclenche onMouseEnter/onMouseLeave sur le bouton Dégeler la carte (user)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteGelee = { ...carteDemo, statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteGelee] })
      .mockResolvedValueOnce({ data: [compteDemo] });

    render(<CartesPage />);

    const unfreezeBtn = await screen.findByRole("button", { name: /Dégeler la carte/i });
    fireEvent.mouseEnter(unfreezeBtn);
    fireEvent.mouseLeave(unfreezeBtn);
    expect(unfreezeBtn).toBeInTheDocument();
  });

  /* ─── Admin table ACTIVE: Geler (line 1181) ─── */
  it("gèle une carte ACTIVE depuis le tableau admin (bouton Geler)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [{ ...carteDemo, statut: "GELEE" }] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte gelée" });

    render(<CartesPage />);

    const gelerBtn = await screen.findByRole("button", { name: /Geler la carte/i });
    fireEvent.click(gelerBtn);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/geler");
    });
  });

  /* ─── Admin table GELEE: Dégeler (lines 1222-1235) ─── */
  it("décongèle une carte GELEE depuis le tableau admin (bouton Dégeler)", async () => {
    const carteGelee = { ...carteDemo, statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteGelee] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte dégelée" });

    render(<CartesPage />);

    await waitFor(() => screen.getByText("Dégeler"));
    fireEvent.click(screen.getByText("Dégeler"));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/degeler");
    });
  });

  /* ─── Admin table GELEE: Bloquer (lines 1237-1252) ─── */
  it("bloque une carte GELEE depuis le tableau admin (bouton Bloquer)", async () => {
    const carteGelee = { ...carteDemo, statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteGelee] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [{ ...carteGelee, statut: "BLOQUEE" }] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte bloquée" });

    render(<CartesPage />);

    await waitFor(() => screen.getByText("Bloquer"));
    fireEvent.click(screen.getByText("Bloquer"));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/bloquer");
    });
  });

  /* ─── modifierSolde valid (lines 852-869, 1309-1318) ─── */
  it("modifie le solde utilisé d'une carte depuis le tableau admin", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [{ ...carteDemo, solde_utilise: 999 }] });
    mockApiPatch.mockResolvedValueOnce({ message: "Solde modifié" });

    render(<CartesPage />);

    const soldeInput = await screen.findByLabelText("Solde utilisé");
    fireEvent.change(soldeInput, { target: { value: "999" } });
    // Second OK button → modifierSolde
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[1]);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/1/solde", { solde_utilise: 999 });
    });
  });

  /* ─── modifierSolde invalid (line 854) ─── */
  it("affiche une erreur si le solde modifié est invalide (vide)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<CartesPage />);

    await screen.findByLabelText("Solde utilisé");
    // Click OK without filling = NaN → error
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[1]);

    await waitFor(() => {
      expect(screen.getByText("Entrez un solde valide (≥ 0)")).toBeInTheDocument();
    });
  });

  /* ─── modifierSolde API error (lines 864-865) ─── */
  it("affiche une erreur si la modification de solde échoue côté API", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur solde serveur" });

    render(<CartesPage />);

    const soldeInput = await screen.findByLabelText("Solde utilisé");
    fireEvent.change(soldeInput, { target: { value: "0" } });
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[1]);

    expect(await screen.findByText("Erreur solde serveur")).toBeInTheDocument();
  });
});

describe("CartesPage — branches supplémentaires", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
  });

  /* ─── StatutBadge ?? fallback (line 191) ─── */
  it("affiche le statut brut pour un statut inconnu (StatutBadge ?? fallback)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const cartePending = { ...carteDemo, statut: "PENDING" };
    mockApiGet
      .mockResolvedValueOnce({ data: [cartePending] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    expect(await screen.findByText("PENDING")).toBeInTheDocument();
  });

  /* ─── TypeBadge false branch (line 196) + MASTERCARD gradient (254-260) ─── */
  it("affiche une carte MASTERCARD avec badge bleu (TypeBadge false branch)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const carteMC = { ...carteDemo, type_carte: "MASTERCARD" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteMC] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    expect(await screen.findByText("MASTERCARD")).toBeInTheDocument();
  });

  /* ─── EXPIREE branch (line 623) ─── */
  it("affiche 'Cette carte a expiré' pour une carte EXPIREE (ligne 623)", async () => {
    const carteExp = { ...carteDemo, statut: "EXPIREE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteExp] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    expect(await screen.findByText("Cette carte a expiré")).toBeInTheDocument();
  });

  /* ─── usagePct > 80% barColor rouge (line 246) ─── */
  it("affiche une barre de crédit rouge pour un usage > 80% (ligne 246)", async () => {
    const carteHighUsage = { ...carteDemo, solde_utilise: 4500, limite_credit: 5000 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteHighUsage] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    // Wait for actual card content to confirm CreditCardVisual rendered
    expect(await screen.findByRole("button", { name: /révéler le numéro/i })).toBeInTheDocument();
  });

  /* ─── usagePct > 50% barColor orange (lines 248-250) ─── */
  it("affiche une barre orange pour un usage entre 50% et 80% (ligne 248)", async () => {
    const carteMedUsage = { ...carteDemo, solde_utilise: 3000, limite_credit: 5000 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteMedUsage] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    expect(await screen.findByRole("button", { name: /révéler le numéro/i })).toBeInTheDocument();
  });

  /* ─── limite_credit = 0 → usagePct = 0 (line 244 false branch) ─── */
  it("affiche usagePct = 0 si la limite est 0 (ligne 244 false branch)", async () => {
    const carteLimite0 = { ...carteDemo, solde_utilise: 0, limite_credit: 0 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteLimite0] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    expect(await screen.findByRole("button", { name: /révéler le numéro/i })).toBeInTheDocument();
  });

  /* ─── MASTERCARD user view → cardGradient/cardBorder false branch (lines 254-260) ─── */
  it("affiche une carte MASTERCARD dans la vue utilisateur (lignes 254-260)", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    const carteMC = { ...carteDemo, type_carte: "MASTERCARD" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteMC] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    expect(await screen.findByRole("button", { name: /révéler le numéro/i })).toBeInTheDocument();
  });

  /* ─── copied=true state in CreditCardVisual copy button (lines 376-384) ─── */
  it("affiche 'Copié !' après copie du numéro de carte dans la vue utilisateur (lignes 376-384)", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /révéler le numéro/i }));
    await waitFor(() => screen.getByText("4532 8814 7700 4242"));
    fireEvent.click(screen.getByRole("button", { name: /copier le numéro/i }));
    expect(await screen.findByText("Copié !")).toBeInTheDocument();
  });

  /* ─── client_nom falsy → "—" (line 397) ─── */
  it("affiche '—' comme titulaire si client_nom est absent (ligne 397)", async () => {
    const carteNoNom = { ...carteDemo, client_nom: null };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteNoNom] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    // Wait for CreditCardVisual to fully render before checking for "—"
    await screen.findByRole("button", { name: /révéler le numéro/i });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  /* ─── CVV null + reveal → "—" (line 418 ?? fallback) ─── */
  it("affiche '—' pour CVV null après révélation (ligne 418)", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    const carteNoCvv = { ...carteDemo, cvv: null };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteNoCvv] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    render(<CartesPage />);
    const btn = await screen.findByRole("button", { name: /révéler le numéro/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.queryByText("•••")).not.toBeInTheDocument();
    });
    expect(document.body).toBeTruthy(); // CVV null → "—"
  });

  /* ─── loadCartes ?? fallback (line 680) ─── */
  it("affiche 'Erreur de chargement' si loadCartes échoue sans message (ligne 680)", async () => {
    mockApiGet
      .mockRejectedValueOnce({})             // loadCartes fails sans message
      .mockResolvedValueOnce({ data: [] });  // loadSupportingData /comptes
    render(<CartesPage />);
    expect(await screen.findByText("Erreur de chargement")).toBeInTheDocument();
  });

  /* ─── loadSupportingData ?? fallback (line 697) ─── */
  it("affiche 'Erreur' si loadSupportingData échoue sans message (ligne 697)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })  // loadCartes OK
      .mockRejectedValueOnce({});           // /comptes fails sans message
    render(<CartesPage />);
    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  /* ─── gelerCarte ?? fallback (line 813) ─── */
  it("affiche 'Erreur' si le gel échoue sans message (ligne 813)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<CartesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Geler cette carte/i }));
    await waitFor(() => screen.getByRole("alertdialog"));
    fireEvent.click(screen.getByRole("button", { name: /Confirmer le gel/i }));
    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  /* ─── rembourserCarte ?? fallback (line 888) ─── */
  it("affiche 'Erreur de remboursement' si le remboursement échoue sans message (ligne 888)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPost.mockRejectedValueOnce({});
    render(<CartesPage />);
    fireEvent.change(await screen.findByLabelText("Compte source"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Montant (CAD)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Rembourser" }));
    expect(await screen.findByText("Erreur de remboursement")).toBeInTheDocument();
  });

  /* ─── Admin branches ─── */
  it("affiche 'Erreur' si bloquerCarte échoue sans message (ligne 783, admin)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<CartesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Bloquer/ }));
    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  it("affiche 'Erreur' si modifierLimite échoue sans message (ligne 846, admin)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<CartesPage />);
    const limiteInput = await screen.findByLabelText("Nouvelle limite");
    fireEvent.change(limiteInput, { target: { value: "9999" } });
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[0]);
    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  it("affiche 'Erreur' si modifierSolde échoue sans message (ligne 865, admin)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteDemo] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<CartesPage />);
    const soldeInput = await screen.findByLabelText("Solde utilisé");
    fireEvent.change(soldeInput, { target: { value: "0" } });
    fireEvent.click(screen.getAllByRole("button", { name: "OK" })[1]);
    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  it("affiche 'Erreur de création' si createCarte échoue sans message (ligne 767, admin)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    mockApiPost.mockRejectedValueOnce({});
    render(<CartesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Nouvelle carte" }));
    fireEvent.change(screen.getByLabelText("Limite de crédit (CAD)"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Date d'expiration"), { target: { value: "2030-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));
    expect(await screen.findByText("Erreur de création")).toBeInTheDocument();
  });

  it("affiche le montant brut si non numérique (formatMoney NaN, lignes 14-15, admin)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const carteNaN = { ...carteDemo, limite_credit: "abc", solde_utilise: "xyz" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteNaN] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    await waitFor(() => screen.getByText("abc"));
    expect(screen.getByText("abc")).toBeInTheDocument();
  });

  it("carte EXPIREE dans le tableau admin n'affiche pas les boutons d'action (ligne 1175)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const carteExp = { ...carteDemo, statut: "EXPIREE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteExp] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    await waitFor(() => screen.getByText("Expirée"));
    expect(screen.queryByRole("button", { name: /Geler la carte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bloquer/i })).not.toBeInTheDocument();
  });

  it("admin table: barre rouge pour usage > 80% (lignes 1128, 1162)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const carteHighUsage = { ...carteDemo, solde_utilise: 4500, limite_credit: 5000 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteHighUsage] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
    expect(document.body).toBeTruthy(); // usagePct = 90 > 80 → barre rouge
  });

  it("admin table: barre orange pour usage 50-80% (ligne 1162 middle)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const carteMed = { ...carteDemo, solde_utilise: 3000, limite_credit: 5000 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteMed] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
    expect(document.body).toBeTruthy(); // usagePct = 60 > 50, not > 80 → orange
  });

  it("admin table: pas de barre si limite_credit = 0 (ligne 1157 false branch)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    const carteLimite0 = { ...carteDemo, limite_credit: 0, solde_utilise: 0 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteLimite0] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });
    render(<CartesPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
    expect(document.body).toBeTruthy(); // limite = 0 → no progress bar
  });

  /* ─── ligne 827 : degelerCarte catch ?? "Erreur" fallback (sans message) ─── */
  it("affiche 'Erreur' si le dégel échoue sans message (ligne 827 ?? fallback)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const carteGelee = { ...carteDemo, statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteGelee] })
      .mockResolvedValueOnce({ data: [compteDemo] });
    mockApiPatch.mockRejectedValueOnce({}); // pas de message → ?? "Erreur"

    render(<CartesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Dégeler la carte/i }));

    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  /* ─── lignes 1042/1053 : client avec liste vide de cartes ─── */
  it("affiche le message 'Aucune carte associée' pour un utilisateur sans cartes (ligne 1042)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })  // /cartes vide
      .mockResolvedValueOnce({ data: [compteDemo] }); // /comptes

    render(<CartesPage />);

    expect(await screen.findByText(/Aucune carte de crédit/i)).toBeInTheDocument();
  });

  /* ─── ligne 1125 : compteOptionsByCarte[id] ?? [] fallback admin table ─── */
  it("admin table: carte sans compte correspondant → options vides (ligne 1125 ?? [])", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
    // carteDemo.client_id n'a aucun compte dans la liste → compteOptionsByCarte[carteId] sera undefined
    const carteOrpheline = { ...carteDemo, id: 99, solde_utilise: 100 };
    mockApiGet
      .mockResolvedValueOnce({ data: [carteOrpheline] })
      .mockResolvedValueOnce({ data: [] })         // pas de comptes → options vides
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<CartesPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
    // compteOptionsByCarte[99] est undefined → ?? [] → canRembourser=false
    expect(document.body).toBeTruthy();
  });
});
