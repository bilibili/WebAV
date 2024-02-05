import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "istanbul", // or 'c8'
    },
  },
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/av-recorder.ts"),
      name: "av-recoder",
    },
  },
});
