import { jest } from "@jest/globals";
import React from "react";
import { render } from "@testing-library/react";
import ComptesPage from "../../frontend/src/app/dashboard/comptes/page";

const mockRedirect = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: (...args) => mockRedirect(...args),
}));

describe("ComptesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirige vers /dashboard/clients", () => {
    render(<ComptesPage />);
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/clients");
  });
});
