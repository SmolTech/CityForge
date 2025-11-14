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
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/cityforge_test",
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
    // Test timeout for integration tests
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
