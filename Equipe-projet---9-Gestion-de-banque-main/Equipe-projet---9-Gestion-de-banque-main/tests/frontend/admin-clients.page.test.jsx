import { jest } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GestionClientsPage from "../../frontend/src/app/dashboard/admin/clients/page";

const mockApiGet         = jest.fn();
const mockApiPost        = jest.fn();
const mockApiPatch       = jest.fn();
const mockApiDelete      = jest.fn();
const mockApiDownloadCSV = jest.fn();
let mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:         (...args) => mockApiGet(...args),
  apiPost:        (...args) => mockApiPost(...args),
  apiPatch:       (...args) => mockApiPatch(...args),
  apiDelete:      (...args) => mockApiDelete(...args),
  apiDownloadCSV: (...args) => mockApiDownloadCSV(...args),
}));

/* ── Fixtures ─────────────────────────────────────────────── */
const clientDemo = { id: 1, prenom: "Alice", nom: "Martin", email_fictif: "alice@Leon.local", ville: "Ottawa" };
const client2    = { id: 2, prenom: "Bob",   nom: "Dupont",  email_fictif: "bob@Leon.local",   ville: "Montreal" };

const opsDemo = {
  client:    { ...clientDemo, cree_le: "2026-01-01T00:00:00.000Z" },
  comptes:   [{ id: 10, type_compte: "CHEQUES", numero_compte: "**** 4242", solde: "3500.00", devise: "CAD", est_actif: 1 }],
  virements: [],
  depots:    [],
  retraits:  [],
  factures:  [{ id: 5, fournisseur: "Hydro-Quebec", reference_facture: "HQ-001", montant: "145.00", statut: "IMPAYEE", date_echeance: "2026-03-31", compte_paiement_numero: null }],
  cartes:    [{ id: 3, type_carte: "VISA", numero_compte: "4532 8814 7700 4242", limite_credit: "5000.00", solde_utilise: "1240.50", statut: "ACTIVE", date_expiration: "2028-03-31" }],
};

const opsVide = { client: clientDemo, comptes: [], virements: [], depots: [], retraits: [], factures: [], cartes: [] };

/* ── Reset complet entre tests ────────────────────────────── */
function resetMocks() {
  jest.clearAllMocks();
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockApiDownloadCSV.mockReset();
  mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
}

/* ── Helper: render + selection du client
   Les mocks supplementaires sont ajoutes APRES les deux mocks de base
   pour garantir l'ordre FIFO correct. ─────────────────────── */
const interacDefaultMocks = () => {
  mockApiGet.mockResolvedValueOnce({ data: [] });   // /admin/interac/client/1
  mockApiGet.mockResolvedValueOnce({ data: null });  // /admin/interac/client/1/autodeposit
  mockApiGet.mockResolvedValueOnce({ data: { total_24h: 0, total_7j: 0, total_30j: 0, nb_en_attente: 0 } }); // /admin/interac/client/1/stats
  mockApiGet.mockResolvedValueOnce({ data: { limite_24h: null, limite_7j: null, limite_30j: null } }); // /admin/interac/client/1/limites
};

async function setupAndSelect(opsOverride = opsDemo, ...extraGetMocks) {
  mockApiGet.mockResolvedValueOnce({ data: [clientDemo] }); // /clients
  mockApiGet.mockResolvedValueOnce(opsOverride);             // /clients/1/operations
  interacDefaultMocks();                                     // loadInterac (3 parallel calls)
  for (const m of extraGetMocks) mockApiGet.mockResolvedValueOnce(m);

  render(<GestionClientsPage />);
  fireEvent.click(await screen.findByText("Alice Martin"));
  await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
}

async function goToFacturesTab(opsOverride = opsDemo, ...extraGetMocks) {
  await setupAndSelect(opsOverride, ...extraGetMocks);
  fireEvent.click(await screen.findByRole("button", { name: /Factures/ }));
}

async function goToCartesTab(opsOverride = opsDemo, ...extraGetMocks) {
  await setupAndSelect(opsOverride, ...extraGetMocks);
  fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
}

/* ── Tests ────────────────────────────────────────────────── */

describe("GestionClientsPage — acces et chargement", () => {
  beforeEach(resetMocks);

  it("affiche le message de restriction pour un UTILISATEUR", async () => {
    mockUser = { id: 2, prenom: "Jean", nom: "Dupont", role: "UTILISATEUR" };
    await act(async () => { render(<GestionClientsPage />); });
    expect(screen.getByText(/modérateurs et administrateurs/)).toBeInTheDocument();
  });

  it("charge la liste des clients au montage pour un admin", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    render(<GestionClientsPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients"));
    expect(await screen.findByText("Alice Martin")).toBeInTheDocument();
  });

  it("affiche les operations du client apres selection", async () => {
    await setupAndSelect();
    expect(screen.getByText("**** 4242")).toBeInTheDocument();
  });

  it("effectue une recherche de clients", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<GestionClientsPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Rechercher un client…"), { target: { value: "Alice" } });
    fireEvent.click(screen.getByRole("button", { name: /OK/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/clients?search=Alice");
    });
  });

  it("affiche un message si aucun client n'est selectionne", async () => {
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    await act(async () => { render(<GestionClientsPage />); });
    expect(screen.getByText(/pour voir ses opérations/)).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement des clients echoue", async () => {
    mockApiGet.mockRejectedValueOnce({ message: "Erreur réseau" });
    render(<GestionClientsPage />);
    // Le message est prefixe par "✗ " — on utilise une regex
    expect(await screen.findByText(/Erreur réseau/)).toBeInTheDocument();
  });

  it("affiche les compteurs par onglet apres selection", async () => {
    await setupAndSelect();
    // 1 facture + 1 carte → au moins deux badges "1"
    const badges = await screen.findAllByText("1");
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("reinitialise le formulaire de carte lors du changement de client", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo, client2] })  // /clients
      .mockResolvedValueOnce(opsDemo)                          // Alice /clients/1/operations
      .mockResolvedValueOnce({ data: [] })                     // Alice interac transfers
      .mockResolvedValueOnce({ data: null })                   // Alice interac autodeposit
      .mockResolvedValueOnce({ data: { total_24h: 0, total_7j: 0, total_30j: 0, nb_en_attente: 0 } }) // Alice interac stats
      .mockResolvedValueOnce({ data: { limite_24h: null, limite_7j: null, limite_30j: null } }) // Alice interac limites
      .mockResolvedValueOnce(opsVide)                          // Bob /clients/2/operations
      .mockResolvedValueOnce({ data: [] })                     // Bob interac transfers
      .mockResolvedValueOnce({ data: null })                   // Bob interac autodeposit
      .mockResolvedValueOnce({ data: { total_24h: 0, total_7j: 0, total_30j: 0, nb_en_attente: 0 } }) // Bob interac stats
      .mockResolvedValueOnce({ data: { limite_24h: null, limite_7j: null, limite_30j: null } }); // Bob interac limites

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    // Le champ last_four a le placeholder "4242"
    expect(screen.getByPlaceholderText("4242")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Bob Dupont"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("4242")).not.toBeInTheDocument();
    });
  });
});

/* ── Onglet Factures ──────────────────────────────────────── */

describe("GestionClientsPage — onglet Factures", () => {
  beforeEach(resetMocks);

  it("affiche la liste des factures existantes", async () => {
    await goToFacturesTab();
    expect(await screen.findByText("Hydro-Quebec")).toBeInTheDocument();
    expect(screen.getByText("HQ-001")).toBeInTheDocument();
  });

  it("affiche le bouton '+ Nouvelle facture' pour un admin", async () => {
    await goToFacturesTab();
    expect(await screen.findByRole("button", { name: /Nouvelle facture/ })).toBeInTheDocument();
  });

  it("ouvre le formulaire de creation de facture au clic", async () => {
    await goToFacturesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));
    // Les champs sont identifies par leur placeholder
    expect(screen.getByPlaceholderText("Hydro-Québec")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("HQ-2026-001")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("145.78")).toBeInTheDocument();
  });

  it("ferme le formulaire au clic sur Annuler", async () => {
    await goToFacturesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));
    fireEvent.click(screen.getByRole("button", { name: /Annuler/ }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Hydro-Québec")).not.toBeInTheDocument();
    });
  });

  it("cree une facture avec succes", async () => {
    // 3e mock = reload apres creation
    await goToFacturesTab(opsDemo, opsDemo);
    mockApiPost.mockResolvedValueOnce({ message: "Facture créée", id: 20 });

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));
    fireEvent.change(screen.getByPlaceholderText("Hydro-Québec"), { target: { value: "Bell Canada" } });
    fireEvent.change(screen.getByPlaceholderText("HQ-2026-001"),  { target: { value: "BELL-2026" } });
    fireEvent.change(screen.getByPlaceholderText("145.78"),       { target: { value: "89.99" } });
    // Champs date cibles par type=date uniquement
    const [dateEmission, dateEcheance] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateEmission, { target: { value: "2026-03-01" } });
    fireEvent.change(dateEcheance, { target: { value: "2026-03-31" } });

    fireEvent.click(screen.getByRole("button", { name: "Créer la facture" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/factures",
        expect.objectContaining({ client_id: 1, fournisseur: "Bell Canada", reference_facture: "BELL-2026" })
      );
    });
  });

  it("affiche le message de succes apres creation de facture", async () => {
    await goToFacturesTab(opsDemo, opsDemo);
    mockApiPost.mockResolvedValueOnce({ message: "Facture créée", id: 20 });

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));
    fireEvent.change(screen.getByPlaceholderText("Hydro-Québec"), { target: { value: "Vidéotron" } });
    fireEvent.change(screen.getByPlaceholderText("HQ-2026-001"),  { target: { value: "VID-001" } });
    fireEvent.change(screen.getByPlaceholderText("145.78"),       { target: { value: "55.00" } });
    const [dateEmission, dateEcheance] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateEmission, { target: { value: "2026-03-01" } });
    fireEvent.change(dateEcheance, { target: { value: "2026-03-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer la facture" }));

    expect(await screen.findByText(/Facture créée/)).toBeInTheDocument();
  });

  it("affiche une erreur si la creation de facture echoue", async () => {
    await goToFacturesTab();
    mockApiPost.mockRejectedValueOnce({ message: "Référence déjà utilisée" });

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));
    fireEvent.change(screen.getByPlaceholderText("Hydro-Québec"), { target: { value: "X" } });
    fireEvent.change(screen.getByPlaceholderText("HQ-2026-001"),  { target: { value: "DUP-001" } });
    fireEvent.change(screen.getByPlaceholderText("145.78"),       { target: { value: "10" } });
    const [dateEmission, dateEcheance] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateEmission, { target: { value: "2026-03-01" } });
    fireEvent.change(dateEcheance, { target: { value: "2026-03-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer la facture" }));

    expect(await screen.findByText(/Référence déjà utilisée/)).toBeInTheDocument();
  });

  it("affiche 'Aucune facture' si la liste est vide", async () => {
    await goToFacturesTab(opsVide);
    expect(await screen.findByText("Aucune facture.")).toBeInTheDocument();
  });

  it("n'affiche pas le bouton '+ Nouvelle facture' pour un moderateur", async () => {
    mockUser = { id: 3, prenom: "Mod", nom: "One", role: "MODERATEUR" };
    await goToFacturesTab();
    await screen.findByText("Hydro-Quebec");
    expect(screen.queryByRole("button", { name: /Nouvelle facture/ })).not.toBeInTheDocument();
  });
});

/* ── Onglet Cartes ────────────────────────────────────────── */

describe("GestionClientsPage — onglet Cartes", () => {
  beforeEach(resetMocks);

  it("affiche la liste des cartes existantes", async () => {
    await goToCartesTab();
    expect(await screen.findByText("VISA")).toBeInTheDocument();
    expect(screen.getByText("**** 4242")).toBeInTheDocument();
  });

  it("affiche le bouton '+ Nouvelle carte' pour un admin", async () => {
    await goToCartesTab();
    expect(await screen.findByRole("button", { name: /Nouvelle carte/ })).toBeInTheDocument();
  });

  it("ouvre le formulaire de creation de carte au clic", async () => {
    await goToCartesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    expect(screen.getByPlaceholderText("4242")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("5000")).toBeInTheDocument();
  });

  it("ferme le formulaire de carte au clic sur Annuler", async () => {
    await goToCartesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    fireEvent.click(screen.getByRole("button", { name: /Annuler/ }));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("4242")).not.toBeInTheDocument();
    });
  });

  it("cree une carte avec succes", async () => {
    await goToCartesTab(opsDemo, opsDemo); // 3e mock = reload
    mockApiPost.mockResolvedValueOnce({ message: "Carte creee", id: 10 });

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    fireEvent.change(screen.getByPlaceholderText("4242"),        { target: { value: "1234" } });
    fireEvent.change(screen.getByPlaceholderText("5000"),        { target: { value: "5000" } });
    fireEvent.change(screen.getByPlaceholderText("2028-12-31"),  { target: { value: "2030-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/cartes",
        expect.objectContaining({ client_id: 1, last_four: "1234", type_carte: "VISA" })
      );
    });
  });

  it("affiche le message de succes apres creation de carte", async () => {
    await goToCartesTab(opsDemo, opsDemo);
    mockApiPost.mockResolvedValueOnce({ message: "Carte creee", id: 10 });

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    fireEvent.change(screen.getByPlaceholderText("4242"),        { target: { value: "9999" } });
    fireEvent.change(screen.getByPlaceholderText("5000"),        { target: { value: "3000" } });
    fireEvent.change(screen.getByPlaceholderText("2028-12-31"),  { target: { value: "2029-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));

    expect(await screen.findByText(/Carte creee/)).toBeInTheDocument();
  });

  it("affiche une erreur si la creation de carte echoue", async () => {
    await goToCartesTab();
    mockApiPost.mockRejectedValueOnce({ message: "Client introuvable" });

    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    fireEvent.change(screen.getByPlaceholderText("4242"),        { target: { value: "0000" } });
    fireEvent.change(screen.getByPlaceholderText("5000"),        { target: { value: "1000" } });
    fireEvent.change(screen.getByPlaceholderText("2028-12-31"),  { target: { value: "2028-06-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));

    expect(await screen.findByText(/Client introuvable/)).toBeInTheDocument();
  });

  it("bloque une carte ACTIVE", async () => {
    const carteBloquee = { ...opsDemo.cartes[0], statut: "BLOQUEE" };
    await goToCartesTab(opsDemo, { ...opsDemo, cartes: [carteBloquee] }); // 3e mock = reload
    mockApiPatch.mockResolvedValueOnce({ message: "Carte bloquee avec succes" });

    fireEvent.click(await screen.findByRole("button", { name: "Bloquer" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/3/bloquer", {});
    });
    expect(await screen.findByText(/Carte bloquee avec succes/)).toBeInTheDocument();
  });

  it("active une carte BLOQUEE", async () => {
    const carteBloquee = { ...opsDemo.cartes[0], statut: "BLOQUEE" };
    const carteActive  = { ...opsDemo.cartes[0], statut: "ACTIVE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ ...opsDemo, cartes: [carteBloquee] });
    interacDefaultMocks();
    mockApiGet
      .mockResolvedValueOnce({ ...opsDemo, cartes: [carteActive] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte activee avec succes" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Activer" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/3/activer", {});
    });
    expect(await screen.findByText(/Carte activee avec succes/)).toBeInTheDocument();
  });

  it("gele une carte ACTIVE", async () => {
    const carteGelee = { ...opsDemo.cartes[0], statut: "GELEE" };
    await goToCartesTab(opsDemo, { ...opsDemo, cartes: [carteGelee] }); // 3e mock = reload
    mockApiPatch.mockResolvedValueOnce({ message: "Carte gelee avec succes" });

    fireEvent.click(await screen.findByRole("button", { name: "Geler" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/3/geler", {});
    });
    expect(await screen.findByText(/Carte gelee avec succes/)).toBeInTheDocument();
  });

  it("degele une carte GELEE", async () => {
    const carteGelee  = { ...opsDemo.cartes[0], statut: "GELEE" };
    const carteActive = { ...opsDemo.cartes[0], statut: "ACTIVE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ ...opsDemo, cartes: [carteGelee] });
    interacDefaultMocks();
    mockApiGet
      .mockResolvedValueOnce({ ...opsDemo, cartes: [carteActive] });
    mockApiPatch.mockResolvedValueOnce({ message: "Carte degelee avec succes" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Dégeler" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/3/degeler", {});
    });
    expect(await screen.findByText(/Carte degelee avec succes/)).toBeInTheDocument();
  });

  it("ouvre le formulaire de modification de limite", async () => {
    await goToCartesTab();
    fireEvent.click(await screen.findByRole("button", { name: "Limite" }));
    expect(await screen.findByRole("button", { name: "Modifier" })).toBeInTheDocument();
  });

  it("modifie la limite d'une carte", async () => {
    const carteModifiee = { ...opsDemo.cartes[0], limite_credit: "8000.00" };
    await goToCartesTab(opsDemo, { ...opsDemo, cartes: [carteModifiee] }); // 3e mock = reload
    mockApiPatch.mockResolvedValueOnce({ message: "Limite modifiee avec succes" });

    fireEvent.click(await screen.findByRole("button", { name: "Limite" }));
    const limiteInput = await screen.findByPlaceholderText("8000.00");
    fireEvent.change(limiteInput, { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/cartes/3/limite", { limite_credit: "8000" });
    });
    expect(await screen.findByText(/Limite modifiee avec succes/)).toBeInTheDocument();
  });

  it("ferme le formulaire de limite au clic sur Annuler", async () => {
    await goToCartesTab();
    fireEvent.click(await screen.findByRole("button", { name: "Limite" }));
    expect(await screen.findByRole("button", { name: "Modifier" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument();
    });
  });

  it("affiche une erreur si le blocage echoue", async () => {
    await goToCartesTab();
    mockApiPatch.mockRejectedValueOnce({ message: "Carte déjà bloquée" });

    fireEvent.click(await screen.findByRole("button", { name: "Bloquer" }));
    expect(await screen.findByText(/Carte déjà bloquée/)).toBeInTheDocument();
  });

  it("affiche une erreur si la modification de limite echoue", async () => {
    await goToCartesTab();
    mockApiPatch.mockRejectedValueOnce({ message: "Limite invalide" });

    fireEvent.click(await screen.findByRole("button", { name: "Limite" }));
    const limiteInput = await screen.findByPlaceholderText("8000.00");
    fireEvent.change(limiteInput, { target: { value: "0.01" } });
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    expect(await screen.findByText(/Limite invalide/)).toBeInTheDocument();
  });

  it("affiche 'Aucune carte' si la liste est vide", async () => {
    await goToCartesTab(opsVide);
    expect(await screen.findByText("Aucune carte.")).toBeInTheDocument();
  });

  it("n'affiche pas le bouton '+ Nouvelle carte' pour un moderateur", async () => {
    mockUser = { id: 3, prenom: "Mod", nom: "One", role: "MODERATEUR" };
    await goToCartesTab();
    await screen.findByText("VISA");
    expect(screen.queryByRole("button", { name: /Nouvelle carte/ })).not.toBeInTheDocument();
  });

  it("change le type_carte dans le formulaire de nouvelle carte", async () => {
    await goToCartesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "MASTERCARD" } });
    expect(select.value).toBe("MASTERCARD");
  });

  it("affiche une erreur si l'activation echoue", async () => {
    const carteBloquee = { ...opsDemo.cartes[0], statut: "BLOQUEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ ...opsDemo, cartes: [carteBloquee] });
    mockApiPatch.mockRejectedValueOnce({ message: "Activation impossible" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Activer" }));

    expect(await screen.findByText(/Activation impossible/)).toBeInTheDocument();
  });

  it("affiche une erreur si le gel echoue", async () => {
    await goToCartesTab();
    mockApiPatch.mockRejectedValueOnce({ message: "Gel impossible" });

    fireEvent.click(await screen.findByRole("button", { name: "Geler" }));
    expect(await screen.findByText(/Gel impossible/)).toBeInTheDocument();
  });

  it("affiche une erreur si le degel echoue", async () => {
    const carteGelee = { ...opsDemo.cartes[0], statut: "GELEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ ...opsDemo, cartes: [carteGelee] });
    mockApiPatch.mockRejectedValueOnce({ message: "Degel impossible" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Dégeler" }));

    expect(await screen.findByText(/Degel impossible/)).toBeInTheDocument();
  });
});

/* ── Onglet Factures — champs supplementaires ─────────── */

describe("GestionClientsPage — champs facture", () => {
  beforeEach(resetMocks);

  it("change le statut dans le formulaire de facture", async () => {
    await goToFacturesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));

    const selects = screen.getAllByRole("combobox");
    const statutSelect = selects[selects.length - 1];
    fireEvent.change(statutSelect, { target: { value: "A_VENIR" } });
    expect(statutSelect.value).toBe("A_VENIR");
  });

  it("change la description dans le formulaire de facture", async () => {
    await goToFacturesTab();
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));

    fireEvent.change(screen.getByPlaceholderText("Facture d'électricité — mars 2026"), { target: { value: "Ma description" } });
    expect(screen.getByPlaceholderText("Facture d'électricité — mars 2026")).toHaveValue("Ma description");
  });
});

/* ── Recherche par Entree ──────────────────────────────── */

describe("GestionClientsPage — recherche Enter", () => {
  beforeEach(resetMocks);

  it("lance une recherche en appuyant sur Entree", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce({ data: [clientDemo] });

    render(<GestionClientsPage />);
    await waitFor(() => screen.getByPlaceholderText("Rechercher un client…"));

    fireEvent.change(screen.getByPlaceholderText("Rechercher un client…"), { target: { value: "Alice" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Rechercher un client…"), { key: "Enter" });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining("Alice"));
    });
  });
});

/* ── Onglets client (virements, depots, retraits) ──────── */

describe("GestionClientsPage — onglets listes", () => {
  beforeEach(resetMocks);

  it("affiche les virements sur l'onglet Virements", async () => {
    const opsAvecVirements = {
      ...opsDemo,
      virements: [{
        id: 7, montant: "250.00", statut: "ACCEPTE", date_virement: "2026-02-01T00:00:00.000Z",
        client_source_nom: "Alice Martin", compte_source_type: "CHEQUES", compte_source_numero: "**** 4242",
        client_destination_nom: "Bob Dupont", compte_destination_type: "EPARGNE", compte_destination_numero: "**** 5678",
      }],
    };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce(opsAvecVirements);

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Virements/ }));
    await waitFor(() => {
      expect(screen.getByText("Bob Dupont")).toBeInTheDocument();
    });
  });

  it("affiche 'Aucun virement' si vide", async () => {
    await setupAndSelect(opsVide);
    fireEvent.click(await screen.findByRole("button", { name: /Virements/ }));
    await waitFor(() => {
      expect(screen.getByText("Aucun virement.")).toBeInTheDocument();
    });
  });

  it("affiche les depots sur l'onglet Depots", async () => {
    const opsAvecDepots = {
      ...opsDemo,
      depots: [{
        id: 11, montant: "500.00", statut: "APPROUVE", depose_le: "2026-02-15T00:00:00.000Z",
        numero_cheque: "CHQ-001", banque_emettrice: "BMO", type_compte: "CHEQUES", numero_compte: "**** 4242",
      }],
    };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce(opsAvecDepots);

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Dépôts/ }));
    await waitFor(() => {
      expect(screen.getByText("CHQ-001")).toBeInTheDocument();
    });
  });

  it("affiche 'Aucun depot' si vide", async () => {
    await setupAndSelect(opsVide);
    fireEvent.click(await screen.findByRole("button", { name: /Dépôts/ }));
    await waitFor(() => {
      expect(screen.getByText("Aucun dépôt.")).toBeInTheDocument();
    });
  });

  it("affiche les retraits sur l'onglet Retraits", async () => {
    const opsAvecRetraits = {
      ...opsDemo,
      retraits: [{
        id: 22, montant: "75.00", statut: "TERMINEE", date_demande: "2026-02-10T00:00:00.000Z",
        description: "Retrait guichet", type_compte: "CHEQUES", numero_compte: "**** 4242",
      }],
    };
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockResolvedValueOnce(opsAvecRetraits);

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Retraits/ }));
    await waitFor(() => {
      expect(screen.getByText("Retrait guichet")).toBeInTheDocument();
    });
  });

  it("affiche 'Aucun retrait' si vide", async () => {
    await setupAndSelect(opsVide);
    fireEvent.click(await screen.findByRole("button", { name: /Retraits/ }));
    await waitFor(() => {
      expect(screen.getByText("Aucun retrait.")).toBeInTheDocument();
    });
  });
});

/* ── Sous-panneau admin compte (Gérer) ─────────────────── */

async function goToComptePanel(...extraMocks) {
  resetMocks();
  mockApiGet.mockResolvedValueOnce({ data: [clientDemo] }); // /clients
  mockApiGet.mockResolvedValueOnce(opsDemo);                // /clients/1/operations
  interacDefaultMocks();                                    // loadInterac (3 parallel calls)
  mockApiGet.mockResolvedValueOnce({ data: [] });           // loadTransactions after selectCompte
  for (const m of extraMocks) mockApiGet.mockResolvedValueOnce(m);

  render(<GestionClientsPage />);
  fireEvent.click(await screen.findByText("Alice Martin"));
  await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

  // Cliquer "Gérer" sur le compte #10
  fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
  await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));
}

describe("GestionClientsPage — sous-panneau admin compte", () => {
  it("clic sur Gérer affiche le sous-panneau de compte", async () => {
    await goToComptePanel();
    await waitFor(() => {
      expect(screen.getByText(/Compte #10/)).toBeInTheDocument();
    });
  });

  it("le bouton Fermer masque le sous-panneau", async () => {
    await goToComptePanel();
    await waitFor(() => screen.getByText(/Compte #10/));

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => {
      expect(screen.queryByText(/Compte #10/)).not.toBeInTheDocument();
    });
  });

  it("soumettre le formulaire de solde appelle apiPatch /admin/comptes/10/balance", async () => {
    // Extra mocks: refresh after submit (loadOps + loadTransactions)
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPatch.mockResolvedValueOnce({ message: "Solde ajusté", nouveau_solde: 3600 });

    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));
    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer l'ajustement" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        "/admin/comptes/10/balance",
        expect.objectContaining({ montant: "100" })
      );
    });
  });

  it("erreur du formulaire de solde affiche le message", async () => {
    await goToComptePanel();
    mockApiPatch.mockRejectedValueOnce({ message: "Solde insuffisant" });

    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));
    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "-999" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer l'ajustement" }));

    expect(await screen.findByText(/Solde insuffisant/)).toBeInTheDocument();
  });

  it("met a jour type_transaction et motif dans le formulaire solde", async () => {
    await goToComptePanel();
    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "RETRAIT" } });
    expect(selects[0].value).toBe("RETRAIT");

    fireEvent.change(screen.getByPlaceholderText("Correction, bonus, pénalité…"), { target: { value: "Test motif" } });
    expect(screen.getByPlaceholderText("Correction, bonus, pénalité…")).toHaveValue("Test motif");
  });

  it("toggle statut compte — Bloquer + Confirmer appelle apiPatch", async () => {
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPatch.mockResolvedValueOnce({ message: "Compte bloqué" });

    await waitFor(() => screen.getByRole("button", { name: "Bloquer" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));
    await waitFor(() => screen.getByText("Confirmer"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/admin/comptes/10/status", {});
    });
  });

  it("toggle statut compte — Annuler ferme le modal", async () => {
    await goToComptePanel();
    await waitFor(() => screen.getByRole("button", { name: "Bloquer" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));
    await waitFor(() => screen.getByText(/Bloquer le compte/));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() => {
      expect(screen.queryByText(/Bloquer le compte/)).not.toBeInTheDocument();
    });
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it("toggle statut erreur affiche le message", async () => {
    await goToComptePanel();
    mockApiPatch.mockRejectedValueOnce({ message: "Toggle échoué" });

    await waitFor(() => screen.getByRole("button", { name: "Bloquer" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));
    await waitFor(() => screen.getByText("Confirmer"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(await screen.findByText(/Toggle échoué/)).toBeInTheDocument();
  });

  it("changer le type de compte appelle apiPatch /admin/comptes/10/type", async () => {
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPatch.mockResolvedValueOnce({ message: "Type modifié" });

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByText("Changer le type de compte"));

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "EPARGNE" } });
    fireEvent.click(screen.getByRole("button", { name: "Modifier le type" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/admin/comptes/10/type", { type_compte: "EPARGNE" });
    });
  });

  it("inserer une transaction appelle apiPost /admin/comptes/10/transactions", async () => {
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPost.mockResolvedValueOnce({ message: "Transaction insérée", id: 77 });

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByText("Insérer une transaction"));

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "RETRAIT" } });
    fireEvent.change(selects[1], { target: { value: "EN_ATTENTE" } });
    fireEvent.change(screen.getByPlaceholderText("ex: 200 ou -50"), { target: { value: "150" } });
    fireEvent.change(screen.getByPlaceholderText("Note…"), { target: { value: "Test tx" } });

    fireEvent.click(screen.getByRole("button", { name: "Insérer la transaction" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/comptes/10/transactions",
        expect.objectContaining({ montant: "150" })
      );
    });
  });

  it("supprimer une transaction — Confirmer appelle apiDelete", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-02-01T00:00:00.000Z", statut: "TERMINEE" };
    resetMocks();
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockResolvedValueOnce({ data: [tx] }); // loadTransactions
    mockApiGet.mockResolvedValueOnce(opsDemo);         // refresh after delete
    mockApiGet.mockResolvedValueOnce({ data: [] });    // loadTransactions after refresh
    mockApiDelete.mockResolvedValueOnce({ message: "Transaction supprimée" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));
    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));

    await waitFor(() => screen.getByText(/Supprimer la transaction/));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith("/admin/transactions/55");
    });
  });

  it("supprimer une transaction — Annuler ferme le modal", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-02-01T00:00:00.000Z", statut: "TERMINEE" };
    resetMocks();
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockResolvedValueOnce({ data: [tx] });
    mockApiDelete.mockResolvedValueOnce({ message: "Transaction supprimée" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));
    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));

    await waitFor(() => screen.getByText(/Supprimer la transaction/));
    fireEvent.click(screen.getAllByRole("button", { name: "Annuler" })[0]);

    await waitFor(() => {
      expect(screen.queryByText(/Supprimer la transaction/)).not.toBeInTheDocument();
    });
    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it("virement depuis le compte selectionne appelle apiPost /admin/virements/force", async () => {
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPost.mockResolvedValueOnce({ message: "Virement effectué", id: 88 });

    fireEvent.click(await screen.findByRole("button", { name: "Virement" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "4444 5555 6666" } });
    fireEvent.change(screen.getByPlaceholderText("621"),             { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),           { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"),          { target: { value: "400" } });
    fireEvent.change(screen.getByPlaceholderText("Motif…"),          { target: { value: "Test vir" } });

    fireEvent.click(screen.getByRole("button", { name: "Exécuter le virement" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/virements/force",
        expect.objectContaining({ compte_source_id: 10, montant: "400" })
      );
    });
  });

  it("executer le virement depuis le compte selectionne appelle apiPost /admin/virements/force", async () => {
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPost.mockResolvedValueOnce({ message: "Virement effectué", id: 99 });

    fireEvent.click(await screen.findByRole("button", { name: "Virement" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "9999 8888 7777" } });
    fireEvent.change(screen.getByPlaceholderText("621"),            { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),          { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"),         { target: { value: "250" } });
    fireEvent.change(screen.getByPlaceholderText("Motif…"),         { target: { value: "Remboursement" } });

    fireEvent.click(screen.getByRole("button", { name: "Exécuter le virement" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/virements/force",
        expect.objectContaining({ compte_source_id: 10, montant: "250" })
      );
    });
  });

  it("CSV transactions declenche apiDownloadCSV", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-02-01T00:00:00.000Z", statut: "TERMINEE" };
    resetMocks();
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockResolvedValueOnce({ data: [tx] });
    mockApiDownloadCSV.mockResolvedValue(undefined);

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "⬇ CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "⬇ CSV" }));

    await waitFor(() => {
      expect(mockApiDownloadCSV).toHaveBeenCalledWith(
        "/export/transactions/10",
        expect.stringContaining("transactions-")
      );
    });
  });

  it("loadTransactions echec silencieux — setTransactions vide", async () => {
    resetMocks();
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockRejectedValueOnce(new Error("Erreur TX silencieuse")); // loadTransactions fails

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    // No error message — catch is silent
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));
    // Transactions tab should show Aucune transaction after silent failure
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => {
      expect(screen.getByText("Aucune transaction.")).toBeInTheDocument();
    });
  });

  it("erreur handleChangeType affiche le message", async () => {
    await goToComptePanel();
    mockApiPatch.mockRejectedValueOnce({ message: "Type invalide" });

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByText("Changer le type de compte"));
    fireEvent.click(screen.getByRole("button", { name: "Modifier le type" }));

    expect(await screen.findByText(/Type invalide/)).toBeInTheDocument();
  });

  it("erreur handleAddTransaction affiche le message", async () => {
    await goToComptePanel();
    mockApiPost.mockRejectedValueOnce({ message: "Transaction refusée" });

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByText("Insérer une transaction"));
    fireEvent.change(screen.getByPlaceholderText("ex: 200 ou -50"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer la transaction" }));

    expect(await screen.findByText(/Transaction refusée/)).toBeInTheDocument();
  });

  it("erreur confirmDeleteTransaction affiche le message", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-02-01T00:00:00.000Z", statut: "TERMINEE" };
    resetMocks();
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockResolvedValueOnce({ data: [tx] });
    mockApiDelete.mockRejectedValueOnce({ message: "Suppression impossible" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));
    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));
    await waitFor(() => screen.getByText(/Supprimer la transaction/));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(await screen.findByText(/Suppression impossible/)).toBeInTheDocument();
  });

  it("erreur handleForceTransfer affiche le message", async () => {
    await goToComptePanel();
    mockApiPost.mockRejectedValueOnce({ message: "Virement refusé" });

    fireEvent.click(await screen.findByRole("button", { name: "Virement" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "9999 8888 7777" } });
    fireEvent.change(screen.getByPlaceholderText("621"),            { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),          { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"),         { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Exécuter le virement" }));

    expect(await screen.findByText(/Virement refusé/)).toBeInTheDocument();
  });
});

/* ── Onglet Virement unifié ──────────────────────────── */

describe("GestionClientsPage — onglet Virement unifie", () => {
  beforeEach(resetMocks);

  it("affiche le formulaire de virement dans l'onglet Virement", async () => {
    await goToComptePanel();
    fireEvent.click(await screen.findByRole("button", { name: "Virement" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));
    expect(screen.getByPlaceholderText("621")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("500.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exécuter le virement" })).toBeInTheDocument();
  });

  it("le formulaire de virement ne contient pas de champ source", async () => {
    await goToComptePanel();
    fireEvent.click(await screen.findByRole("button", { name: "Virement" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));
    // Un seul champ XXXX (destination uniquement, source = compte sélectionné automatiquement)
    expect(screen.getAllByPlaceholderText("XXXX XXXX XXXX").length).toBe(1);
  });
});

/* ── Débloquer + empty cartes + MODERATEUR (lignes 1026, 1054, 1104) ─── */

describe("GestionClientsPage — branches lignes 1026/1054/1104", () => {
  beforeEach(resetMocks);

  /* ─── ligne 1104 : ternaire "Débloquer" quand est_actif=0 ─── */
  it("affiche 'Débloquer' dans le modal pour un compte inactif (est_actif=0)", async () => {
    const opsInactive = {
      ...opsDemo,
      comptes: [{ id: 10, type_compte: "CHEQUES", numero_compte: "**** 4242", solde: "0.00", devise: "CAD", est_actif: 0 }],
    };

    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsInactive);
    mockApiGet.mockResolvedValueOnce({ data: [] }); // loadTransactions

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));

    const toggleBtn = await screen.findByRole("button", { name: "Débloquer" });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Débloquer le compte ?/i)).toBeInTheDocument();
    });
  });

  /* ─── ligne 1028 : "Aucune carte." quand ops.cartes est vide ─── */
  it("affiche Aucune carte quand la liste des cartes est vide (ligne 1028)", async () => {
    const opsSansCartes = { ...opsDemo, cartes: [] };
    await setupAndSelect(opsSansCartes);

    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));

    await waitFor(() => {
      expect(screen.getByText("Aucune carte.")).toBeInTheDocument();
    });
  });

  /* ─── ligne 1026 : colonne Actions absente pour MODERATEUR (isAdmin=false) ─── */
  it("n'affiche pas la colonne Actions des cartes pour un MODERATEUR (ligne 1026)", async () => {
    mockUser = { id: 3, prenom: "Mod", nom: "One", role: "MODERATEUR" };

    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));

    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));

    await waitFor(() => {
      // La colonne Actions n'est rendue que pour ADMIN
      expect(screen.queryByRole("button", { name: "Geler" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Activer" })).not.toBeInTheDocument();
    });
  });
});

/* ── loadOps erreur ────────────────────────────────────── */

describe("GestionClientsPage — loadOps erreur", () => {
  beforeEach(resetMocks);

  it("affiche une erreur si loadOps echoue apres clic sur un client", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockRejectedValueOnce({ message: "Erreur chargement operations" });

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));

    expect(await screen.findByText(/Erreur chargement operations/)).toBeInTheDocument();
  });
});

/* ── Fallbacks ?? "Erreur" (erreur sans message) ──────────── */

describe("GestionClientsPage — fallbacks ?? 'Erreur' tous les handlers", () => {
  beforeEach(resetMocks);

  it("loadClients catch sans message → 'Erreur' (ligne 123)", async () => {
    mockApiGet.mockRejectedValueOnce({});
    render(<GestionClientsPage />);
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("loadOps catch sans message → 'Erreur' (ligne 138)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [clientDemo] })
      .mockRejectedValueOnce({});
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleAdjustBalance catch sans message → 'Erreur' (ligne 193)", async () => {
    await goToComptePanel();
    mockApiPatch.mockRejectedValueOnce({});
    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));
    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer l'ajustement" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("confirmToggleStatus catch sans message → 'Erreur' (ligne 204)", async () => {
    await goToComptePanel();
    mockApiPatch.mockRejectedValueOnce({});
    await waitFor(() => screen.getByRole("button", { name: "Bloquer" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));
    await waitFor(() => screen.getByText("Confirmer"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleChangeType catch sans message → 'Erreur' (ligne 214)", async () => {
    await goToComptePanel();
    mockApiPatch.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByRole("button", { name: "Modifier le type" }));
    fireEvent.click(screen.getByRole("button", { name: "Modifier le type" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleAddTransaction catch sans message → 'Erreur' (ligne 227)", async () => {
    await goToComptePanel();
    mockApiPost.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByPlaceholderText("ex: 200 ou -50"));
    fireEvent.change(screen.getByPlaceholderText("ex: 200 ou -50"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer la transaction" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("confirmDeleteTransaction catch sans message → 'Erreur' (ligne 239)", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-03-01T10:00:00.000Z", statut: "TERMINEE" };
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockResolvedValueOnce({ data: [tx] });
    mockApiDelete.mockRejectedValueOnce({});
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));
    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));
    await waitFor(() => screen.getByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleForceTransfer catch sans message → 'Erreur'", async () => {
    await goToComptePanel();
    mockApiPost.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Virement" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));
    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "9876 5432 1098" } });
    fireEvent.change(screen.getByPlaceholderText("621"), { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Exécuter le virement" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleCreateCarte catch sans message → 'Erreur'", async () => {
    await goToCartesTab();
    mockApiPost.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle carte/ }));
    fireEvent.change(screen.getByPlaceholderText("4242"),       { target: { value: "1111" } });
    fireEvent.change(screen.getByPlaceholderText("5000"),       { target: { value: "2000" } });
    fireEvent.change(screen.getByPlaceholderText("2028-12-31"), { target: { value: "2029-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Émettre la carte" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleBloquerCarte catch sans message → 'Erreur' (ligne 294)", async () => {
    await goToCartesTab();
    mockApiPatch.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Bloquer" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleActiverCarte catch sans message → 'Erreur' (ligne 302)", async () => {
    const carteBloquee = { ...opsDemo.cartes[0], statut: "BLOQUEE" };
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce({ ...opsDemo, cartes: [carteBloquee] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Activer" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleGelerCarte catch sans message → 'Erreur' (ligne 310)", async () => {
    await goToCartesTab();
    mockApiPatch.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Geler" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleDegelerCarte catch sans message → 'Erreur' (ligne 318)", async () => {
    const carteGelee = { ...opsDemo.cartes[0], statut: "GELEE" };
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce({ ...opsDemo, cartes: [carteGelee] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: /Cartes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Dégeler" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleModifierLimite catch sans message → 'Erreur' (ligne 329)", async () => {
    await goToCartesTab();
    mockApiPatch.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Limite" }));
    const limiteInput = await screen.findByPlaceholderText("8000.00");
    fireEvent.change(limiteInput, { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleCreateFacture catch sans message → 'Erreur' (ligne 342)", async () => {
    await goToFacturesTab();
    mockApiPost.mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: /Nouvelle facture/ }));
    fireEvent.change(screen.getByPlaceholderText("Hydro-Québec"), { target: { value: "X" } });
    fireEvent.change(screen.getByPlaceholderText("HQ-2026-001"), { target: { value: "X-001" } });
    fireEvent.change(screen.getByPlaceholderText("145.78"), { target: { value: "10" } });
    const [dateEmission, dateEcheance] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateEmission, { target: { value: "2026-01-01" } });
    fireEvent.change(dateEcheance, { target: { value: "2026-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer la facture" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });
});

/* ── Branches supplémentaires 2 ──────────────────────────── */

describe("GestionClientsPage — branches supplémentaires 2", () => {
  beforeEach(resetMocks);

  it("client sans ville — branche falsy ligne 445", async () => {
    const clientSansVille = { ...clientDemo, ville: null };
    mockApiGet.mockResolvedValueOnce({ data: [clientSansVille] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    // Branche falsy de selectedClient.ville → pas d'affichage de la ville
    expect(screen.queryByText(/Ottawa/)).not.toBeInTheDocument();
  });

  it("transaction negative — pas de signe + et couleur rouge (lignes 705-706)", async () => {
    const txNeg = { id: 77, type_transaction: "RETRAIT", montant: "-200.00", description: "Frais", date_transaction: "2026-04-01T10:00:00.000Z", statut: "TERMINEE" };
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    mockApiGet.mockResolvedValueOnce({ data: [txNeg] });
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/comptes/10/transactions"));
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => expect(screen.getByText("-200.00 $")).toBeInTheDocument());
    expect(screen.queryByText("+-200.00 $")).not.toBeInTheDocument();
  });

  it("solde_utilise = 0 d'une carte — branche false ligne 1026", async () => {
    const carteZero = { ...opsDemo.cartes[0], solde_utilise: "0.00" };
    await goToCartesTab({ ...opsDemo, cartes: [carteZero] });
    // Carte affichée sans erreur — branche false de Number(c.solde_utilise) > 0
    expect(await screen.findByText("VISA")).toBeInTheDocument();
  });

  it("retrait sans description affiche '—' (ligne 882)", async () => {
    const opsRetrait = {
      ...opsDemo,
      retraits: [{ id: 22, montant: "75.00", statut: "TERMINEE", date_demande: "2026-02-10T00:00:00.000Z", description: "", type_compte: "CHEQUES", numero_compte: "**** 4242" }],
    };
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsRetrait);
    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    fireEvent.click(await screen.findByRole("button", { name: /Retraits/ }));
    await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
  });

  it("deuxieme clic sur Limite masque le formulaire (ligne 1054 ternaire null)", async () => {
    await goToCartesTab();
    fireEvent.click(await screen.findByRole("button", { name: "Limite" }));
    expect(await screen.findByRole("button", { name: "Modifier" })).toBeInTheDocument();
    // Second clic → selectedCarteId === c.id → null → formulaire masqué
    fireEvent.click(screen.getByRole("button", { name: "Limite" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument();
    });
  });
});

/* ── Branches supplémentaires 3 ──────────────────────────────────────────── */
describe("GestionClientsPage — branches supplémentaires 3", () => {
  beforeEach(resetMocks);

  it("formatMoney avec une valeur numérique (ligne 10 true branch)", async () => {
    // Pass solde as a number (not string) to cover typeof === 'number' branch
    const opsNumber = {
      ...opsDemo,
      comptes: [{ ...opsDemo.comptes[0], solde: 3500 }],
    };
    await setupAndSelect(opsNumber);
    // formatMoney(3500) renders fine — covers the number branch
    expect(await screen.findByText("**** 4242")).toBeInTheDocument();
  });

  it("formatMoney avec une valeur NaN (ligne 11 true branch)", async () => {
    // Pass solde as non-numeric string → Number("abc") = NaN → fallback String(value)
    const opsNaN = {
      ...opsDemo,
      comptes: [{ ...opsDemo.comptes[0], solde: "abc" }],
    };
    await setupAndSelect(opsNaN);
    // The NaN branch falls back to String("abc") = "abc"
    expect(await screen.findByText("abc")).toBeInTheDocument();
  });

  it("clic sur l'onglet Comptes quand on est sur un autre onglet (ligne 473 false branch)", async () => {
    await setupAndSelect();
    // Navigate away from Comptes tab
    fireEvent.click(await screen.findByRole("button", { name: /Virements/ }));
    // Navigate back to Comptes — covers if (t.id !== "comptes") false branch
    fireEvent.click(await screen.findByRole("button", { name: /Comptes/ }));
    expect(await screen.findByText("**** 4242")).toBeInTheDocument();
  });

  it("ops.comptes vide affiche 'Aucun compte.' (ligne 507 true branch)", async () => {
    const opsSansComptes = { ...opsDemo, comptes: [] };
    await setupAndSelect(opsSansComptes);
    expect(await screen.findByText("Aucun compte.")).toBeInTheDocument();
  });

  it("affiche 'Chargement…' pendant loadingTx dans le panneau compte (ligne 689)", async () => {
    let resolveTx;
    // initial ops load
    mockApiGet.mockResolvedValueOnce({ data: [clientDemo] });
    mockApiGet.mockResolvedValueOnce(opsDemo);
    interacDefaultMocks();
    // loadTransactions for compte selection — deferred
    mockApiGet.mockReturnValueOnce(new Promise((r) => { resolveTx = r; }));

    render(<GestionClientsPage />);
    fireEvent.click(await screen.findByText("Alice Martin"));
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/clients/1/operations"));
    // Click Gérer to select compte → triggers loadTransactions (deferred)
    fireEvent.click(await screen.findByRole("button", { name: "Gérer" }));
    // Switch to Transactions tab while still loading
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
    // Resolve to avoid act() warnings
    resolveTx({ data: [] });
    await waitFor(() => expect(screen.getByText("Aucune transaction.")).toBeInTheDocument());
  });

  it("ops.cartes vide affiche 'Aucune carte.' (ligne 1018 true branch)", async () => {
    const opsSansCartes = { ...opsDemo, cartes: [] };
    await goToCartesTab(opsSansCartes);
    expect(await screen.findByText("Aucune carte.")).toBeInTheDocument();
  });

  /* ─── ligne 507 branche false : colSpan=6 (MODERATEUR + comptes vides) ─── */
  it("MODERATEUR + comptes vides — colSpan=6 (ligne 507 false branch)", async () => {
    mockUser = { id: 3, prenom: "Mod", nom: "One", role: "MODERATEUR" };
    const opsSansComptes = { ...opsDemo, comptes: [] };
    await setupAndSelect(opsSansComptes);
    expect(await screen.findByText("Aucun compte.")).toBeInTheDocument();
  });

  /* ─── ligne 1018 branche false : colSpan=7 (MODERATEUR + cartes vides) ─── */
  it("MODERATEUR + cartes vides — colSpan=7 (ligne 1018 false branch)", async () => {
    mockUser = { id: 3, prenom: "Mod", nom: "One", role: "MODERATEUR" };
    const opsSansCartes = { ...opsDemo, cartes: [] };
    await goToCartesTab(opsSansCartes);
    expect(await screen.findByText("Aucune carte.")).toBeInTheDocument();
  });
});

/* ── refreshCompte complète — lignes 136 / 172-174 ──────────────────────── */
describe("GestionClientsPage — refreshCompte complète (lignes 136/172-174)", () => {
  beforeEach(resetMocks);

  it("refreshCompte après ajustement solde — couvre loadOps+loadTx (lignes 136/172-174)", async () => {
    // goToComptePanel avec 2 mocks supplémentaires : loadOps refresh + loadTx refresh
    await goToComptePanel(opsDemo, { data: [] });
    mockApiPatch.mockResolvedValueOnce({ message: "Solde ajusté", nouveau_solde: 3600 });

    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));
    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer l'ajustement" }));

    // Attendre que refreshCompte consomme les mocks 4 (loadOps) et 5 (loadTransactions)
    // Cela couvre : ligne 172 (if !selectedClient → false), 173 (loadOps), 174 (if selectedCompte → true + loadTx)
    // Et ligne 136 : updated trouvé dans opsDemo.comptes → if(updated) setSelectedCompte → true branch
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(9);
    });
    // Laisser les microtasks en attente se terminer (callbacks .then() des appels 4 et 5)
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockApiPatch).toHaveBeenCalledWith(
      "/admin/comptes/10/balance",
      expect.objectContaining({ montant: "100" })
    );
  });
});
