import { createSupabaseAdminClient } from "@/lib/supabase-server";

export type WalletType = "apple" | "google";

// Centralized event write path for wallet actions so NFC-linked passes can reuse it later.
export async function trackWalletEvent(profileId: string, walletType: WalletType) {
  const admin = createSupabaseAdminClient();
  await admin.from("wallet_events").insert({
    profile_id: profileId,
    wallet_type: walletType,
  });
}
