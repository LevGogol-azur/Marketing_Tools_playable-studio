import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Relative base so the build works under the GitHub Pages project subpath.
export default defineConfig({
  base: "./",
  plugins: [vue()],
});
