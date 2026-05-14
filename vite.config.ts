// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
const supabaseOrigin = (() => {
  const candidate = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
})();

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        devOptions: {
          enabled: false,
        },
        includeAssets: ["pwa-192.png", "pwa-512.png"],
        manifest: {
          name: "Bzaf Fresh",
          short_name: "Bzaf",
          description: "Multi-role grocery delivery app with real-time operational dashboards.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#10b981",
          icons: [
            {
              src: "/pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-pages",
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: ({ url, request }) => {
                if (!supabaseOrigin) return false;
                if (url.origin !== supabaseOrigin) return false;
                return (
                  request.method === "GET" &&
                  (url.pathname.startsWith("/rest/v1") ||
                    url.pathname.startsWith("/auth/v1") ||
                    url.pathname.startsWith("/storage/v1") ||
                    url.pathname.startsWith("/realtime/v1"))
                );
              },
              handler: "NetworkFirst",
              options: {
                cacheName: "backend-api-cache",
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 5,
                },
              },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
