import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../../frontend/src/context/AuthContext";

const mockApiGet      = jest.fn();
const mockApiPostVoid = jest.fn();

jest.mock("@/lib/api", () => ({
  apiGet:      (...args) => mockApiGet(...args),
  apiPostVoid: (...args) => mockApiPostVoid(...args),
}));

/* Composant de test qui consomme useAuth */
function Consumer() {
  const { user, loading, refreshMe, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? `${user.prenom} ${user.nom}` : "null"}</span>
      <span data-testid="loading">{loading ? "loading" : "idle"}</span>
      <button onClick={refreshMe}>refresh</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe("AuthContext — AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("expose user=null et loading=false à l'initialisation", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    expect(screen.getByTestId("user")).toHaveTextContent("null");
    expect(screen.getByTestId("loading")).toHaveTextContent("idle");
  });

  it("refreshMe : met à jour user si l'API retourne un utilisateur", async () => {
    mockApiGet.mockResolvedValueOnce({ user: { prenom: "Jean", nom: "Dupont" } });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("Jean Dupont");
    });
    expect(mockApiGet).toHaveBeenCalledWith("/auth/me");
    expect(screen.getByTestId("loading")).toHaveTextContent("idle");
  });

  it("refreshMe : met user=null et loading=false quand l'API échoue (branche catch)", async () => {
    mockApiGet.mockRejectedValueOnce({ message: "Non autorisé" });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("null");
      expect(screen.getByTestId("loading")).toHaveTextContent("idle");
    });
  });

  it("refreshMe : passe par loading=true puis idle (finally)", async () => {
    let resolve;
    mockApiGet.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("loading");
    });

    resolve({ user: { prenom: "Alice", nom: "Martin" } });

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("idle");
      expect(screen.getByTestId("user")).toHaveTextContent("Alice Martin");
    });
  });

  it("logout : appelle apiPostVoid et vide l'utilisateur", async () => {
    mockApiGet.mockResolvedValueOnce({ user: { prenom: "Jean", nom: "Dupont" } });
    mockApiPostVoid.mockResolvedValueOnce(undefined);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    // D'abord se connecter
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() =>
      expect(screen.getByTestId("user")).toHaveTextContent("Jean Dupont")
    );

    // Puis se déconnecter
    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("null");
    });
    expect(mockApiPostVoid).toHaveBeenCalledWith("/auth/logout", {});
  });

  it("useAuth hors de AuthProvider lève une erreur explicite", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    function BrokenConsumer() {
      useAuth();
      return null;
    }

    expect(() => render(<BrokenConsumer />)).toThrow(
      "useAuth doit être utilisé dans AuthProvider"
    );

    consoleError.mockRestore();
  });
});
