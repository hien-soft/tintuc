import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // `pnpm dev` biên dịch theo yêu cầu: lần đầu một server action/trang có thể mất vài giây.
  expect: { timeout: 20_000 },
  use: { baseURL: process.env.SITE_URL ?? "http://localhost:3000" },
  workers: 1,
});
