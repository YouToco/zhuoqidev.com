// `pnpm run lint`. TypeScript gets typescript-eslint's strict type-checked rules, with types from
// the same tsconfig that `pnpm run check` uses for that file: the site's for everything it
// includes, functions/tsconfig.json for functions/ and server/. .astro files get the Astro
// plugin's recommended rules on top of the strict ones. Every exception below says why.
import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist/", ".astro/", ".wrangler/", "public/", "node_modules/", "tools/*/node_modules/"],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ["**/*.ts"],
    // An .astro file's <script> blocks reach ESLint as virtual `X.astro/N_N.ts` files, which no
    // tsconfig knows; they keep the strict rules that need no types. The server tests are in no
    // tsconfig either (Node strips their types and runs them as they are).
    ignores: ["**/*.astro/*.ts", "server/*.test.ts"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./functions/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Numbers read fine in a template; objects, nullish values and the rest stay errors.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // `() => el.remove()` style one-liners; a void value used anywhere else is still an error.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
    },
  },
  {
    // node:test's test() returns a promise the runner tracks itself.
    files: ["scripts/*.test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        { allowForKnownSafeCalls: [{ from: "package", name: ["test", "describe", "it"], package: "node:test" }] },
      ],
    },
  },
  {
    rules: {
      // With noUncheckedIndexedAccess (tsconfig "strictest") an index read is `T | undefined`;
      // the code asserts `!` where the index is known to be in range. Banning `!` would only move
      // those checks into casts or dead branches.
      "@typescript-eslint/no-non-null-assertion": "off",
      // `catch {}` is how the scripts shrug off storage, Intl and cross-frame access that a
      // browser may refuse; every other empty block is still an error.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // `const { name: _, ...rest } = o` is how a field is left out of a copy.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  astro.configs.recommended,
  {
    // `<script is:inline>` blocks ship byte for byte, with no bundler or transpiler, and run
    // before the page draws, so they are written as plain ES5: `var`, and gtag's queue needs the
    // real `arguments` object. ESLint sees every <script> block as a virtual `X.astro/N_N.ts`
    // file whether inline or not, so this names the two files whose inline scripts need it.
    files: ["src/components/Analytics.astro/*.ts", "src/layouts/Base.astro/*.ts"],
    rules: {
      "no-var": "off",
      "prefer-rest-params": "off",
      "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
  {
    // Build scripts, tools and server code run on Node.
    files: ["scripts/**", "tools/**", "server/**", "astro.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    // Page scripts run in the browser, and so do the pages the build drives in headless Chrome
    // and the functions those Node scripts hand to page.evaluate().
    files: [
      "src/**",
      "scripts/*.mjs",
      "tools/diagrams/browser.js",
      "tools/diagrams/generate.mjs",
      "tools/models/argus-poster.mjs",
      "tools/models/*-page.js",
    ],
    languageOptions: { globals: globals.browser },
  },
);
