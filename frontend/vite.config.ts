import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Zedly",
        short_name: "Zedly",
        description: "Zedly web app for schools",
        theme_color: "#0f172a",
        background_color: "#f6faf8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/tests\/.*\/offline-bundle/,
            handler: "NetworkFirst",
            options: {
              cacheName: "test-bundles",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 4 * 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
  }
});
