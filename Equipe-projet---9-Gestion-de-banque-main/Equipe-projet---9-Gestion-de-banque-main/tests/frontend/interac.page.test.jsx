import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InteracPage from "../../frontend/src/app/dashboard/interac/page";

/* ── Mocks ────────────────────────────────────────────────── */
const mockApiGet    = jest.fn();
const mockApiPost   = jest.fn();
const mockApiDelete = jest.fn();
let mockUser = { id: 2, prenom: "Jean", nom: "Demo", role: "UTILISATEUR", email: "jean@test.com" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:    (...args) => mockApiGet(...args),
  apiPost:   (...args) => mockApiPost(...args),
  apiDelete: (...args) => mockApiDelete(...args),
}));

/* ── Fixtures ─────────────────────────────────────────────── */
const compteDemo = {
  id: 5,
  type_compte: "CHEQUES",
  numero_compte: "**** 1234",
  solde: "3500.00",
  devise: "CAD",
  est_actif: 1,
};

const transfertDemo = {
  id: 1,
  expediteur_id: 2,
  compte_source_id: 5,
  email_destinataire: "dest@test.com",
  montant: "150.00",
  description: "Remboursement dîner",
  statut: "EN_ATTENTE",
  date_envoi: "2026-04-10T10:00:00.000Z",
  date_expiration: "2026-05-10T10:00:00.000Z",
  date_traitement: null,
  expediteur_nom: "Jean Demo",
  expediteur_email: "jean@test.com",
};

const aReclamerDemo = {
  id: 10,
  expediteur_id: 99,
  compte_source_id: 20,
  email_destinataire: "jean@test.com",
  montant: "200.00",
  description: "Cadeau",
  statut: "EN_ATTENTE",
  date_envoi: "2026-04-09T08:00:00.000Z",
  date_expiration: "2026-05-09T08:00:00.000Z",
  date_traitement: null,
  expediteur_nom: "Alice Martin",
  expediteur_email: "alice@test.com",
  requiert_mot_de_passe: false,
};

const limitesGlobales = { limite_24h: 3000, limite_7j: 10000, limite_30j: 20000 };
const limitesPerso    = { limite_24h: 1000, limite_7j: 5000,  limite_30j: 10000 };

const beneficiaireDemo = {
  id: 1,
  utilisateur_id: 2,
  alias: "Maman",
  email_interac: "maman@test.com",
  cree_le: "2026-01-15T10:30:00.000Z",
};

const autoDepotActif  = {
  id: 3,
  email_interac: "jean@test.com",
  statut: "ACTIVE",
  compte_depot_id: 5,
  numero_compte: "**** 1234",
  type_compte: "CHEQUES",
  cree_le: "2026-04-01T00:00:00.000Z",
};

/* ── Helper : mock les 6 appels du useEffect UTILISATEUR ──── */
function mockUtilisateurInit({
  transferts    = [transfertDemo],
  comptes       = [compteDemo],
  aReclamer     = [],
  autoDeposit   = null,
  limites       = limitesGlobales,
  beneficiaires = [],
} = {}) {
  mockApiGet
    .mockResolvedValueOnce({ data: transferts })     // GET /interac
    .mockResolvedValueOnce({ data: comptes })        // GET /comptes
    .mockResolvedValueOnce({ data: aReclamer })      // GET /interac/a-reclamer
    .mockResolvedValueOnce({ data: autoDeposit })    // GET /interac/autodeposit
    .mockResolvedValueOnce({ data: limites })        // GET /interac/limites
    .mockResolvedValueOnce({ data: beneficiaires }); // GET /beneficiaires
}

function mockAdminInit({ transferts = [] } = {}) {
  mockApiGet.mockResolvedValueOnce({ data: transferts }); // GET /interac
}

/* ── Reset ────────────────────────────────────────────────── */
beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiDelete.mockReset();
  mockUser = { id: 2, prenom: "Jean", nom: "Demo", role: "UTILISATEUR", email: "jean@test.com" };
});

/* ══════════════════════════════════════════════════════════════
   Chargement initial
══════════════════════════════════════════════════════════════ */
describe("InteracPage — chargement initial", () => {
  it("affiche le titre 'Interac e-Transfert'", async () => {
    mockUtilisateurInit();
    render(<InteracPage />);
    expect(await screen.findByText("Interac e-Transfert")).toBeInTheDocument();
  });

  it("affiche les onglets Envoyer / À réclamer / Auto-dépôt / Bénéficiaires pour UTILISATEUR", async () => {
    mockUtilisateurInit();
    render(<InteracPage />);
    expect(await screen.findByText("Envoyer")).toBeInTheDocument();
    expect(screen.getByText("À réclamer")).toBeInTheDocument();
    expect(screen.getByText("Auto-dépôt")).toBeInTheDocument();
    expect(screen.getByText("Bénéficiaires")).toBeInTheDocument();
  });

  it("n'affiche pas les onglets pour ADMIN (vue globale)", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN", email: "admin@test.com" };
    mockAdminInit({ transferts: [transfertDemo] });
    render(<InteracPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/interac"));
    expect(screen.queryByText("Auto-dépôt")).not.toBeInTheDocument();
  });

  it("affiche les chips de limites globales (24 heures, 7 jours, 30 jours)", async () => {
    mockUtilisateurInit({ limites: limitesGlobales });
    render(<InteracPage />);
    await screen.findByText("Interac e-Transfert");
    expect(screen.getByText("24 heures")).toBeInTheDocument();
    expect(screen.getByText("7 jours")).toBeInTheDocument();
    expect(screen.getByText("30 jours")).toBeInTheDocument();
  });

  it("affiche la limite 24h personnalisee dans le chip", async () => {
    mockUtilisateurInit({ limites: limitesPerso });
    render(<InteracPage />);
    await screen.findByText("Interac e-Transfert");
    // 1 000 $ — toLocaleString fr-CA utilise une espace fine non-sécable
    const chip = screen.getByText("24 heures").closest("div");
    expect(chip).toBeInTheDocument();
  });

  it("appelle GET /interac/limites au montage", async () => {
    mockUtilisateurInit();
    render(<InteracPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/interac/limites"));
  });

  it("affiche le badge 'Actif' sur Auto-dépôt si statut ACTIVE", async () => {
    mockUtilisateurInit({ autoDeposit: autoDepotActif });
    render(<InteracPage />);
    expect(await screen.findByText("Actif")).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════
   Historique des transferts
══════════════════════════════════════════════════════════════ */
describe("InteracPage — historique transferts", () => {
  it("affiche un transfert EN_ATTENTE dans la liste", async () => {
    mockUtilisateurInit({ transferts: [transfertDemo] });
    render(<InteracPage />);
    expect(await screen.findByText("dest@test.com")).toBeInTheDocument();
    // Le badge "En attente" peut apparaître plusieurs fois — getAllByText suffit
    expect(screen.getAllByText("En attente").length).toBeGreaterThan(0);
  });

  it("affiche 'Aucun virement Interac trouvé.' si la liste est vide", async () => {
    mockUtilisateurInit({ transferts: [] });
    render(<InteracPage />);
    expect(await screen.findByText(/Aucun virement Interac trouvé/)).toBeInTheDocument();
  });

  it("affiche les badges de statut ACCEPTEE, ANNULEE, EXPIREE", async () => {
    const acceptee = { ...transfertDemo, id: 2, statut: "ACCEPTEE", email_destinataire: "b@b.com" };
    const annulee  = { ...transfertDemo, id: 3, statut: "ANNULEE",  email_destinataire: "c@c.com" };
    const expiree  = { ...transfertDemo, id: 4, statut: "EXPIREE",  email_destinataire: "d@d.com" };
    mockUtilisateurInit({ transferts: [acceptee, annulee, expiree] });
    render(<InteracPage />);
    expect(await screen.findByText("Acceptée")).toBeInTheDocument();
    expect(screen.getByText("Annulée")).toBeInTheDocument();
    expect(screen.getByText("Expirée")).toBeInTheDocument();
  });

  it("affiche le compteur de lignes dans le header de la table", async () => {
    const acceptee = { ...transfertDemo, id: 2, statut: "ACCEPTEE" };
    mockUtilisateurInit({ transferts: [transfertDemo, acceptee] });
    render(<InteracPage />);
    expect(await screen.findByText("2 lignes")).toBeInTheDocument();
  });

  it("ADMIN affiche la barre de recherche", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN", email: "admin@test.com" };
    mockAdminInit();
    render(<InteracPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/Rechercher par email/)).toBeInTheDocument();
  });

  it("ADMIN lance une recherche", async () => {
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN", email: "admin@test.com" };
    mockAdminInit();
    mockApiGet.mockResolvedValueOnce({ data: [] });
    render(<InteracPage />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/interac"));

    fireEvent.change(screen.getByPlaceholderText(/Rechercher par email/), { target: { value: "alice" } });
    fireEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith("/interac?search=alice")
    );
  });
});

/* ══════════════════════════════════════════════════════════════
   Onglet Envoyer
══════════════════════════════════════════════════════════════ */
describe("InteracPage — onglet Envoyer", () => {
  it("affiche l'ecran vide avec CTA si aucun beneficiaire enregistre", async () => {
    mockUtilisateurInit({ beneficiaires: [] });
    render(<InteracPage />);
    expect(await screen.findByText("Aucun bénéficiaire enregistré")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter un bénéficiaire" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("destinataire@exemple.com")).not.toBeInTheDocument();
  });

  it("le CTA redirige vers l'onglet Beneficiaires", async () => {
    mockUtilisateurInit({ beneficiaires: [] });
    render(<InteracPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ajouter un bénéficiaire" }));
    expect(await screen.findByText("Nouveau destinataire fréquent")).toBeInTheDocument();
  });

  it("affiche le formulaire d'envoi avec les champs requis si des beneficiaires existent", async () => {
    mockUtilisateurInit({ beneficiaires: [beneficiaireDemo] });
    render(<InteracPage />);
    expect(await screen.findByText("Nouveau virement Interac")).toBeInTheDocument();
    // Sélecteur de bénéficiaire obligatoire — pas de champ email libre
    expect(screen.queryByPlaceholderText("destinataire@exemple.com")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("150.00")).toBeInTheDocument();
  });

  it("affiche le beneficiaire dans le select Destinataire", async () => {
    mockUtilisateurInit({ beneficiaires: [beneficiaireDemo] });
    render(<InteracPage />);
    expect(await screen.findByText(/Maman.*maman@test\.com/)).toBeInTheDocument();
  });

  it("affiche le compte dans le select source", async () => {
    mockUtilisateurInit({ beneficiaires: [beneficiaireDemo] });
    render(<InteracPage />);
    expect(await screen.findByText(/CHEQUES.*1234/)).toBeInTheDocument();
  });

  it("envoie un transfert avec succes en selectionnant un beneficiaire", async () => {
    mockUtilisateurInit({ beneficiaires: [beneficiaireDemo] });
    render(<InteracPage />);
    await screen.findByText("Nouveau virement Interac");

    mockApiPost.mockResolvedValueOnce({ message: "Transfert envoyé", statut: "EN_ATTENTE" });
    mockApiGet.mockResolvedValueOnce({ data: [transfertDemo] });
    mockApiGet.mockResolvedValueOnce({ data: [compteDemo] });

    // Premier combobox = sélecteur bénéficiaire
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("150.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/ }));

    expect(await screen.findByText("Transfert envoyé")).toBeInTheDocument();
    expect(mockApiPost).toHaveBeenCalledWith("/interac", expect.objectContaining({
      email_destinataire: "maman@test.com",
      montant: 100,
    }));
  });

  it("affiche une erreur si l'envoi echoue", async () => {
    mockUtilisateurInit({ beneficiaires: [beneficiaireDemo] });
    render(<InteracPage />);
    await screen.findByText("Nouveau virement Interac");

    mockApiPost.mockRejectedValueOnce({ message: "Limite dépassée" });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("150.00"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le virement/ }));

    expect(await screen.findByText("Limite dépassée")).toBeInTheDocument();
  });

  it("le bouton Envoyer est desactive sans beneficiaire selectionne", async () => {
    mockUtilisateurInit({ beneficiaires: [beneficiaireDemo] });
    render(<InteracPage />);
    await screen.findByText("Nouveau virement Interac");
    // Aucun bénéficiaire sélectionné → bouton désactivé
    expect(screen.getByRole("button", { name: /Envoyer le virement/ })).toBeDisabled();
  });

  it("ouvre le modal de confirmation avant d'annuler un transfert", async () => {
    mockUtilisateurInit({ transferts: [{ ...transfertDemo, expediteur_id: 2 }] });
    render(<InteracPage />);
    const annulerBtns = await screen.findAllByRole("button", { name: /Annuler/ });
    // Cliquer le bouton Annuler dans le tableau (pas le retour du modal)
    const annulerDansTableau = annulerBtns.find(b => b.closest("td"));
    fireEvent.click(annulerDansTableau ?? annulerBtns[0]);
    expect(await screen.findByText(/Le montant sera immédiatement remboursé/)).toBeInTheDocument();
  });

  it("annule un transfert via le modal et rafraichit", async () => {
    mockUtilisateurInit({ transferts: [{ ...transfertDemo, expediteur_id: 2 }] });
    render(<InteracPage />);
    const annulerBtns = await screen.findAllByRole("button", { name: /Annuler/ });
    const annulerDansTableau = annulerBtns.find(b => b.closest("td"));
    fireEvent.click(annulerDansTableau ?? annulerBtns[0]);
    await screen.findByText(/Le montant sera immédiatement remboursé/);

    mockApiDelete.mockResolvedValueOnce({ message: "Transfert annulé" });
    mockApiGet.mockResolvedValueOnce({ data: [] });          // loadTransferts
    mockApiGet.mockResolvedValueOnce({ data: [compteDemo] }); // loadComptes

    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'annulation" }));
    expect(await screen.findByText("Transfert annulé")).toBeInTheDocument();
    expect(mockApiDelete).toHaveBeenCalledWith("/interac/1");
  });

  it("ferme le modal d'annulation via Retour", async () => {
    mockUtilisateurInit({ transferts: [{ ...transfertDemo, expediteur_id: 2 }] });
    render(<InteracPage />);
    const annulerBtns = await screen.findAllByRole("button", { name: /Annuler/ });
    const annulerDansTableau = annulerBtns.find(b => b.closest("td"));
    fireEvent.click(annulerDansTableau ?? annulerBtns[0]);
    await screen.findByText(/Le montant sera immédiatement remboursé/);

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    await waitFor(() =>
      expect(screen.queryByText(/Le montant sera immédiatement remboursé/)).not.toBeInTheDocument()
    );
  });

  it("affiche une erreur si l'annulation echoue", async () => {
    mockUtilisateurInit({ transferts: [{ ...transfertDemo, expediteur_id: 2 }] });
    render(<InteracPage />);
    const annulerBtns = await screen.findAllByRole("button", { name: /Annuler/ });
    const annulerDansTableau = annulerBtns.find(b => b.closest("td"));
    fireEvent.click(annulerDansTableau ?? annulerBtns[0]);
    await screen.findByText(/Le montant sera immédiatement remboursé/);

    mockApiDelete.mockRejectedValueOnce({ message: "Impossible d'annuler" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'annulation" }));
    expect(await screen.findByText(/Impossible d'annuler/)).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════
   Onglet À réclamer
══════════════════════════════════════════════════════════════ */
describe("InteracPage — onglet À réclamer", () => {
  it("affiche le badge amber sur le tab quand il y a des transferts a reclamer", async () => {
    mockUtilisateurInit({ aReclamer: [aReclamerDemo] });
    render(<InteracPage />);
    await screen.findByText("Interac e-Transfert");
    // Le badge se trouve dans le bouton tab "À réclamer"
    const tabBtn = screen.getByText("À réclamer").closest("button");
    expect(within(tabBtn).getByText("1")).toBeInTheDocument();
  });

  it("affiche 'Aucun virement en attente de réclamation.' si liste vide", async () => {
    mockUtilisateurInit({ aReclamer: [] });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("À réclamer"));
    expect(await screen.findByText(/Aucun virement en attente de réclamation/)).toBeInTheDocument();
  });

  it("affiche le nom de l'expediteur apres clic sur Réclamer", async () => {
    mockUtilisateurInit({ aReclamer: [aReclamerDemo] });
    render(<InteracPage />);
    // Le clic sur l'onglet déclenche un nouveau loadAReclamer — fournir un mock supplémentaire
    mockApiGet.mockResolvedValueOnce({ data: [aReclamerDemo] });
    fireEvent.click(await screen.findByRole("button", { name: /À réclamer/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Réclamer" }));
    // Le <strong> dans le modal a exactement "Alice Martin" comme textContent
    expect(await screen.findByText("Alice Martin")).toBeInTheDocument();
  });

  it("reclame un transfert sans mot de passe (auto-depot)", async () => {
    mockUtilisateurInit({ aReclamer: [{ ...aReclamerDemo, requiert_mot_de_passe: false }], comptes: [compteDemo] });
    render(<InteracPage />);
    // Le clic sur l'onglet déclenche un nouveau loadAReclamer — fournir un mock supplémentaire
    mockApiGet.mockResolvedValueOnce({ data: [{ ...aReclamerDemo, requiert_mot_de_passe: false }] });
    fireEvent.click(await screen.findByRole("button", { name: /À réclamer/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Réclamer" }));
    await screen.findByText("Alice Martin");

    mockApiPost.mockResolvedValueOnce({ message: "Virement réclamé avec succès" });
    mockApiGet.mockResolvedValueOnce({ data: [] });            // loadAReclamer
    mockApiGet.mockResolvedValueOnce({ data: [transfertDemo] }); // loadTransferts
    mockApiGet.mockResolvedValueOnce({ data: [compteDemo] }); // loadComptes

    // Sans mot de passe requis, le bouton "Confirmer" est disponible directement
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText("Virement réclamé avec succès")).toBeInTheDocument();
  });

  it("affiche une erreur si la reclamation echoue", async () => {
    mockUtilisateurInit({ aReclamer: [{ ...aReclamerDemo, requiert_mot_de_passe: false }], comptes: [compteDemo] });
    render(<InteracPage />);
    // Le clic sur l'onglet déclenche un nouveau loadAReclamer — fournir un mock supplémentaire
    mockApiGet.mockResolvedValueOnce({ data: [{ ...aReclamerDemo, requiert_mot_de_passe: false }] });
    fireEvent.click(await screen.findByRole("button", { name: /À réclamer/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Réclamer" }));
    await screen.findByText("Alice Martin");

    mockApiPost.mockRejectedValueOnce({ message: "Mot de passe invalide" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText("Mot de passe invalide")).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════
   Onglet Auto-dépôt
══════════════════════════════════════════════════════════════ */
describe("InteracPage — onglet Auto-dépôt", () => {
  it("affiche le formulaire d'activation si aucun auto-depot (placeholder votre@courriel.com)", async () => {
    mockUtilisateurInit({ autoDeposit: null });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    expect(await screen.findByPlaceholderText("votre@courriel.com")).toBeInTheDocument();
  });

  it("affiche 'Activer l'auto-dépôt' en titre étape 1", async () => {
    mockUtilisateurInit({ autoDeposit: null });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    expect(await screen.findByText(/Activer l'auto-dépôt/)).toBeInTheDocument();
  });

  it("affiche le profil actif si auto-depot ACTIVE", async () => {
    mockUtilisateurInit({ autoDeposit: autoDepotActif });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    expect(await screen.findByText("Profil actif")).toBeInTheDocument();
    expect(screen.getAllByText("jean@test.com").length).toBeGreaterThan(0);
  });

  it("active directement l'auto-depot via 'Activer' (flow 1 etape)", async () => {
    mockUtilisateurInit({ autoDeposit: null, comptes: [compteDemo] });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));

    mockApiPost.mockResolvedValueOnce({ message: "Auto-dépôt activé", data: autoDepotActif });

    const emailInput = await screen.findByPlaceholderText("votre@courriel.com");
    fireEvent.change(emailInput, { target: { value: "jean@test.com" } });
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /Activer/ }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith("/interac/autodeposit", expect.objectContaining({
        email_interac: "jean@test.com",
      }))
    );
    expect(await screen.findByText("Auto-dépôt activé")).toBeInTheDocument();
  });

  it("affiche une erreur si l'activation echoue", async () => {
    mockUtilisateurInit({ autoDeposit: null, comptes: [compteDemo] });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));

    mockApiPost.mockRejectedValueOnce({ message: "Email déjà utilisé" });
    const emailInput = await screen.findByPlaceholderText("votre@courriel.com");
    fireEvent.change(emailInput, { target: { value: "pris@test.com" } });
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Activer/ }));

    expect(await screen.findByText("Email déjà utilisé")).toBeInTheDocument();
  });

  it("affiche le bouton de desactivation si auto-depot ACTIVE", async () => {
    mockUtilisateurInit({ autoDeposit: autoDepotActif });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    expect(await screen.findByRole("button", { name: "Désactiver" })).toBeInTheDocument();
  });

  it("affiche le modal de confirmation de desactivation", async () => {
    mockUtilisateurInit({ autoDeposit: autoDepotActif });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    fireEvent.click(await screen.findByRole("button", { name: "Désactiver" }));
    expect(await screen.findByText(/Désactiver l'auto-dépôt/)).toBeInTheDocument();
  });

  it("desactive l'auto-depot apres confirmation dans le modal", async () => {
    mockUtilisateurInit({ autoDeposit: autoDepotActif });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    fireEvent.click(await screen.findByRole("button", { name: "Désactiver" }));
    await screen.findByText(/Désactiver l'auto-dépôt/);

    mockApiDelete.mockResolvedValueOnce({ message: "Auto-dépôt désactivé" });
    // Dans le modal, le bouton "Désactiver" confirme l'action
    const modalBtns = screen.getAllByRole("button", { name: "Désactiver" });
    // Le dernier bouton "Désactiver" est dans le modal
    fireEvent.click(modalBtns[modalBtns.length - 1]);

    expect(await screen.findByText("Auto-dépôt désactivé")).toBeInTheDocument();
    expect(mockApiDelete).toHaveBeenCalledWith("/interac/autodeposit");
  });

  it("annule la desactivation via le bouton Annuler du modal", async () => {
    mockUtilisateurInit({ autoDeposit: autoDepotActif });
    render(<InteracPage />);
    fireEvent.click(await screen.findByText("Auto-dépôt"));
    fireEvent.click(await screen.findByRole("button", { name: "Désactiver" }));
    await screen.findByText(/Désactiver l'auto-dépôt/);

    // Annuler dans le modal (le premier "Annuler" dans le DOM est dans le modal de désactivation,
    // avant le bouton "Annuler" du tableau historique)
    const annulerBtns = screen.getAllByRole("button", { name: "Annuler" });
    fireEvent.click(annulerBtns[0]);

    await waitFor(() =>
      expect(screen.queryByText(/Les futurs virements envoyés/)).not.toBeInTheDocument()
    );
  });
});

/* ══════════════════════════════════════════════════════════════
   Gestion des erreurs réseau
══════════════════════════════════════════════════════════════ */
describe("InteracPage — erreurs réseau", () => {
  it("affiche une erreur si GET /interac echoue", async () => {
    mockApiGet
      .mockRejectedValueOnce({ message: "Erreur réseau" }) // /interac
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: limitesGlobales });
    render(<InteracPage />);
    expect(await screen.findByText("Erreur réseau")).toBeInTheDocument();
  });

  it("continue si GET /interac/limites echoue (garde les defauts)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [compteDemo] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: null })
      .mockRejectedValueOnce({ message: "db fail" }); // /limites échoue → silencieux
    render(<InteracPage />);
    expect(await screen.findByText("Interac e-Transfert")).toBeInTheDocument();
    expect(screen.getByText("Envoyer")).toBeInTheDocument();
  });
});
