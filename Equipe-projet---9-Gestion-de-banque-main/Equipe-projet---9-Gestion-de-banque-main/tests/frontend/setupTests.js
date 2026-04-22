import "@testing-library/jest-dom";
import { jest } from "@jest/globals";

const originalError = console.error.bind(console);
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((msg, ...args) => {
    if (typeof msg === "string" && msg.includes("not wrapped in act")) return;
    const errMsg = msg instanceof Error ? msg.message : String(msg);
    if (errMsg.includes("Not implemented: navigation")) return;
    originalError(msg, ...args);
  });
});
afterAll(() => {
  console.error.mockRestore?.();
});
