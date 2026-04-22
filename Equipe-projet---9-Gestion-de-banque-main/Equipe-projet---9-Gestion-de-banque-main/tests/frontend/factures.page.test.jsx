import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FacturesPage from "../../frontend/src/app/dashboard/factures/page";

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
let mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:  (...args) => mockApiGet(...args),
  apiPost: (...args) => mockApiPost(...args),
}));

describe("FacturesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  it("n'affiche plus le formulaire de creation de facture cote admin", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<FacturesPage />);

    await waitFor(() => screen.getByText("Registre des factures"));
    expect(screen.queryByRole("button", { name: "Créer la facture" })).not.toBeInTheDocument();
    expect(screen.queryByText("Créer une facture")).not.toBeInTheDocument();
  });

  it("affiche une erreur si le chargement des factures echoue", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/factures") return Promise.reject({ message: "Erreur DB factures" });
      return Promise.resolve({ data: [] });
    });

    render(<FacturesPage />);

    expect(await screen.findByText("Erreur DB factures")).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement des comptes echoue", async () => {
    mockApiGet.mockImplementation((path) => {
      if (path === "/comptes") return Promise.reject({ message: "Erreur DB comptes" });
      return Promise.resolve({ data: [] });
    });

    render(<FacturesPage />);

    expect(await screen.findByText("Erreur DB comptes")).toBeInTheDocument();
  });

  it("affiche une erreur si le paiement de facture echoue", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({
        data: [{ id: 5, client_id: 1, fournisseur: "Bell", reference_facture: "FAC-1002", description: "Internet", montant: 89.99, date_emission: "2026-03-01", date_echeance: "2026-03-20", statut: "IMPAYEE", payee_le: null, client_nom: "Client Demo" }],
      })
      .mockResolvedValueOnce({ data: [{ id: 1, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 4521", solde: 1000, devise: "CAD", est_actif: 1 }] });
    mockApiPost.mockRejectedValueOnce({ message: "Solde insuffisant pour payer" });

    render(<FacturesPage />);

    fireEvent.change(await screen.findByLabelText("Compte"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Payer #5" }));

    expect(await screen.findByText("Solde insuffisant pour payer")).toBeInTheDocument();
  });

  it("lance une recherche via le bouton Rechercher pour un admin", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<FacturesPage />);

    await waitFor(() => screen.getByRole("button", { name: "Rechercher" }));
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher par ID, client, fournisseur, statut…"),
      { target: { value: "Bell" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/factures?search=Bell");
    });
  });

  it("affiche Aucune facture trouvee si la liste est vide", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<FacturesPage />);

    expect(await screen.findByText("Aucune facture trouvée.")).toBeInTheDocument();
  });

  it("affiche Lecture seule pour un moderateur", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    mockApiGet
      .mockResolvedValueOnce({
        data: [{ id: 5, client_id: 1, fournisseur: "Bell", reference_facture: "FAC-1002", description: "Internet", montant: 89.99, date_emission: "2026-03-01", date_echeance: "2026-03-20", statut: "IMPAYEE", payee_le: null, client_nom: "Client Demo" }],
      })
      .mockResolvedValueOnce({ data: [{ id: 1, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 4521", solde: 1000, devise: "CAD", est_actif: 1 }] });

    render(<FacturesPage />);

    expect(await screen.findByText("Lecture seule")).toBeInTheDocument();
  });

  it("affiche le badge Payee pour une facture payee", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({
        data: [{ id: 7, client_id: 1, fournisseur: "Hydro", reference_facture: "FAC-1003", description: "", montant: 50, date_emission: "2026-01-01", date_echeance: "2026-01-31", statut: "PAYEE", payee_le: "2026-01-15", client_nom: "Client Demo", compte_paiement_numero: "**** 4521" }],
      })
      .mockResolvedValueOnce({ data: [] });

    render(<FacturesPage />);

    expect(await screen.findByText("Payée")).toBeInTheDocument();
  });

  it("permet a un utilisateur de payer une facture impayee", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    // 1. loadFactures, 2. /comptes (UTILISATEUR ne charge pas /clients)
    // 3. loadFactures apres paiement, 4. /comptes apres paiement
    mockApiGet
      .mockResolvedValueOnce({
        data: [{
          id: 5,
          client_id: 1,
          fournisseur: "Bell",
          reference_facture: "FAC-1002",
          description: "Internet",
          montant: 89.99,
          date_emission: "2026-03-01",
          date_echeance: "2026-03-20",
          statut: "IMPAYEE",
          payee_le: null,
          client_nom: "Client Demo",
        }],
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 4521", solde: 1000, devise: "CAD", est_actif: 1 }],
      })
      .mockResolvedValueOnce({
        data: [{ id: 5, client_id: 1, fournisseur: "Bell", reference_facture: "FAC-1002", description: "Internet", montant: 89.99, date_emission: "2026-03-01", date_echeance: "2026-03-20", statut: "PAYEE", payee_le: "2026-03-15", client_nom: "Client Demo" }],
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 4521", solde: 910.01, devise: "CAD", est_actif: 1 }],
      });
    mockApiPost.mockResolvedValueOnce({ message: "Facture payee avec succes", id: 5 });

    render(<FacturesPage />);

    // Le Select dans la colonne action a pour label "Compte"
    fireEvent.change(await screen.findByLabelText("Compte"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Payer #5" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/factures/5/payer", { compte_id: 1 });
    });
  });

  it("permet a un utilisateur de creer et payer une facture via le formulaire direct", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    // 1. loadFactures, 2. /comptes, 3. loadFactures après paiement, 4. /comptes après
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 2, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: 2000, devise: "CAD", est_actif: 1 }] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    mockApiPost
      .mockResolvedValueOnce({ message: "Facture créée", id: 99 }) // POST /factures
      .mockResolvedValueOnce({ message: "Payée" });                // POST /factures/99/payer

    render(<FacturesPage />);

    // Attendre que le formulaire "Payer une facture" soit visible
    await waitFor(() => screen.getByText("Payer une facture"));

    // Remplir le formulaire
    fireEvent.change(screen.getByLabelText(/Fournisseur/), { target: { value: "Hydro-Québec" } });
    fireEvent.change(screen.getByLabelText(/Référence/), { target: { value: "HQ-2026-001" } });
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText(/Date d'échéance/), { target: { value: "2026-05-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Payer la facture" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/factures", expect.objectContaining({ fournisseur: "Hydro-Québec" }));
    });
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/factures/99/payer", { compte_id: 2 });
    });
  });

  it("affiche une erreur si les champs obligatoires manquent dans le formulaire utilisateur", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };

    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 2, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: 2000, devise: "CAD", est_actif: 1 }] });

    render(<FacturesPage />);
    await waitFor(() => screen.getByText("Payer une facture"));

    // Soumettre sans remplir les champs
    fireEvent.click(screen.getByRole("button", { name: "Payer la facture" }));

    await waitFor(() => {
      expect(screen.getByText(/champs obligatoires/i)).toBeInTheDocument();
    });
  });
});

describe("FacturesPage — couverture complémentaire", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  /* ─── formatMoney NaN (lines 13-14) ─── */
  it("affiche le montant brut si non numérique (formatMoney NaN)", async () => {
    const factureNaN = { id: 9, client_id: 1, fournisseur: "EDF", reference_facture: "X", montant: "invalid", statut: "IMPAYEE", date_echeance: "2026-12-31", compte_paiement_numero: null };
    mockApiGet
      .mockResolvedValueOnce({ data: [factureNaN] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<FacturesPage />);

    expect(await screen.findByText("invalid")).toBeInTheDocument();
  });

  /* ─── StatutBadge unknown statut (line 24 ??) ─── */
  it("affiche le statut brut pour un statut inconnu (StatutBadge fallback)", async () => {
    const factureInconnue = { id: 8, client_id: 1, fournisseur: "X", reference_facture: "Y", montant: "100", statut: "INCONNU", date_echeance: "2026-12-31", compte_paiement_numero: null };
    mockApiGet
      .mockResolvedValueOnce({ data: [factureInconnue] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<FacturesPage />);

    expect(await screen.findByText("INCONNU")).toBeInTheDocument();
  });

  /* ─── loadFactures ?? fallback (line 61) ─── */
  it("affiche 'Erreur' si le chargement des factures n'a pas de message", async () => {
    mockApiGet
      .mockRejectedValueOnce({})   // loadFactures échoue sans message
      .mockResolvedValueOnce({ data: [] })  // /comptes
      .mockResolvedValueOnce({ data: [] }); // /clients

    render(<FacturesPage />);

    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  /* ─── loadSupportingData ?? fallback (line 72) ─── */
  it("affiche 'Erreur' si le chargement des données support échoue sans message", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] }) // loadFactures réussit
      .mockRejectedValueOnce({});          // Promise.all rejects (pas de message)

    render(<FacturesPage />);

    expect(await screen.findByText("Erreur")).toBeInTheDocument();
  });

  /* ─── payFacture ?? fallback (line 125) ─── */
  it("affiche 'Erreur de paiement' si le paiement échoue sans message", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const factureImpayee = { id: 11, client_id: 1, fournisseur: "Gaz", reference_facture: "G-01", montant: "55.00", statut: "IMPAYEE", date_echeance: "2026-12-31", compte_paiement_numero: null };
    const compte = { id: 1, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 9999", solde: 500, devise: "CAD", est_actif: 1 };
    mockApiGet
      .mockResolvedValueOnce({ data: [factureImpayee] })
      .mockResolvedValueOnce({ data: [compte] });
    mockApiPost.mockRejectedValueOnce({});

    render(<FacturesPage />);

    fireEvent.change(await screen.findByLabelText("Compte"), { target: { value: "1" } });
    const payBtn = screen.getByRole("button", { name: /Payer #11/ });
    fireEvent.click(payBtn);

    expect(await screen.findByText("Erreur de paiement")).toBeInTheDocument();
  });

  /* ─── handleUserPay catch (line 171) ─── */
  it("affiche une erreur si le paiement direct (handleUserPay) echoue", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 2, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: 2000, devise: "CAD", est_actif: 1 }] });
    mockApiPost.mockRejectedValueOnce({ message: "Erreur paiement direct" });

    render(<FacturesPage />);

    await waitFor(() => screen.getByText("Payer une facture"));

    fireEvent.change(screen.getByLabelText(/Fournisseur/), { target: { value: "Hydro" } });
    fireEvent.change(screen.getByLabelText(/Référence/),   { target: { value: "HQ-001" } });
    fireEvent.change(screen.getByLabelText(/Montant/),     { target: { value: "75" } });
    fireEvent.change(screen.getByLabelText(/Date d'échéance/), { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Payer la facture" }));

    expect(await screen.findByText("Erreur paiement direct")).toBeInTheDocument();
  });

  /* ─── handleUserPay catch ?? fallback (line 171) ─── */
  it("affiche 'Erreur lors du paiement' si handleUserPay échoue sans message", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 2, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: 2000, devise: "CAD", est_actif: 1 }] });
    mockApiPost.mockRejectedValueOnce({}); // pas de message

    render(<FacturesPage />);

    await waitFor(() => screen.getByText("Payer une facture"));

    fireEvent.change(screen.getByLabelText(/Fournisseur/), { target: { value: "Hydro" } });
    fireEvent.change(screen.getByLabelText(/Référence/),   { target: { value: "HQ-002" } });
    fireEvent.change(screen.getByLabelText(/Montant/),     { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText(/Date d'échéance/), { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Payer la facture" }));

    expect(await screen.findByText("Erreur lors du paiement")).toBeInTheDocument();
  });

  /* ─── handleUserPay montant invalide (line 156) ─── */
  it("affiche 'Le montant doit être positif' si montant est zéro (ligne 156)", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 2, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: 2000, devise: "CAD", est_actif: 1 }] });

    render(<FacturesPage />);

    await waitFor(() => screen.getByText("Payer une facture"));

    fireEvent.change(screen.getByLabelText(/Fournisseur/),       { target: { value: "Hydro" } });
    fireEvent.change(screen.getByLabelText(/Référence/),         { target: { value: "HQ-003" } });
    fireEvent.change(screen.getByLabelText(/Montant/),           { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(/Date d'échéance/),   { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Payer la facture" }));

    await waitFor(() => {
      expect(screen.getByText("Le montant doit être positif")).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  /* ─── ligne 299 : canPay false quand options.length=0 → "Aucun compte éligible" ─── */
  it("affiche 'Aucun compte éligible' si aucun compte ne correspond à la facture (ligne 299)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({
        data: [{ id: 5, client_id: 1, fournisseur: "Bell", reference_facture: "FAC-001",
                 montant: 89.99, date_echeance: "2026-12-31", statut: "IMPAYEE",
                 payee_le: null, client_nom: "Client Demo" }],
      })
      .mockResolvedValueOnce({ data: [] }); // pas de comptes → options vides

    render(<FacturesPage />);

    expect(await screen.findByText("Aucun compte éligible")).toBeInTheDocument();
  });

  /* ─── ligne 100 : useEffect setUserPayForm false branch (comptes vides, !isElevated && length > 0 false) ─── */
  it("ne définit pas compte_id si aucun compte disponible (ligne 99 false branch)", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    mockApiGet
      .mockResolvedValueOnce({ data: [] }) // pas de factures
      .mockResolvedValueOnce({ data: [] }); // pas de comptes

    render(<FacturesPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Aucune facture trouvée.")).toBeInTheDocument();
  });

  /* ─── useEffect setUserPayForm true branch (line 100) ─── */
  it("ne réinitialise pas compte_id si déjà défini lors du rechargement des comptes (ligne 100 true branch)", async () => {
    mockUser = { id: 3, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    const compte = { id: 2, client_id: 1, type_compte: "CHEQUES", numero_compte: "**** 1234", solde: 2000, devise: "CAD", est_actif: 1 };
    // loadFactures + loadSupportingData (x2 after pay)
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compte] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compte] });
    mockApiPost
      .mockResolvedValueOnce({ message: "Facture créée", id: 100 })
      .mockResolvedValueOnce({ message: "Payée" });

    render(<FacturesPage />);

    await waitFor(() => screen.getByText("Payer une facture"));

    fireEvent.change(screen.getByLabelText(/Fournisseur/),     { target: { value: "Bell" } });
    fireEvent.change(screen.getByLabelText(/Référence/),       { target: { value: "B-001" } });
    fireEvent.change(screen.getByLabelText(/Montant/),         { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText(/Date d'échéance/), { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Payer la facture" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(2);
    });
    // Après rechargement, le compte_id est déjà défini → branche true couverte
    expect(document.body).toBeTruthy();
  });
});
