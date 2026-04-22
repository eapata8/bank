import { jest } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../../frontend/src/context/ThemeContext";

function Consumer() {
  const { theme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("fournit le theme 'dark' par defaut (sans localStorage)", async () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );
    // After useEffect: stored=null → resolved="dark"
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });
  });

  it("charge le theme 'light' depuis localStorage au montage", async () => {
    localStorage.setItem("lb-theme", "light");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );
    // useEffect reads "light" from localStorage
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("light");
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("charge le theme 'dark' depuis localStorage au montage", async () => {
    localStorage.setItem("lb-theme", "dark");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("theme").textContent).toBe("dark");
    });
  });

  it("bascule de dark vers light via toggle()", async () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("dark"));

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(localStorage.getItem("lb-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("bascule de light vers dark via un second toggle()", async () => {
    localStorage.setItem("lb-theme", "light");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("light"));

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(localStorage.getItem("lb-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("useTheme hors ThemeProvider retourne le theme 'dark' par defaut du contexte", () => {
    // No ThemeProvider — uses default context value { theme: "dark", toggle: () => {} }
    render(<Consumer />);
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("toggle() appele sans ThemeProvider ne lance pas d'erreur (toggle noop)", () => {
    render(<Consumer />);
    // Should not throw
    expect(() => fireEvent.click(screen.getByRole("button", { name: "toggle" }))).not.toThrow();
  });
});
