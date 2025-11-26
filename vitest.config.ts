import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    env: {
      // Test environment variables
      NODE_ENV: "test",
      JWT_SECRET_KEY: "test-secret-key-for-testing-only",
      // Note: DATABASE_URL is set dynamically by integration test containers
      // Don't set a default here to avoid conflicts with testcontainers
      // Disable external dependencies in tests
      OPENSEARCH_HOST: "",
      OPENSEARCH_PORT: "",
      CLOUDINARY_CLOUD_NAME: "test",
      CLOUDINARY_API_KEY: "test",
      CLOUDINARY_API_SECRET: "test",
    },
    // Test patterns
    include: [
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
    // Exclude E2E tests (run by Playwright)
    exclude: ["node_modules/**", "tests/e2e/**"],
    // Test timeout for integration tests
    testTimeout: 10000,
    // Code coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/__tests__/**",
        ".next/**",
        "dist/**",
        "build/**",
        "*.config.{js,ts,mjs}",
        "src/app/layout.tsx",
        "src/app/**/layout.tsx",
        "src/app/api/__tests__/**",
        "prisma/**",
        "mobile/**",
        "indexer/**",
        "**/*.d.ts",
        "**/*.min.js",
        "**/seed-*.{js,ts}",
        ".venv/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
