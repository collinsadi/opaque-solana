import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // snarkjs ships CommonJS; let Vite handle the interop
  optimizeDeps: {
    include: ["snarkjs"],
  },
  server: {
    port: 5174,
  },
});
