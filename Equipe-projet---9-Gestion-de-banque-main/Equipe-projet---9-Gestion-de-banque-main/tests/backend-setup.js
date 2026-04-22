import { jest } from "@jest/globals";

const originalError = console.error.bind(console);
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    // Silence expected errors from controller catch blocks during error-path tests
    const msg = args[0] instanceof Error ? args[0].message : String(args[0]);
    if (msg.startsWith("Error:") || args[0] instanceof Error) return;
    originalError(...args);
  });
});
afterAll(() => {
  console.error.mockRestore?.();
});
