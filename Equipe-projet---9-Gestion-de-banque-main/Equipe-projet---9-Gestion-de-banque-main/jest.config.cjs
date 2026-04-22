module.exports = {
  roots: ["<rootDir>/tests"],
  forceExit: false,
  detectOpenHandles: true,
  projects: [
    {
      displayName: "backend",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/tests/controller/**/*.test.js",
        "<rootDir>/tests/middlewares/**/*.test.js",
        "<rootDir>/tests/repository/**/*.test.js",
      ],
      setupFilesAfterEnv: ["<rootDir>/tests/backend-setup.js"],
      collectCoverageFrom: [
        "<rootDir>/server/controllers/**/*.js",
        "<rootDir>/server/middlewares/**/*.js",
        "<rootDir>/server/data/**/*.js",
        "!**/node_modules/**",
      ],
    },
    {
      displayName: "frontend",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/frontend/**/*.test.[jt]s?(x)"],
      setupFilesAfterEnv: ["<rootDir>/tests/frontend/setupTests.js"],
      transform: {
        "^.+\\.[jt]sx?$": "babel-jest",
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/frontend/src/$1",
        "^next/navigation$": "<rootDir>/tests/frontend/mocks/next-navigation.js",
        "^next/link$": "<rootDir>/tests/frontend/mocks/next-link.jsx",
        "^react$": "<rootDir>/node_modules/react",
        "^react/jsx-runtime$": "<rootDir>/node_modules/react/jsx-runtime.js",
        "^react-dom$": "<rootDir>/node_modules/react-dom",
        "^react-dom/(.*)$": "<rootDir>/node_modules/react-dom/$1",
      },
      collectCoverageFrom: [
        "<rootDir>/frontend/src/**/*.{ts,tsx}",
        "!<rootDir>/frontend/src/**/*.d.ts",
        "!**/node_modules/**",
      ],
    },
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov"],
  coverageProvider: "v8",
  verbose: true,
};
