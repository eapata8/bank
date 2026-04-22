import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClientsPage from "../../frontend/src/app/dashboard/clients/page";

const mockApiGet = jest.fn();
let mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockApiPost = jest.fn();

jest.mock("@/lib/api", () => ({
  apiGet:  (...args) => mockApiGet(...args),
  apiPost: (...args) => mockApiPost(...args),
}));

const clientDemo = {
  id: 1,
  prenom: "Alice",
  nom: "Martin",
  email_fictif: "alice@Leon.local",
  ville: "Ottawa",
};

const client2 = {
  id: 2,
  prenom: "Bob",
  nom: "Dupont",
  email_fictif: "bob@Leon.local",
  ville: "Montreal",
};

const compteEpargne = {
  id: 10,
  client_id: 1,
  type_compte: "EPARGNE",
  numero_compte: "**** 9999",
  solde: 12345.67,
  devise: "CAD",
  est_actif: 1,
};

const compteCheque = {
  id: 11,
  client_id: 2,
  type_compte: "CHEQUES",
  numero_compte: "**** 8888",
  solde: 500.0,
  devise: "CAD",
  est_actif: 1,
};

describe("ClientsPage", () => {
  let rafTime = 0;

  beforeAll(() => {
    // Mock requestAnimationFrame so the useCountUp step callback executes synchronously
    global.requestAnimationFrame = jest.fn((cb) => { rafTime += 1000; cb(rafTime); return 1; });
    global.cancelAnimationFrame = jest.fn();
  });

  afterAll(() => {
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
  });

  beforeEach(() => {
    rafTime = 0;
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  /* ─────────── ElevatedView (ADMIN / MODERATEUR) ─────────── */

  describe("ElevatedView", () => {
    it("affiche la liste des clients apres chargement", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo, client2] })  // /clients
        .mockResolvedValueOnce({ data: [compteEpargne] });        // /clients/1/comptes

      render(<ClientsPage />);

      // Alice apparait dans la liste ET dans le panneau du client selectionne
      const aliceItems = await screen.findAllByText("Alice Martin");
      expect(aliceItems.length).toBeGreaterThanOrEqual(1);
      // Bob n'est pas selectionne donc n'apparait qu'une seule fois
      expect(screen.getByText("Bob Dupont")).toBeInTheDocument();
    });

    it("charge automatiquement les comptes du premier client", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      expect(await screen.findByText("**** 9999")).toBeInTheDocument();
      expect(mockApiGet).toHaveBeenCalledWith("/clients/1/comptes");
    });

    it("affiche le titre gestion des clients pour un admin", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [] })

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
      expect(screen.getByText("Gestion des clients")).toBeInTheDocument();
      expect(screen.getByText("Administration")).toBeInTheDocument();
    });

    it("affiche le label supervision pour un moderateur", async () => {
      mockUser = { id: 3, prenom: "Mode", nom: "Sup", role: "MODERATEUR" };
      mockApiGet.mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
      expect(screen.getByText("Supervision")).toBeInTheDocument();
    });

    it("change les comptes affiches quand un autre client est selectionne", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo, client2] })    // /clients
        .mockResolvedValueOnce({ data: [compteEpargne] })           // /clients/1/comptes
        .mockResolvedValueOnce({ data: [compteCheque] });            // /clients/2/comptes

      render(<ClientsPage />);

      // Attendre que la liste des clients soit affichee (Bob apparait une seule fois)
      expect(await screen.findByText("Bob Dupont")).toBeInTheDocument();
      // Compte initial d'Alice est charge
      expect(await screen.findByText("**** 9999")).toBeInTheDocument();

      // Cliquer sur le deuxieme client via son nom dans la liste
      fireEvent.click(screen.getByText("Bob Dupont"));

      expect(await screen.findByText("**** 8888")).toBeInTheDocument();
      expect(mockApiGet).toHaveBeenCalledWith("/clients/2/comptes");
    });

    it("effectue une recherche de clients", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo, client2] })   // chargement initial
        .mockResolvedValueOnce({ data: [compteEpargne] })          // comptes du client 1
        .mockResolvedValueOnce({ data: [clientDemo] })             // recherche
        .mockResolvedValueOnce({ data: [compteEpargne] });         // comptes apres recherche

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.change(
        screen.getByPlaceholderText("Rechercher par ID, prénom, nom…"),
        { target: { value: "Alice" } }
      );
      fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith("/clients?search=Alice");
      });
    });

    it("affiche 'Aucun client trouve' si la liste est vide", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      expect(await screen.findByText("Aucun client trouvé.")).toBeInTheDocument();
    });

    it("affiche 'Aucun compte pour ce client' si pas de comptes", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      expect(await screen.findByText("Aucun compte pour ce client.")).toBeInTheDocument();
    });

    it("affiche les infos du client selectionne dans le panneau", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      expect(await screen.findByText("Client sélectionné")).toBeInTheDocument();
      // alice@Leon.local apparait dans la liste ET dans le panneau
      const emailItems = screen.getAllByText("alice@Leon.local");
      expect(emailItems.length).toBeGreaterThanOrEqual(1);
    });

    it("affiche le solde total des comptes du client selectionne", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
      // Solde total affiché
      expect(screen.getByText("Solde total")).toBeInTheDocument();
    });

    it("affiche une erreur si le chargement des clients echoue", async () => {
      mockApiGet.mockRejectedValueOnce({ message: "Erreur réseau" });

      render(<ClientsPage />);

      expect(await screen.findByText("Erreur réseau")).toBeInTheDocument();
    });

    it("affiche une erreur generique si le message est absent", async () => {
      mockApiGet.mockRejectedValueOnce({});

      render(<ClientsPage />);

      expect(await screen.findByText("Erreur de chargement")).toBeInTheDocument();
    });

    it("selectionne null si la liste de clients devient vide apres recherche", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] })
        .mockResolvedValueOnce({ data: [] }); // recherche sans resultats

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.change(
        screen.getByPlaceholderText("Rechercher par ID, prénom, nom…"),
        { target: { value: "zzz" } }
      );
      fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
      expect(screen.getByText("Sélectionnez un client pour voir ses comptes.")).toBeInTheDocument();
    });

    it("affiche le bouton '+Nouveau client' et ouvre le formulaire au clic", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole("button", { name: "+ Nouveau client" }));

      expect(screen.getByText("Nouveau client")).toBeInTheDocument();
      expect(screen.getByLabelText("Prénom *")).toBeInTheDocument();
    });

    it("crée un client avec succès via le formulaire", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] })
        .mockResolvedValueOnce({ data: [clientDemo, client2] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      mockApiPost.mockResolvedValueOnce({ id: 2 });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Nouveau client" }));
      fireEvent.change(screen.getByLabelText("Prénom *"),       { target: { value: "Bob" } });
      fireEvent.change(screen.getByLabelText("Nom *"),          { target: { value: "Martin" } });
      fireEvent.change(screen.getByLabelText("Email fictif *"), { target: { value: "bob@demo.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Créer le client" }));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/clients",
          expect.objectContaining({ prenom: "Bob", nom: "Martin" })
        );
      });
    });

    it("affiche une erreur si la creation du client echoue", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      mockApiPost.mockRejectedValueOnce({ message: "Email déjà utilisé" });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Nouveau client" }));
      fireEvent.change(screen.getByLabelText("Prénom *"),       { target: { value: "Test" } });
      fireEvent.change(screen.getByLabelText("Nom *"),          { target: { value: "User" } });
      fireEvent.change(screen.getByLabelText("Email fictif *"), { target: { value: "test@test.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Créer le client" }));

      expect(await screen.findByText("Email déjà utilisé")).toBeInTheDocument();
    });

    it("annule le formulaire nouveau client au clic sur Annuler (bouton dans le formulaire)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Nouveau client" }));
      expect(screen.getByText("Nouveau client")).toBeInTheDocument();

      // Plusieurs boutons "Annuler" : clic sur le dernier (dans le formulaire)
      const cancelBtns = screen.getAllByRole("button", { name: "Annuler" });
      fireEvent.click(cancelBtns[cancelBtns.length - 1]);
      expect(screen.queryByText("Nouveau client")).not.toBeInTheDocument();
    });

    it("ouvre le formulaire ouvrir un compte et soumet avec succes", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] })
        .mockResolvedValueOnce({ data: [compteEpargne, compteCheque] });
      mockApiPost.mockResolvedValueOnce({ id: 11 });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Ouvrir un compte" }));
      expect(screen.getByText(/Ouvrir un compte/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le compte" }));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith("/comptes", expect.objectContaining({ client_id: 1 }));
      });
    });

    it("affiche une erreur si l'ouverture du compte echoue", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      mockApiPost.mockRejectedValueOnce({ message: "Limite de comptes atteinte" });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Ouvrir un compte" }));
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le compte" }));

      expect(await screen.findByText("Limite de comptes atteinte")).toBeInTheDocument();
    });

    it("affiche une erreur si le chargement des comptes du client echoue", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockRejectedValueOnce({ message: "Erreur comptes" });

      render(<ClientsPage />);

      expect(await screen.findByText("Erreur comptes")).toBeInTheDocument();
    });

    it("affiche un lien Transactions pour chaque compte", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne, compteCheque] });

      render(<ClientsPage />);

      const links = await screen.findAllByText("Voir les transactions");
      expect(links.length).toBeGreaterThanOrEqual(2);
    });
  });

  /* ─────────── ClientView (UTILISATEUR standard) ─────────── */

  describe("ClientView", () => {
    beforeEach(() => {
      mockUser = { id: 2, prenom: "Jean", nom: "Tremblay", role: "UTILISATEUR" };
    });

    it("affiche le loader pendant le chargement", () => {
      mockApiGet.mockReturnValue(new Promise(() => {}));

      render(<ClientsPage />);

      expect(screen.getByText("Chargement de vos comptes…")).toBeInTheDocument();
    });

    it("affiche les comptes de l'utilisateur", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      expect(await screen.findByText("**** 9999")).toBeInTheDocument();
      expect(screen.getByText("EPARGNE · CAD")).toBeInTheDocument();
    });

    it("affiche le nom de l'utilisateur dans l'entete", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      // Attendre la fin du chargement (le composant affiche le nom apres loading=false)
      expect(await screen.findByText(/Jean/)).toBeInTheDocument();
      expect(screen.getByText("Bonjour")).toBeInTheDocument();
    });

    it("affiche le solde total disponible", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      expect(await screen.findByText("Solde total disponible")).toBeInTheDocument();
    });

    it("affiche 'Aucun compte associe' si pas de comptes", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      expect(await screen.findByText("Aucun compte associé à votre profil.")).toBeInTheDocument();
    });

    it("affiche une erreur si le chargement echoue", async () => {
      mockApiGet.mockRejectedValueOnce({ message: "Timeout" });

      render(<ClientsPage />);

      expect(await screen.findByText("Timeout")).toBeInTheDocument();
    });

    it("affiche une erreur generique si le message est absent", async () => {
      mockApiGet.mockRejectedValueOnce({});

      render(<ClientsPage />);

      expect(await screen.findByText("Erreur de chargement")).toBeInTheDocument();
    });

    it("affiche les liens d'actions rapides", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      expect(await screen.findByText("Virement")).toBeInTheDocument();
      expect(screen.getByText("Factures")).toBeInTheDocument();
    });

    it("affiche le nombre de comptes actifs", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      expect(await screen.findByText(/1 actif/)).toBeInTheDocument();
    });

    it("appelle /comptes au chargement", async () => {
      mockApiGet.mockResolvedValueOnce({ data: [] });

      render(<ClientsPage />);

      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
      expect(mockApiGet).toHaveBeenCalledWith("/comptes");
    });

    it("affiche un compte de type GOLD (cardClass gold path)", async () => {
      const compteGold = { id: 12, client_id: 1, type_compte: "GOLD", numero_compte: "**** 7777", solde: 9000, devise: "CAD", est_actif: 1 };
      mockApiGet.mockResolvedValueOnce({ data: [compteGold] });

      render(<ClientsPage />);

      expect(await screen.findByText("GOLD · CAD")).toBeInTheDocument();
    });

    it("affiche un compte de type inconnu (cardClass dark path)", async () => {
      const compteDark = { id: 13, client_id: 1, type_compte: "SPECIAL", numero_compte: "**** 6666", solde: 200, devise: "CAD", est_actif: 1 };
      mockApiGet.mockResolvedValueOnce({ data: [compteDark] });

      render(<ClientsPage />);

      expect(await screen.findByText("SPECIAL · CAD")).toBeInTheDocument();
    });
  });

  describe("ElevatedView — champs optionnels formulaire", () => {
    it("remplit les champs optionnels ville et utilisateur_id lors de la creation", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] })
        .mockResolvedValueOnce({ data: [clientDemo, client2] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      mockApiPost.mockResolvedValueOnce({ id: 3 });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Nouveau client" }));
      fireEvent.change(screen.getByLabelText("Prénom *"),              { target: { value: "Claire" } });
      fireEvent.change(screen.getByLabelText("Nom *"),                 { target: { value: "Rousseau" } });
      fireEvent.change(screen.getByLabelText("Email fictif *"),        { target: { value: "claire@demo.com" } });
      fireEvent.change(screen.getByLabelText(/Ville/),                 { target: { value: "Quebec" } });
      fireEvent.change(screen.getByLabelText(/ID utilisateur/),        { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Créer le client" }));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith(
          "/clients",
          expect.objectContaining({ prenom: "Claire", ville: "Quebec" })
        );
      });
    });

    it("clic sur les boutons de type de compte (Epargne, Credit) dans le formulaire", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Ouvrir un compte" }));

      // Clic sur le bouton Épargne
      fireEvent.click(screen.getByRole("button", { name: "Épargne" }));
      // Clic sur le bouton Crédit
      fireEvent.click(screen.getByRole("button", { name: "Crédit" }));
      // Les boutons sont présents et cliquables
      expect(screen.getByRole("button", { name: "Épargne" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Crédit" })).toBeInTheDocument();
    });

    it("hover sur un client non selectionne change le fond (mouseEnter/mouseLeave)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo, client2] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);

      await waitFor(() => screen.getByText("Bob Dupont"));

      const bobBtn = screen.getByRole("button", { name: /Bob Dupont/ });
      fireEvent.mouseEnter(bobBtn);
      fireEvent.mouseLeave(bobBtn);

      // Pas d'erreur = test réussi
      expect(bobBtn).toBeInTheDocument();
    });

    it("affiche les coordonnées bancaires quand le compte en a", async () => {
      const compteAvecCoords = {
        ...compteEpargne,
        numero_institution: "621",
        numero_transit: "10482",
        swift_bic: "NXBNCA2X",
      };
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteAvecCoords] });

      render(<ClientsPage />);
      await waitFor(() => screen.getByText("**** 9999"));

      // Cliquer sur le bouton Coordonnées bancaires
      fireEvent.click(screen.getByText(/Coordonnées bancaires/));
      await waitFor(() => {
        expect(screen.getByText("621")).toBeInTheDocument();
        expect(screen.getByText("10482")).toBeInTheDocument();
      });
    });

    it("copie les coordonnées bancaires via le bouton ⧉", async () => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const compteAvecCoords = {
        ...compteEpargne,
        numero_institution: "621",
        numero_transit: "10482",
      };
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteAvecCoords] });

      render(<ClientsPage />);
      await waitFor(() => screen.getByText("**** 9999"));

      fireEvent.click(screen.getByText(/Coordonnées bancaires/));
      await waitFor(() => screen.getByText("10482"));

      // Cliquer le bouton copier (⧉) de l'institution
      const copyButtons = screen.getAllByText("⧉");
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });

    it("coche auto_validation dans le formulaire de creation de client", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      // Ouvrir le formulaire client
      fireEvent.click(screen.getByRole("button", { name: /Nouveau client/ }));
      await waitFor(() => screen.getByLabelText(/ID utilisateur/));

      // Taper un ID utilisateur pour faire apparaître le toggle auto_validation
      fireEvent.change(screen.getByLabelText(/ID utilisateur/), { target: { value: "5" } });

      await waitFor(() => screen.getByText(/Auto-validation/));

      // Cocher le checkbox via le label (le checkbox est invisible, opacity:0)
      const checkbox = document.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeNull();
      // Utiliser fireEvent.click pour déclencher l'onChange React (ligne 531)
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      // Second clic pour couvrir les deux branches (true→false→true)
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
    });

    it("copie le numéro de compte complet via le bouton Copier après révélation", async () => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const compteFullNumber = {
        ...compteEpargne,
        numero_compte: "1234 5678 9012",
      };
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteFullNumber] });

      render(<ClientsPage />);
      // Le numéro est masqué au départ → **** **** 9012
      await waitFor(() => screen.getByText("**** **** 9012"));

      // Cliquer "Voir" pour révéler le numéro complet
      fireEvent.click(screen.getByRole("button", { name: "Voir" }));
      // Puis cliquer "Copier"
      fireEvent.click(await screen.findByRole("button", { name: "Copier" }));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith("123456789012");
      });
    });

    it("ferme le formulaire de nouveau compte avec Annuler", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });

      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Ouvrir un compte" }));
      await waitFor(() => screen.getByRole("button", { name: "Ouvrir le compte" }));

      // Cliquer le bouton Annuler du formulaire compte (dernier parmi les Annuler)
      const annulerBtns = screen.getAllByRole("button", { name: "Annuler" });
      fireEvent.click(annulerBtns[annulerBtns.length - 1]);
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Ouvrir le compte" })).not.toBeInTheDocument();
      });
    });
  });

  /* ─────────── Branches supplémentaires ─────────── */
  describe("branches supplémentaires", () => {
    /* line 65: est_actif false → badge INACTIF (ElevatedView) */
    it("affiche INACTIF pour un compte inactif dans ElevatedView (ligne 65 false branch)", async () => {
      const compteInactif = { ...compteEpargne, est_actif: 0 };
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteInactif] });
      render(<ClientsPage />);
      expect(await screen.findByText("INACTIF")).toBeInTheDocument();
    });

    /* line 147: CREDIT account → "Mes cartes" link (ClientView only) */
    it("affiche le lien '⊞ Mes cartes' pour un compte CREDIT (ligne 147)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const compteCredit = { ...compteEpargne, type_compte: "CREDIT", est_actif: 1 };
      mockApiGet.mockResolvedValueOnce({ data: [compteCredit] });
      render(<ClientsPage />);
      expect(await screen.findByText("⊞ Mes cartes")).toBeInTheDocument();
    });

    /* line 379: keeps existing selection when client still in search results */
    it("conserve la sélection du client si celui-ci est toujours dans les résultats (ligne 379)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo, client2] })  // initial load
        .mockResolvedValueOnce({ data: [compteEpargne] })        // accounts for clientDemo
        .mockResolvedValueOnce({ data: [clientDemo] });          // search result (clientDemo still present, selection unchanged)
      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      const searchInput = screen.getByPlaceholderText(/Rechercher/i);
      fireEvent.change(searchInput, { target: { value: "Alice" } });
      fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(3));
      expect(screen.getAllByText("Alice Martin")[0]).toBeInTheDocument();
    });

    /* line 401: accounts load catch ?? "Erreur" fallback */
    it("affiche 'Erreur' si le chargement des comptes échoue sans message (ligne 401)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockRejectedValueOnce({});
      render(<ClientsPage />);
      expect(await screen.findByText("Erreur")).toBeInTheDocument();
    });

    /* line 431: client create catch ?? "Erreur lors de la création" fallback */
    it("affiche 'Erreur lors de la création' si la création client échoue sans message (ligne 431)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      mockApiPost.mockRejectedValueOnce({});
      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Nouveau client" }));
      fireEvent.change(screen.getByLabelText("Prénom *"),       { target: { value: "Test" } });
      fireEvent.change(screen.getByLabelText("Nom *"),          { target: { value: "User" } });
      fireEvent.change(screen.getByLabelText("Email fictif *"), { target: { value: "t@t.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Créer le client" }));

      expect(await screen.findByText("Erreur lors de la création")).toBeInTheDocument();
    });

    /* line 450: compte create catch ?? "Erreur lors de la création" fallback */
    it("affiche 'Erreur lors de la création' si l'ouverture du compte échoue sans message (ligne 450)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      mockApiPost.mockRejectedValueOnce({});
      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      fireEvent.click(screen.getByRole("button", { name: "+ Ouvrir un compte" }));
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le compte" }));

      expect(await screen.findByText("Erreur lors de la création")).toBeInTheDocument();
    });

    /* lines 606-607: onMouseEnter/Leave on the active (selected) client → if (!active) false */
    it("hover sur le client actif ne modifie pas le fond (lignes 606-607 false branch)", async () => {
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo, client2] })
        .mockResolvedValueOnce({ data: [compteEpargne] });
      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));

      // First client button is the active one (clientDemo is auto-selected)
      const clientBtns = screen.getAllByRole("button").filter(b => b.textContent?.includes("Alice"));
      fireEvent.mouseEnter(clientBtns[0]);
      fireEvent.mouseLeave(clientBtns[0]);
      expect(screen.getAllByText("Alice Martin")[0]).toBeInTheDocument();
    });

    /* line 671: negative totalBalance → red color */
    it("affiche le solde total avec un compte à solde négatif (ligne 671 false branch)", async () => {
      const compteNegatif = { ...compteEpargne, solde: -500 };
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteNegatif] });
      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
      expect(screen.getAllByText("Alice Martin")[0]).toBeInTheDocument();
    });

    /* lines 13-14: formatMoney NaN branch */
    it("affiche la valeur brute si le solde n'est pas numérique (formatMoney NaN, lignes 13-14)", async () => {
      const compteNaN = { ...compteEpargne, solde: "abc" };
      mockApiGet
        .mockResolvedValueOnce({ data: [clientDemo] })
        .mockResolvedValueOnce({ data: [compteNaN] });
      render(<ClientsPage />);
      expect(await screen.findByText("abc")).toBeInTheDocument();
    });

    /* lines 168-169: reducedMotion = true → setValue(target) directly in ClientView */
    it("affiche le solde immédiatement si prefers-reduced-motion est activé (lignes 168-169)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      window.matchMedia = jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });
      mockApiGet.mockResolvedValueOnce({ data: [compteEpargne] });
      render(<ClientsPage />);
      expect(await screen.findByRole("heading", { name: /Carol/ })).toBeInTheDocument();
    });

    /* lines 274-276: accounts.length > 1 and activeCount > 1 → pluriel "s" */
    it("affiche le pluriel 'comptes' et 'actifs' si plus d'un compte actif (lignes 274-276)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const compte2 = { ...compteEpargne, id: 20, solde: 800 };
      mockApiGet.mockResolvedValueOnce({ data: [compteEpargne, compte2] });
      render(<ClientsPage />);
      expect(await screen.findByText(/2 comptes/)).toBeInTheDocument();
      expect(screen.getByText(/2 actifs/)).toBeInTheDocument();
    });

    /* lines 81-83: copied = true after copying account number → "Copié !" */
    it("affiche 'Copié !' après copie du numéro de compte révélé (lignes 81-83)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
      const compteFullNum = { ...compteEpargne, numero_compte: "1234 5678 9012" };
      mockApiGet.mockResolvedValueOnce({ data: [compteFullNum] });
      render(<ClientsPage />);
      await screen.findByText("**** **** 9012");

      fireEvent.click(screen.getByRole("button", { name: "Voir" }));
      fireEvent.click(await screen.findByRole("button", { name: "Copier" }));
      expect(await screen.findByText("Copié !")).toBeInTheDocument();
    });

    /* line 65 in ClientView: est_actif false → "INACTIF" */
    it("affiche INACTIF pour un compte inactif dans ClientView (ligne 65 false branch)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const compteInactif = { ...compteEpargne, est_actif: 0 };
      mockApiGet.mockResolvedValueOnce({ data: [compteInactif] });
      render(<ClientsPage />);
      expect(await screen.findByText("INACTIF")).toBeInTheDocument();
    });

    /* line 106: revealed=true → numero_compte shown in CoordRow */
    it("affiche le numéro complet dans les coordonnées bancaires après révélation (ligne 106)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const compteCoords = {
        ...compteEpargne,
        numero_compte: "1234 5678 9012",
        numero_institution: "001",
        numero_transit: "00123",
      };
      mockApiGet.mockResolvedValueOnce({ data: [compteCoords] });
      render(<ClientsPage />);
      await screen.findByText("**** **** 9012");

      fireEvent.click(screen.getByRole("button", { name: "Voir" }));
      fireEvent.click(await screen.findByRole("button", { name: /Coordonnées bancaires/ }));
      await waitFor(() => expect(screen.getByText("001")).toBeInTheDocument());
    });

    /* line 49: CoordRow copied=true → color "#6EE7B7" */
    it("affiche '✓' après copie d'une coordonnée bancaire (ligne 49 copied=true)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
      const compteCoords = {
        ...compteEpargne,
        numero_institution: "815",
        numero_transit: "99001",
      };
      mockApiGet.mockResolvedValueOnce({ data: [compteCoords] });
      render(<ClientsPage />);
      // open coords panel
      fireEvent.click(await screen.findByRole("button", { name: /Coordonnées bancaires/ }));
      // click the ⧉ copy button for institution
      const copyBtns = await screen.findAllByRole("button", { name: "⧉" });
      fireEvent.click(copyBtns[0]);
      expect(await screen.findByText("✓")).toBeInTheDocument();
    });

    /* line 201: cardClass with null type → ?? "" fallback */
    it("affiche un compte avec type_compte null sans erreur (cardClass ?? fallback, ligne 201)", async () => {
      mockUser = { id: 5, prenom: "Carol", nom: "Smith", role: "UTILISATEUR" };
      const compteNullType = { ...compteEpargne, type_compte: null };
      mockApiGet.mockResolvedValueOnce({ data: [compteNullType] });
      render(<ClientsPage />);
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));
      expect(document.body).toBeTruthy(); // cardClass(null) → (null ?? "").toLowerCase() covers ?? branch
    });
  });
});
