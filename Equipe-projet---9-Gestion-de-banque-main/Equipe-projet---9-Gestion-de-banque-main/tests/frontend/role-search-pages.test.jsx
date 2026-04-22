import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClientsPage from "../../frontend/src/app/dashboard/clients/page";

const mockApiGet = jest.fn();
let mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

jest.mock("@/lib/api", () => ({
  apiGet: (...args) => mockApiGet(...args),
}));

describe("Role search pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 1, prenom: "Admin", nom: "Config", role: "ADMIN" };
  });

  it("affiche la recherche globale des clients pour un admin", async () => {
    // 1. loadClients("") → /clients, 2. useEffect selectedClientId → /clients/1/comptes
    // 3. loadClients("Emma") → /clients?search=Emma, 4. useEffect selectedClientId → /clients/2/comptes
    mockApiGet
      .mockResolvedValueOnce({
        data: [{ id: 1, prenom: "Sarah", nom: "Clark", email_fictif: "sarah@Leon.local", ville: "Montreal" }],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ id: 2, prenom: "Emma", nom: "Gagnon", email_fictif: "emma@Leon.local", ville: "Laval" }],
      })
      .mockResolvedValueOnce({ data: [] });

    render(<ClientsPage />);

    // Le champ de recherche est un Input sans label prop — on le cible par role
    const searchInput = await screen.findByRole("textbox");
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Emma" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/clients?search=Emma");
    });
  });

  it("n'affiche pas la recherche clients pour un utilisateur classique", async () => {
    mockUser = { id: 2, prenom: "User", nom: "Demo", role: "UTILISATEUR" };
    // ClientView (UTILISATEUR) appelle /comptes, pas /clients
    mockApiGet.mockResolvedValueOnce({ data: [] });

    render(<ClientsPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/comptes");
    });

    // ClientView n'a pas de champ de recherche
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("affiche la recherche globale des clients pour un moderateur", async () => {
    mockUser = { id: 3, prenom: "Mila", nom: "Stone", role: "MODERATEUR" };
    // ElevatedView recherche les clients, pas les comptes directement
    mockApiGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [] });

    render(<ClientsPage />);

    // Le champ de recherche est un Input sans label prop — on le cible par role
    const searchInput = await screen.findByRole("textbox");
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Clark" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/clients?search=Clark");
    });
  });
});
