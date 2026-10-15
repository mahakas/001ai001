import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

/** Browser globals used by the shell. */
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  Storage: "readonly",
  matchMedia: "readonly",
  MediaQueryList: "readonly",
  MediaQueryListEvent: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  queueMicrotask: "readonly",
  HTMLElement: "readonly",
  HTMLButtonElement: "readonly",
  HTMLDivElement: "readonly",
  Element: "readonly",
  Node: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  KeyboardEvent: "readonly",
  console: "readonly",
  IntersectionObserver: "readonly",
  URLSearchParams: "readonly",
  getComputedStyle: "readonly",
  performance: "readonly",
  PerformanceObserver: "readonly",
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  vi: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
};

/** Node globals used by config files and tooling. */
const nodeGlobals = {
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  global: "readonly",
  console: "readonly",
};

// Flat ESLint config shared by @mahak/web and @mahak/contracts.
export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Providers intentionally colocate their hook with the provider
      // component per the plan's structure (research.md R-05).
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["**/*.config.{js,ts}", "**/vite.config.ts", "**/playwright.config.ts"],
    languageOptions: {
      globals: { ...nodeGlobals },
    },
  },
];
