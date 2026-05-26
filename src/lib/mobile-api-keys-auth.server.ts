import { createHash } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BEARER_PREFIX = "Bearer ";

export class MobileApiKeyAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "MobileApiKeyAuthError";
  }
}

type MobileApiKeyLookupRow = {
  id: string;
  key_name: string;
  key_prefix: string;
  is_active: boolean;
  revoked_at: string | null;
};

function extractBearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new MobileApiKeyAuthError("Missing Bearer token");
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new MobileApiKeyAuthError("Invalid Bearer token");
  }

  return token;
}

export async function authenticateMobileApiKey(request: Request) {
  const token = extractBearerToken(request);
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: keyRow, error } = await (supabaseAdmin as any)
    .from("mobile_api_keys")
    .select("id, key_name, key_prefix, is_active, revoked_at")
    .eq("api_key_hash", tokenHash)
    .maybeSingle();

  if (error || !keyRow) {
    throw new MobileApiKeyAuthError("Unknown API key");
  }

  const typed = keyRow as MobileApiKeyLookupRow;
  if (!typed.is_active || typed.revoked_at) {
    throw new MobileApiKeyAuthError("Revoked API key");
  }

  return {
    id: typed.id,
    keyName: typed.key_name,
    keyPrefix: typed.key_prefix,
  };
}
