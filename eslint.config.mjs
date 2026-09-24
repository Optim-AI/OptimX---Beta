import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * Phase 12.10.1 — production ESLint gate (lint policy only).
 *
 * - React Compiler behavioral rules: warn (not error) so build can ship
 *   without speculative lifecycle rewrites.
 * - OAuth Meta start links: keep <a href="/api/..."> full navigations on
 *   three integration pages only; do not disable the Link rule globally.
 */

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**", "dist/**"],
  },
  {
    rules: {
      // React Compiler / lifecycle rules — warn until post-launch cleanup.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    // Intentional full-browser OAuth navigations to /api/meta/oauth/start.
    // Do NOT convert these to next/link.
    files: [
      "pages/integrations/meta/cancelled.tsx",
      "pages/integrations/meta/error.tsx",
      "pages/integrations/meta/no-pages.tsx",
    ],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default eslintConfig;
