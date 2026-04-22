import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../../frontend/src/app/login/page";

const mockPush = jest.fn();
const mockRefreshMe = jest.fn();
const mockApiPost = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    refreshMe: mockRefreshMe,
  }),
}));

jest.mock("@/lib/api", () => ({
  apiPost: (...args) => mockApiPost(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche le formulaire de connexion avec les champs vides", () => {
    render(<LoginPage />);

    expect(screen.getAllByText("Leon Bank").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Adresse e-mail")).toHaveValue("");
    expect(screen.getByLabelText("Mot de passe")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Se connecter →" })).toBeInTheDocument();
  });

  it("connecte l'utilisateur et redirige vers le dashboard", async () => {
    mockApiPost.mockResolvedValue({ message: "Connecte", user: { id: 1 } });
    mockRefreshMe.mockResolvedValue({ id: 1 });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "user@Leon.local" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "Demo123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter →" }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/auth/login", {
        email: "user@Leon.local",
        motDePasse: "Demo123!",
      });
    });

    expect(mockRefreshMe).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("affiche une erreur si la connexion echoue", async () => {
    mockApiPost.mockRejectedValue({ message: "Connexion impossible" });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Se connecter →" }));

    expect(await screen.findByText("Connexion impossible")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("met a jour le champ email quand on tape dedans", () => {
    render(<LoginPage />);
    const input = screen.getByLabelText("Adresse e-mail");
    fireEvent.change(input, { target: { value: "nouveau@exemple.com" } });
    expect(input).toHaveValue("nouveau@exemple.com");
  });

  it("met a jour le champ mot de passe quand on tape dedans", () => {
    render(<LoginPage />);
    const input = screen.getByLabelText("Mot de passe");
    fireEvent.change(input, { target: { value: "NouveauPass!" } });
    expect(input).toHaveValue("NouveauPass!");
  });

  it("affiche le message par défaut si l'erreur n'a pas de message", async () => {
    mockApiPost.mockRejectedValueOnce({});

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Se connecter →" }));

    expect(await screen.findByText("Identifiants incorrects")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("hover sur le bouton quand non-loading change le background (lignes 259-260)", () => {
    render(<LoginPage />);
    const btn = screen.getByRole("button", { name: "Se connecter →" });

    fireEvent.mouseEnter(btn);
    // jsdom convertit #4434d4 en rgb(68, 52, 212)
    expect(btn.style.background).toMatch(/4434d4|68,\s*52,\s*212/i);

    fireEvent.mouseLeave(btn);
    // jsdom convertit #533afd en rgb(83, 58, 253)
    expect(btn.style.background).toMatch(/533afd|83,\s*58,\s*253/i);
  });

  it("hover sur le bouton pendant loading ne change pas le background (branche if !loading false)", async () => {
    // apiPost ne se résout jamais → loading reste true
    mockApiPost.mockReturnValue(new Promise(() => {}));

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Se connecter →" }));

    const loadingBtn = await screen.findByRole("button", { name: "Connexion en cours…" });

    fireEvent.mouseEnter(loadingBtn);
    expect(loadingBtn.style.background).not.toBe("#4434d4");

    fireEvent.mouseLeave(loadingBtn);
    expect(loadingBtn.style.background).not.toBe("#533afd");
  });
});
