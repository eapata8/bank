import { jest } from "@jest/globals";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import HomePage from "../../frontend/src/app/page";

const mockPush = jest.fn();
const mockRefreshMe = jest.fn();

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

describe("HomePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("affiche le loader de preparation", () => {
    mockRefreshMe.mockReturnValue(new Promise(() => {}));

    render(<HomePage />);

    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });

  it("redirige vers /dashboard si une session existe", async () => {
    mockRefreshMe.mockResolvedValue({ id: 1 });

    render(<HomePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirige vers /login si aucune session n'existe", async () => {
    mockRefreshMe.mockResolvedValue(null);

    render(<HomePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });
});
