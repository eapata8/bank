import { jest } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Button from "../../frontend/src/components/ui/Button";
import Card from "../../frontend/src/components/ui/Card";
import Input from "../../frontend/src/components/ui/Input";
import Select from "../../frontend/src/components/ui/Select";

describe("UI components", () => {
  it("Input affiche le label et remonte les changements", () => {
    const handleChange = jest.fn();

    render(<Input label="Email" value="" onChange={handleChange} type="email" />);

    const input = screen.getByLabelText("Email");
    fireEvent.change(input, { target: { value: "test@Leon.local" } });

    expect(handleChange).toHaveBeenCalledWith("test@Leon.local");
  });

  it("Select affiche les options et remonte la valeur choisie", () => {
    const handleChange = jest.fn();

    render(
      <Select
        label="Compte"
        value="1"
        onChange={handleChange}
        options={[
          { value: "1", label: "Compte 1" },
          { value: "2", label: "Compte 2" },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Compte"), { target: { value: "2" } });

    expect(handleChange).toHaveBeenCalledWith("2");
  });

  it("Button appelle onClick", () => {
    const handleClick = jest.fn();

    render(<Button onClick={handleClick}>Tester</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Tester" }));

    expect(handleClick).toHaveBeenCalled();
  });

  it("Button variant danger applique la couleur rouge (lignes 23,33)", () => {
    render(<Button variant="danger">Supprimer</Button>);
    const btn = screen.getByRole("button", { name: "Supprimer" });
    expect(btn).toBeInTheDocument();
    expect(btn.style.background).toBe("rgb(220, 38, 38)");
  });

  it("Button variant secondary applique la classe ghost", () => {
    render(<Button variant="secondary" className="extra">Secondaire</Button>);
    const btn = screen.getByRole("button", { name: "Secondaire" });
    expect(btn.className).toContain("lb-btn-ghost");
    expect(btn.className).toContain("extra");
  });

  it("Card affiche son contenu", () => {
    render(
      <Card>
        <div>Bloc carte</div>
      </Card>
    );

    expect(screen.getByText("Bloc carte")).toBeInTheDocument();
  });
});
