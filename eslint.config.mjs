import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      ".npm-tmp-cache/**",
      ".npm-tmp-cache-vercel/**",
      "node_modules/**",
      "shopify-theme/**",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
