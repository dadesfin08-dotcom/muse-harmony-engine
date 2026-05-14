import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/push-config")({
  server: {
    handlers: {
      GET: async () => {
        const publicKey = process.env.VAPID_PUBLIC_KEY;

        if (!publicKey) {
          return Response.json({ error: "Missing VAPID public key." }, { status: 500 });
        }

        return Response.json({ publicKey }, { status: 200 });
      },
    },
  },
});