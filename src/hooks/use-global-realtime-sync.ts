import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

type RealtimeTable = "orders" | "platform_commission_ledger";

type UseGlobalRealtimeSyncOptions = {
  enabled?: boolean;
};

export function useGlobalRealtimeSync({ enabled = true }: UseGlobalRealtimeSyncOptions = {}) {
  const queryClient = useQueryClient();
  const pendingTablesRef = useRef<Set<RealtimeTable>>(new Set());
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const flush = () => {
      const touchedTables = new Set(pendingTablesRef.current);
      pendingTablesRef.current.clear();
      flushTimerRef.current = null;

      if (touchedTables.has("orders")) {
        void queryClient.invalidateQueries({ queryKey: ["orders"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"], refetchType: "active" });

        void queryClient.invalidateQueries({ queryKey: ["admin", "orders-global"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["admin", "overview-analytics"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["admin", "vendors"], refetchType: "active" });

        void queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["vendor", "wallet"], refetchType: "active" });

        void queryClient.invalidateQueries({ queryKey: ["cyclist", "dashboard"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet"], refetchType: "active" });
      }

      if (touchedTables.has("platform_commission_ledger")) {
        void queryClient.invalidateQueries({ queryKey: ["platform-dues"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["ledger-history"], refetchType: "active" });

        void queryClient.invalidateQueries({ queryKey: ["admin", "vendors"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["admin", "platform-collections-history"], refetchType: "active" });

        void queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"], refetchType: "active" });
        void queryClient.invalidateQueries({ queryKey: ["vendor", "wallet"], refetchType: "active" });
      }
    };

    const queueFlush = (table: RealtimeTable) => {
      pendingTablesRef.current.add(table);
      if (flushTimerRef.current !== null) return;
      flushTimerRef.current = window.setTimeout(flush, 150);
    };

    const channel = supabase
      .channel("global-db-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => queueFlush("orders"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_commission_ledger" },
        () => queueFlush("platform_commission_ledger"),
      )
      .subscribe();

    return () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingTablesRef.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}