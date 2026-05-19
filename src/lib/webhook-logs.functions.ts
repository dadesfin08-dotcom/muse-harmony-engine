import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const listWebhookLogsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(500).default(150),
  })
  .default({ limit: 150 });

export type WebhookExecutionLogRow = {
  id: string;
  orderId: string | null;
  workflowName: "order-accepted-alert" | "order-out-for-delivery" | "cyclist-broadcast-alert";
  eventType: string;
  executionStatus: "success" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  attempt: number;
  responseStatus: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export const listWebhookExecutionLogs = createServerFn({ method: "POST" })
  .inputValidator((input) => listWebhookLogsInputSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("webhook_execution_logs")
      .select(
        "id, order_id, workflow_name, event_type, execution_status, started_at, completed_at, duration_ms, attempt, response_status, error_message, created_at",
      )
      .in("workflow_name", ["order-accepted-alert", "order-out-for-delivery", "cyclist-broadcast-alert"])
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) {
      throw new Error(error.message);
    }

    return ((rows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ""),
      orderId: typeof row.order_id === "string" ? row.order_id : null,
      workflowName: String(row.workflow_name) as WebhookExecutionLogRow["workflowName"],
      eventType: String(row.event_type ?? ""),
      executionStatus: (String(row.execution_status ?? "failed") === "success" ? "success" : "failed") as WebhookExecutionLogRow["executionStatus"],
      startedAt: String(row.started_at ?? ""),
      completedAt: String(row.completed_at ?? ""),
      durationMs: Number(row.duration_ms ?? 0),
      attempt: Number(row.attempt ?? 1),
      responseStatus: typeof row.response_status === "number" ? row.response_status : null,
      errorMessage: typeof row.error_message === "string" ? row.error_message : null,
      createdAt: String(row.created_at ?? ""),
    })) satisfies WebhookExecutionLogRow[];
  });
