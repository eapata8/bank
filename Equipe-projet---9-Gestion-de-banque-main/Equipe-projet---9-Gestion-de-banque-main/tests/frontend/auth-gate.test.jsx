import { jest } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AuthGate from "../../frontend/src/components/AuthGate";

const mockPush = jest.fn();
const mockRefreshMe = jest.fn();

let mockAuthState = {
  user: null,
  loading: false,
  refreshMe: mockRefreshMe,
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("AuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche un loader pendant la verification", () => {
    mockRefreshMe.mockReturnValue(new Promise(() => {}));

    render(
      <AuthGate>
        <div>Contenu protege</div>
      </AuthGate>
    );

    expect(screen.getByText("Vérification de la session…")).toBeInTheDocument();
  });

  it("redirige vers /login si aucun utilisateur n'est connecte", async () => {
    mockRefreshMe.mockResolvedValue(null);
    mockAuthState = { user: null, loading: false, refreshMe: mockRefreshMe };

    render(
      <AuthGate>
        <div>Contenu protege</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("affiche le contenu si un utilisateur est connecte", async () => {
    mockRefreshMe.mockResolvedValue({ id: 1 });
    mockAuthState = {
      user: { id: 1, prenom: "User", nom: "Demo" },
      loading: false,
      refreshMe: mockRefreshMe,
    };

    render(
      <AuthGate>
        <div>Contenu protege</div>
      </AuthGate>
    );

    expect(await screen.findByText("Contenu protege")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
