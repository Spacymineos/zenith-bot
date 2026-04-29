import { defineConfig } from "vitest/config";
import { resolve } from "path";

const alias = {
  "@zenith/shared": resolve(__dirname, "./src/shared/index.ts"),
  "@zenith/config": resolve(__dirname, "./src/config.ts"),
};

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "contracts/**"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
  resolve: {
    alias,
  },
});
