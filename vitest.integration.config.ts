import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["tests/integration/**/*.test.ts"], environment: "node", testTimeout: 30_000, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
