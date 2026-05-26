import { createFileRoute } from "@tanstack/react-router";

import { computeBrandEngineAnalytics } from "@/lib/admin-dashboard.functions";
import { authenticateMobileApiKey, MobileApiKeyAuthError } from "@/lib/mobile-api-keys-auth.server";

export const Route = createFileRoute("/api/public/mobile/ai-dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const key = await authenticateMobileApiKey(request);
          const analytics = await computeBrandEngineAnalytics();

          return Response.json(
            {
              ok: true,
              auth: {
                provider: "mobile_api_keys",
                keyPrefix: key.keyPrefix,
                keyName: key.keyName,
                permissions: ["ai_dashboard:read"],
              },
              data: analytics,
            },
            {
              status: 200,
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        } catch (error) {
          const isAuthError = error instanceof MobileApiKeyAuthError;
          return Response.json(
            {
              ok: false,
              error: isAuthError ? "Unauthorized" : "Failed to load AI dashboard",
            },
            {
              status: isAuthError ? 401 : 500,
            },
          );
        }
      },
    },
  },
});
