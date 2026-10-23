import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // lucanacafe.github.io ve özel domain: "/" (proje sitesi olsaydı "/repo-adi/")
  const base = env.VITE_BASE || "/";

  return {
    base,
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "icons/apple-touch-icon.png", "images/*.webp"],
        manifest: {
          name: "Lucana Cafe & Lounge",
          short_name: "Lucana",
          description: "Cafe · Nargile · Okey — Çağlayan, Kağıthane. QR menü ve masadan sipariş.",
          lang: "tr",
          start_url: base,
          scope: base,
          display: "standalone",
          orientation: "portrait",
          background_color: "#0c0907",
          theme_color: "#0c0907",
          categories: ["food", "lifestyle"],
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          shortcuts: [
            { name: "Menü", url: `${base}menu`, icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
            { name: "Yönetim Paneli", url: `${base}panel`, icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
          navigateFallback: `${base}index.html`,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // Web Push bildirim işleyicisi (public/push-sw.js)
          importScripts: ["push-sw.js"],
          globIgnores: ["push-sw.js"],
          runtimeCaching: [
            {
              // Panelden yüklenen ürün görselleri
              urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/"),
              handler: "CacheFirst",
              options: {
                cacheName: "lucana-media",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    build: {
      target: "es2020",
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            supabase: ["@supabase/supabase-js"],
            motion: ["framer-motion"],
          },
        },
      },
    },
  };
});
