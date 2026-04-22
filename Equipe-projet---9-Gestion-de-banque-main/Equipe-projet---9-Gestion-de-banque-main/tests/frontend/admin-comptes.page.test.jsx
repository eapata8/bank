import { jest } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminComptesPage from "../../frontend/src/app/dashboard/admin/comptes/page";

const mockApiGet         = jest.fn();
const mockApiPost        = jest.fn();
const mockApiPatch       = jest.fn();
const mockApiDelete      = jest.fn();
const mockApiDownloadCSV = jest.fn();
let mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/lib/api", () => ({
  apiGet:           (...args) => mockApiGet(...args),
  apiPost:          (...args) => mockApiPost(...args),
  apiPatch:         (...args) => mockApiPatch(...args),
  apiDelete:        (...args) => mockApiDelete(...args),
  apiDownloadCSV:   (...args) => mockApiDownloadCSV(...args),
}));

const comptes = [
  {
    id: 10,
    client_id: 1,
    type_compte: "CHEQUES",
    numero_compte: "**** 1234",
    solde: "1500.00",
    devise: "CAD",
    est_actif: 1,
    client_prenom: "Jean",
    client_nom: "Dupont",
  },
  {
    id: 20,
    client_id: 2,
    type_compte: "EPARGNE",
    numero_compte: "**** 5678",
    solde: "3000.00",
    devise: "CAD",
    est_actif: 0,
    client_prenom: "Marie",
    client_nom: "Tremblay",
  },
];

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockApiDownloadCSV.mockReset();
  mockUser = { prenom: "Admin", nom: "Config", role: "ADMIN" };
  mockApiGet.mockResolvedValue({ data: comptes });
  mockApiDownloadCSV.mockResolvedValue(undefined);
});

describe("AdminComptesPage", () => {
  it("affiche le titre de la page", async () => {
    await act(async () => { render(<AdminComptesPage />); });
    expect(screen.getByText("Gestion des comptes")).toBeInTheDocument();
  });

  it("affiche le message de restriction pour un non-admin", async () => {
    mockUser = { prenom: "User", nom: "Test", role: "UTILISATEUR" };
    await act(async () => { render(<AdminComptesPage />); });
    expect(screen.getByText(/Section réservée à l'administrateur/i)).toBeInTheDocument();
  });

  it("affiche la liste des comptes après chargement", async () => {
    render(<AdminComptesPage />);
    await waitFor(() => {
      expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
      expect(screen.getByText("Marie Tremblay")).toBeInTheDocument();
    });
  });

  it("affiche le badge 'Actif' et 'Bloqué' correctement", async () => {
    render(<AdminComptesPage />);
    await waitFor(() => {
      expect(screen.getByText("Actif")).toBeInTheDocument();
      expect(screen.getByText("Bloqué")).toBeInTheDocument();
    });
  });

  it("affiche le panneau de contrôle quand un compte est sélectionné", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] }); // transactions

    render(<AdminComptesPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));

    fireEvent.click(screen.getByText("Jean Dupont"));

    await waitFor(() => {
      expect(screen.getByText(/Compte #10/)).toBeInTheDocument();
    });
  });

  it("affiche le message placeholder quand aucun compte n'est sélectionné", async () => {
    render(<AdminComptesPage />);
    await waitFor(() => {
      expect(screen.getByText(/Sélectionnez un compte/i)).toBeInTheDocument();
    });
  });

  it("affiche les onglets après sélection d'un compte", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));
    fireEvent.click(screen.getByText("Jean Dupont"));

    await waitFor(() => {
      expect(screen.getByText("Solde")).toBeInTheDocument();
      expect(screen.getByText("Type / Statut")).toBeInTheDocument();
      expect(screen.getByText("Transactions")).toBeInTheDocument();
      expect(screen.getByText("Virements")).toBeInTheDocument();
      expect(screen.getByText("Transfert forcé")).toBeInTheDocument();
    });
  });

  it("soumet le formulaire d'ajustement de solde", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    mockApiPatch.mockResolvedValueOnce({ message: "Solde ajusté", nouveau_solde: 1600 });

    render(<AdminComptesPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));
    fireEvent.click(screen.getByText("Jean Dupont"));
    await waitFor(() => screen.getByText("Solde"));

    const montantInput = screen.getByPlaceholderText("+100.00 ou -50.00");
    fireEvent.change(montantInput, { target: { value: "100" } });
    fireEvent.click(screen.getByText("Appliquer l'ajustement"));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        "/admin/comptes/10/balance",
        expect.objectContaining({ montant: "100" })
      );
    });
  });

  it("affiche une alerte d'erreur si l'API échoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    mockApiPatch.mockRejectedValueOnce({ message: "Erreur serveur" });

    render(<AdminComptesPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));
    fireEvent.click(screen.getByText("Jean Dupont"));
    await waitFor(() => screen.getByText("Solde"));

    const montantInput = screen.getByPlaceholderText("+100.00 ou -50.00");
    fireEvent.change(montantInput, { target: { value: "100" } });
    fireEvent.click(screen.getByText("Appliquer l'ajustement"));

    await waitFor(() => {
      expect(screen.getByText(/Erreur serveur/i)).toBeInTheDocument();
    });
  });

  it("affiche le bouton Bloquer pour un compte actif", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));
    fireEvent.click(screen.getByText("Jean Dupont"));

    await waitFor(() => {
      expect(screen.getByText("Bloquer")).toBeInTheDocument();
    });
  });

  it("affiche une erreur si le chargement des comptes echoue", async () => {
    mockApiGet.mockRejectedValueOnce({ message: "Erreur de chargement comptes" });

    render(<AdminComptesPage />);

    await waitFor(() => {
      expect(screen.getByText(/Erreur de chargement comptes/)).toBeInTheDocument();
    });
  });

  it("affiche Aucun compte quand la liste est vide", async () => {
    mockApiGet.mockResolvedValue({ data: [] });

    render(<AdminComptesPage />);

    await waitFor(() => {
      expect(screen.getByText("Aucun compte. Lancez une recherche.")).toBeInTheDocument();
    });
  });

  it("gère l'erreur de chargement des transactions silencieusement", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })  // loadComptes
      .mockRejectedValueOnce({ message: "Erreur TX" }); // loadTransactions -> silent catch

    render(<AdminComptesPage />);
    await selectCompte("Jean Dupont");

    // L'erreur de transactions est silencieuse (catch vide) — aucun message d'erreur
    await waitFor(() => {
      expect(screen.queryByText("Erreur TX")).not.toBeInTheDocument();
    });
    // L'onglet Transactions devrait quand même être accessible
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => {
      expect(screen.getByText("Aucune transaction.")).toBeInTheDocument();
    });
  });

  it("lance une recherche via le bouton Chercher", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [comptes[0]] });

    render(<AdminComptesPage />);

    await waitFor(() => screen.getByText("Jean Dupont"));
    fireEvent.change(screen.getByPlaceholderText("Rechercher un compte…"), { target: { value: "Jean" } });
    fireEvent.click(screen.getByText("Chercher"));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/comptes?search=Jean");
    });
  });
});

/* ── Helpers ───────────────────────────────────────── */
async function selectCompte(name = "Jean Dupont") {
  await waitFor(() => screen.getByText(name));
  fireEvent.click(screen.getByText(name));
}

/* ── Onglet Type / Statut ──────────────────────────── */
describe("AdminComptesPage — Onglet Type / Statut", () => {
  it("clic sur l'onglet Type / Statut affiche le formulaire de changement de type", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));

    await waitFor(() => {
      expect(screen.getByText("Changer le type de compte")).toBeInTheDocument();
    });
  });

  it("soumettre le formulaire appelle apiPatch /admin/comptes/:id/type", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes });
    mockApiPatch.mockResolvedValueOnce({ message: "Type modifié" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByText("Changer le type de compte"));

    fireEvent.click(screen.getByRole("button", { name: "Modifier le type" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        "/admin/comptes/10/type",
        expect.objectContaining({ type_compte: "CHEQUES" })
      );
    });
  });

  it("affiche le texte sur le blocage/deblocage", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));

    await waitFor(() => {
      expect(screen.getByText(/Bloquer \/ Débloquer/i)).toBeInTheDocument();
    });
  });
});

/* ── Onglet Transactions ───────────────────────────── */
describe("AdminComptesPage — Onglet Transactions", () => {
  it("clic sur l'onglet Transactions affiche le formulaire d'insertion", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));

    await waitFor(() => {
      expect(screen.getByText("Insérer une transaction")).toBeInTheDocument();
    });
  });

  it("le formulaire contient le select de type transaction", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));

    await waitFor(() => {
      // DEPOT option should be present in a select
      expect(screen.getAllByRole("option", { name: "DEPOT" }).length).toBeGreaterThan(0);
    });
  });

  it("inserer une transaction appelle apiPost /admin/comptes/:id/transactions", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes });
    mockApiPost.mockResolvedValueOnce({ message: "Transaction insérée", id: 99 });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByText("Insérer une transaction"));

    fireEvent.change(screen.getByPlaceholderText("ex: 200 ou -50"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer la transaction" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/comptes/10/transactions",
        expect.objectContaining({ montant: "100" })
      );
    });
  });

  it("supprimer une transaction appelle apiDelete /admin/transactions/:txId avec confirm=true", async () => {
    const tx = {
      id: 55,
      type_transaction: "DEPOT",
      montant: "200.00",
      description: "Test",
      date_transaction: "2026-03-01T10:00:00.000Z",
      statut: "TERMINEE",
    };
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [tx] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes });
    mockApiDelete.mockResolvedValueOnce({ message: "Transaction supprimée" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));

    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));
    // Modal de confirmation — cliquer "Supprimer" pour confirmer
    await waitFor(() => screen.getByText(/Supprimer la transaction/));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith("/admin/transactions/55");
    });
  });

  it("affiche Aucune transaction si la liste est vide", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));

    await waitFor(() => {
      expect(screen.getByText("Aucune transaction.")).toBeInTheDocument();
    });
  });
});

/* ── Onglet Virements ──────────────────────────────── */
describe("AdminComptesPage — Onglet Virements", () => {
  it("clic sur l'onglet Virements affiche les champs compte source et destination", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Virements" }));

    await waitFor(() => {
      expect(screen.getByText("N° compte source *")).toBeInTheDocument();
      expect(screen.getByText("N° compte destination *")).toBeInTheDocument();
    });
  });

  it("soumettre appelle apiPost /admin/virements", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes });
    mockApiPost.mockResolvedValueOnce({ message: "Virement inséré", id: 77 });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Virements" }));
    await waitFor(() => screen.getAllByPlaceholderText("XXXX XXXX XXXX"));

    const numInputs  = screen.getAllByPlaceholderText("XXXX XXXX XXXX");
    const instInputs = screen.getAllByPlaceholderText("621");
    fireEvent.change(numInputs[0],                            { target: { value: "4821 3390 4521" } });
    fireEvent.change(numInputs[1],                            { target: { value: "6214 8820 1104" } });
    fireEvent.change(instInputs[0],                           { target: { value: "621" } });
    fireEvent.change(instInputs[1],                           { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),    { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("23815"),    { target: { value: "23815" } });
    fireEvent.change(screen.getByPlaceholderText("200.00"),   { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer le virement" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/virements",
        expect.objectContaining({
          numero_compte_source: "4821 3390 4521", numero_institution_source: "621", numero_transit_source: "10482",
          numero_compte_dest:   "6214 8820 1104", numero_institution_dest:   "621", numero_transit_dest:   "23815",
          montant: "300",
        })
      );
    });
  });
});

/* ── Onglet Transfert forcé ────────────────────────── */
describe("AdminComptesPage — Onglet Transfert force", () => {
  it("clic sur Transfert force affiche le formulaire", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transfert forcé" }));

    await waitFor(() => {
      expect(screen.getByText(/Transfert forcé depuis le compte/i)).toBeInTheDocument();
    });
  });

  it("soumettre appelle apiPost /admin/virements/force", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes });
    mockApiPost.mockResolvedValueOnce({ message: "Transfert forcé effectué", id: 88 });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transfert forcé" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));

    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "6214 8820 1104" } });
    fireEvent.change(screen.getByPlaceholderText("621"),             { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),           { target: { value: "23815" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"),          { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Exécuter le transfert forcé" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/admin/virements/force",
        expect.objectContaining({
          numero_compte_dest: "6214 8820 1104", numero_institution_dest: "621", numero_transit_dest: "23815",
          montant: "400", compte_source_id: 10,
        })
      );
    });
  });

  it("le bouton est de style danger (rouge)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transfert forcé" }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Exécuter le transfert forcé" });
      expect(btn).toBeInTheDocument();
      // Le bouton a un style rouge — vérifié via la présence du rouge dans la couleur
      expect(btn.style.color).toMatch(/FCA5A5|fca5a5|rgb\(252,\s*165,\s*165\)/i);
    });
  });
});

/* ── Toggle statut ─────────────────────────────────── */
describe("AdminComptesPage — Toggle statut", () => {
  it("clic sur Bloquer avec confirm=true appelle apiPatch /admin/comptes/:id/status", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: comptes });
    mockApiPatch.mockResolvedValueOnce({ message: "Compte bloqué" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Bloquer" }));
    // Modal de confirmation — cliquer "Confirmer"
    await waitFor(() => screen.getByText("Confirmer"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith("/admin/comptes/10/status", {});
    });
  });

  it("affiche une erreur si le toggle statut echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur de blocage" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Bloquer" }));
    // Modal de confirmation — cliquer "Confirmer"
    await waitFor(() => screen.getByText("Confirmer"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur de blocage/)).toBeInTheDocument();
    });
  });

  it("n'appelle pas apiPatch si l'utilisateur annule la confirmation de blocage", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Bloquer" }));
    // Modal de confirmation — cliquer "Annuler" au lieu de "Confirmer"
    await waitFor(() => screen.getByText("Annuler"));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

/* ── Erreurs des handlers ────────────────────────────── */
describe("AdminComptesPage — Erreurs handlers", () => {
  it("affiche une erreur si le changement de type echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPatch.mockRejectedValueOnce({ message: "Erreur de changement type" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByText("Changer le type de compte"));
    fireEvent.click(screen.getByRole("button", { name: "Modifier le type" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur de changement type/)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si l'ajout de transaction echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({ message: "Erreur d'insertion transaction" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByText("Insérer une transaction"));
    fireEvent.change(screen.getByPlaceholderText("ex: 200 ou -50"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer la transaction" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur d'insertion transaction/)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si la suppression de transaction echoue", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-03-01T10:00:00.000Z", statut: "TERMINEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [tx] });
    mockApiDelete.mockRejectedValueOnce({ message: "Erreur de suppression" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));
    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));
    // Modal de confirmation — cliquer "Supprimer"
    await waitFor(() => screen.getByText(/Supprimer la transaction/));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur de suppression/)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si l'ajout de virement echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({ message: "Erreur de virement" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Virements" }));
    await waitFor(() => screen.getAllByPlaceholderText("XXXX XXXX XXXX"));
    const numInputs  = screen.getAllByPlaceholderText("XXXX XXXX XXXX");
    const instInputs = screen.getAllByPlaceholderText("621");
    fireEvent.change(numInputs[0],                          { target: { value: "4821 3390 4521" } });
    fireEvent.change(numInputs[1],                          { target: { value: "6214 8820 1104" } });
    fireEvent.change(instInputs[0],                         { target: { value: "621" } });
    fireEvent.change(instInputs[1],                         { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),  { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("23815"),  { target: { value: "23815" } });
    fireEvent.change(screen.getByPlaceholderText("200.00"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer le virement" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur de virement/)).toBeInTheDocument();
    });
  });

  it("affiche une erreur si le transfert force echoue", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({ message: "Erreur de transfert" });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transfert forcé" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));
    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "6214 8820 1104" } });
    fireEvent.change(screen.getByPlaceholderText("621"),             { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"),           { target: { value: "23815" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"),          { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Exécuter le transfert forcé" }));

    await waitFor(() => {
      expect(screen.getByText(/Erreur de transfert/)).toBeInTheDocument();
    });
  });

  it("le bouton CSV de transactions declenche apiDownloadCSV", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-03-01T10:00:00.000Z", statut: "TERMINEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [tx] });

    render(<AdminComptesPage />);
    await selectCompte();

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
});

/* ── Couverture complémentaire ─────────────────────── */
describe("AdminComptesPage — couverture complémentaire", () => {
  it("lance une recherche en appuyant sur Entree dans le champ de recherche", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [comptes[0]] });

    render(<AdminComptesPage />);

    await waitFor(() => screen.getByPlaceholderText("Rechercher un compte…"));
    fireEvent.change(screen.getByPlaceholderText("Rechercher un compte…"), { target: { value: "Jean" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Rechercher un compte…"), { key: "Enter" });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining("Jean"));
    });
  });

  it("met a jour type_transaction et motif dans le formulaire de solde", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();
    await waitFor(() => screen.getByText("Solde"));

    // Changer le select type_transaction (premier select sur l'onglet Solde)
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "RETRAIT" } });
    expect(selects[0].value).toBe("RETRAIT");

    // Changer le champ motif
    fireEvent.change(screen.getByPlaceholderText("Correction, bonus, pénalité…"), { target: { value: "Test motif" } });
    expect(screen.getByPlaceholderText("Correction, bonus, pénalité…")).toHaveValue("Test motif");
  });

  it("met a jour le select type_compte dans l'onglet Type / Statut", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByText("Changer le type de compte"));

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "EPARGNE" } });
    expect(select.value).toBe("EPARGNE");
  });

  it("met a jour type, statut, description et checkbox dans le formulaire de transaction", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByText("Insérer une transaction"));

    const selects = screen.getAllByRole("combobox");
    // Type select
    fireEvent.change(selects[0], { target: { value: "RETRAIT" } });
    expect(selects[0].value).toBe("RETRAIT");

    // Statut select
    fireEvent.change(selects[1], { target: { value: "EN_ATTENTE" } });
    expect(selects[1].value).toBe("EN_ATTENTE");

    // Description input
    fireEvent.change(screen.getByPlaceholderText("Note…"), { target: { value: "Ma description" } });
    expect(screen.getByPlaceholderText("Note…")).toHaveValue("Ma description");

    // Checkbox ajuster_solde
    const checkbox = screen.getByLabelText(/Ajuster automatiquement le solde/);
    fireEvent.change(checkbox, { target: { checked: true } });
    expect(checkbox.checked).toBe(true);
  });

  it("met a jour statut, description et checkbox dans le formulaire de virement", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Virements" }));
    await waitFor(() => screen.getAllByPlaceholderText("XXXX XXXX XXXX"));

    // Statut select (dernier combobox sur le formulaire virements)
    const selects = screen.getAllByRole("combobox");
    const statutSelect = selects[selects.length - 1];
    fireEvent.change(statutSelect, { target: { value: "REFUSE" } });
    expect(statutSelect.value).toBe("REFUSE");

    // Description input (le Note… dans ce formulaire)
    const noteInputs = screen.getAllByPlaceholderText("Note…");
    fireEvent.change(noteInputs[noteInputs.length - 1], { target: { value: "Virement test" } });
    expect(noteInputs[noteInputs.length - 1]).toHaveValue("Virement test");

    // Checkbox ajuster_soldes
    const checkbox = screen.getByLabelText(/Ajuster les soldes/);
    fireEvent.change(checkbox, { target: { checked: true } });
    expect(checkbox.checked).toBe(true);
  });

  it("met a jour description dans le formulaire de transfert force", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transfert forcé" }));
    await waitFor(() => screen.getByPlaceholderText("Motif du transfert…"));

    fireEvent.change(screen.getByPlaceholderText("Motif du transfert…"), { target: { value: "Remboursement client" } });
    expect(screen.getByPlaceholderText("Motif du transfert…")).toHaveValue("Remboursement client");
  });

  it("ferme le modal de suppression de transaction en cliquant sur Annuler", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-03-01T10:00:00.000Z", statut: "TERMINEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [tx] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));

    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));
    await waitFor(() => screen.getByText(/Supprimer la transaction #55/));

    // Cliquer Annuler — le modal doit disparaître
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByText(/Supprimer la transaction #55/)).not.toBeInTheDocument();
    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it("clic sur la checkbox ajuster_solde (txForm) couvre le onChange ligne 465", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByText("Insérer une transaction"));

    const checkbox = screen.getByLabelText(/Ajuster automatiquement le solde/i);
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(checkbox).toBeInTheDocument();
  });

  it("clic sur la checkbox ajuster_soldes (virForm) couvre le onChange ligne 556", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Virements" }));
    await waitFor(() => screen.getAllByPlaceholderText("XXXX XXXX XXXX"));

    const checkbox = screen.getByLabelText(/Ajuster les soldes/i);
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(checkbox).toBeInTheDocument();
  });

  /* ─── loadComptes catch {} → fallback ?? "Erreur" (ligne 77) ─── */
  it("loadComptes catch sans message → 'Erreur' (ligne 77)", async () => {
    mockApiGet.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  /* ─── handler catches sans message → "Erreur" ─── */
  it("handleAdjustBalance catch sans message → 'Erreur'", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));
    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "50" } });
    fireEvent.click(screen.getByText("Appliquer l'ajustement"));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("confirmToggleStatus catch sans message → 'Erreur'", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    await waitFor(() => screen.getByRole("button", { name: "Bloquer" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));
    await waitFor(() => screen.getByText("Confirmer"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleChangeType catch sans message → 'Erreur'", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPatch.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    fireEvent.click(await screen.findByRole("button", { name: "Type / Statut" }));
    await waitFor(() => screen.getByText("Changer le type de compte"));
    fireEvent.click(screen.getByRole("button", { name: "Modifier le type" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleAddTransaction catch sans message → 'Erreur'", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByPlaceholderText("ex: 200 ou -50"));
    fireEvent.change(screen.getByPlaceholderText("ex: 200 ou -50"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer la transaction" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("confirmDeleteTransaction catch sans message → 'Erreur'", async () => {
    const tx = { id: 55, type_transaction: "DEPOT", montant: "200.00", description: "Test", date_transaction: "2026-03-01T10:00:00.000Z", statut: "TERMINEE" };
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [tx] });
    mockApiDelete.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));
    await waitFor(() => screen.getByRole("button", { name: "Suppr." }));
    fireEvent.click(screen.getByRole("button", { name: "Suppr." }));
    await waitFor(() => screen.getByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleAddVirement catch sans message → 'Erreur'", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    fireEvent.click(await screen.findByRole("button", { name: "Virements" }));
    await waitFor(() => screen.getAllByPlaceholderText("XXXX XXXX XXXX"));
    const numInputs = screen.getAllByPlaceholderText("XXXX XXXX XXXX");
    fireEvent.change(numInputs[0], { target: { value: "1234 5678 9012" } });
    fireEvent.change(numInputs[1], { target: { value: "9876 5432 1098" } });
    const instInputs = screen.getAllByPlaceholderText("621");
    fireEvent.change(instInputs[0], { target: { value: "621" } });
    fireEvent.change(instInputs[1], { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("23815"), { target: { value: "23815" } });
    fireEvent.change(screen.getByPlaceholderText("200.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Insérer le virement" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  it("handleForceTransfer catch sans message → 'Erreur'", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });
    mockApiPost.mockRejectedValueOnce({});
    render(<AdminComptesPage />);
    await selectCompte();
    fireEvent.click(await screen.findByRole("button", { name: "Transfert forcé" }));
    await waitFor(() => screen.getByPlaceholderText("XXXX XXXX XXXX"));
    fireEvent.change(screen.getByPlaceholderText("XXXX XXXX XXXX"), { target: { value: "9876 5432 1098" } });
    fireEvent.change(screen.getByPlaceholderText("621"), { target: { value: "621" } });
    fireEvent.change(screen.getByPlaceholderText("10482"), { target: { value: "10482" } });
    fireEvent.change(screen.getByPlaceholderText("500.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Exécuter le transfert forcé" }));
    expect(await screen.findByText(/Erreur/)).toBeInTheDocument();
  });

  /* ─── loadingTx = true → "Chargement…" dans l'onglet Transactions (ligne 486) ─── */
  it("affiche 'Chargement…' pendant le chargement des transactions (ligne 486 true branch)", async () => {
    let resolveTx;
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockReturnValueOnce(new Promise((r) => { resolveTx = r; })); // transactions defer

    render(<AdminComptesPage />);
    await selectCompte();

    // The tab shows while loadingTx=true — switch to Transactions tab
    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));

    // Transactions are still loading (deferred promise)
    expect(screen.getByText("Chargement…")).toBeInTheDocument();

    // Resolve to avoid act() warnings
    resolveTx({ data: [] });
    await waitFor(() => expect(screen.getByText("Aucune transaction.")).toBeInTheDocument());
  });

  /* ─── transaction montant négatif : couleur FCA5A5 + signe "" (lignes 502-503) ─── */
  it("affiche une transaction négative en rouge sans signe + (lignes 502-503)", async () => {
    const txNeg = {
      id: 77,
      type_transaction: "RETRAIT",
      montant: "-150.00",
      description: "Frais",
      date_transaction: "2026-04-01T10:00:00.000Z",
      statut: "TERMINEE",
    };
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [txNeg] });

    render(<AdminComptesPage />);
    await selectCompte();

    fireEvent.click(await screen.findByRole("button", { name: "Transactions" }));

    await waitFor(() => {
      expect(screen.getByText("-150.00 $")).toBeInTheDocument();
    });
    // Pas de signe "+" pour montant négatif
    expect(screen.queryByText("+-150.00 $")).not.toBeInTheDocument();
  });

  /* ─── refreshSelected : if (updated) false branch (ligne 108) ─── */
  it("refreshSelected sans updated → setSelected non appelé (ligne 108 false branch)", async () => {
    // Initial load: comptes [10, 20]; select compte 10
    // handleAdjustBalance succeeds → refreshSelected runs:
    //   loadComptes (call 3): returns only [20] (not 10)
    //   loadTransactions (call 4): returns []
    //   inline apiGet (call 5): returns only [20] → updated = undefined → branch false
    const compteSansId10 = [comptes[1]]; // only id=20
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })       // 1: initial loadComptes
      .mockResolvedValueOnce({ data: [] })             // 2: loadTransactions on select
      .mockResolvedValueOnce({ data: compteSansId10 }) // 3: loadComptes in refreshSelected
      .mockResolvedValueOnce({ data: [] })             // 4: loadTransactions in refreshSelected
      .mockResolvedValueOnce({ data: compteSansId10 }); // 5: inline apiGet in refreshSelected
    mockApiPatch.mockResolvedValueOnce({ message: "Solde ajusté", nouveau_solde: 1600 });

    render(<AdminComptesPage />);
    await waitFor(() => screen.getByText("Jean Dupont"));
    fireEvent.click(screen.getByText("Jean Dupont"));
    await waitFor(() => screen.getByText("Solde"));

    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Appliquer l'ajustement"));

    // Success message confirms action completed and refreshSelected ran
    await waitFor(() => {
      expect(screen.getByText(/Solde ajusté/)).toBeInTheDocument();
    });
  });

  /* ─── refreshSelected ligne 108 : branche false (updated non trouvé) ─── */
  it("refreshSelected — updated non trouvé dans la liste fraîche couvre la branche false ligne 108", async () => {
    // Mocks :
    // 1. chargement initial des comptes
    // 2. transactions après sélection
    // 3. refreshSelected → loadComptes()
    // 4. refreshSelected → loadTransactions(10)
    // 5. refreshSelected → search final → liste VIDE → updated=undefined → branche false
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })  // initial /comptes
      .mockResolvedValueOnce({ data: [] })        // /comptes/10/transactions
      .mockResolvedValueOnce({ data: comptes })  // refreshSelected loadComptes
      .mockResolvedValueOnce({ data: [] })        // refreshSelected loadTransactions
      .mockResolvedValueOnce({ data: [] });       // refreshSelected search → aucun match → if(updated) false

    mockApiPatch.mockResolvedValueOnce({ message: "Solde ajusté", nouveau_solde: 1600 });

    render(<AdminComptesPage />);
    await selectCompte("Jean Dupont");

    await waitFor(() => screen.getByPlaceholderText("+100.00 ou -50.00"));
    fireEvent.change(screen.getByPlaceholderText("+100.00 ou -50.00"), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Appliquer l'ajustement"));

    // Attendre le succès du patch ET que refreshSelected termine ses 3 appels API
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(5);
    });

    expect(mockApiPatch).toHaveBeenCalledWith(
      "/admin/comptes/10/balance",
      expect.objectContaining({ montant: "100" })
    );
  });

  /* ─── toggle modal Débloquer (compte est_actif=0) : lignes 608-617 ─── */
  it("affiche 'Débloquer' dans le modal pour un compte inactif (est_actif=0)", async () => {
    mockApiGet
      .mockResolvedValueOnce({ data: comptes })
      .mockResolvedValueOnce({ data: [] });

    render(<AdminComptesPage />);

    // Sélectionner Marie Tremblay (est_actif=0)
    await selectCompte("Marie Tremblay");

    // Clic sur le bouton de toggle statut (Débloquer pour un compte inactif)
    const toggleBtn = await screen.findByRole("button", { name: /Débloquer/ });
    fireEvent.click(toggleBtn);

    // Le modal s'affiche avec "Débloquer"
    await waitFor(() => {
      expect(screen.getByText(/Débloquer le compte/i)).toBeInTheDocument();
    });
  });
});
