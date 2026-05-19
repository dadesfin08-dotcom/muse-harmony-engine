import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listWebhookExecutionLogs } from "@/lib/webhook-logs.functions";

export const Route = createFileRoute("/admin/webhook-logs")({
  component: AdminWebhookLogsPage,
});

function AdminWebhookLogsPage() {
  const { i18n } = useTranslation();
  const isRtl = (i18n.resolvedLanguage || i18n.language || "en") === "ar";
  const fetchLogs = useServerFn(listWebhookExecutionLogs);

  const logsQuery = useQuery({
    queryKey: ["admin", "webhook-execution-logs"],
    queryFn: () => fetchLogs({ data: { limit: 200 } }),
    refetchInterval: 12_000,
  });

  const logs = logsQuery.data ?? [];
  const successCount = logs.filter((row) => row.executionStatus === "success").length;
  const failedCount = logs.filter((row) => row.executionStatus === "failed").length;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ArrowLeft className="size-4" />
              <span>Admin</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Webhook Execution Logs</h1>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => logsQuery.refetch()}
          disabled={logsQuery.isFetching}
        >
          <RefreshCw className={`size-4 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Success</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{failedCount}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started At</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Loading webhook logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No webhook execution logs yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.workflowName}</TableCell>
                    <TableCell>
                      <Badge variant={row.executionStatus === "success" ? "secondary" : "destructive"}>
                        {row.executionStatus === "success" ? "Success" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.startedAt ? new Date(row.startedAt).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{Math.max(0, Number(row.durationMs ?? 0))} ms</TableCell>
                    <TableCell>{row.attempt}</TableCell>
                    <TableCell>{row.responseStatus ?? "-"}</TableCell>
                    <TableCell className="max-w-[340px] truncate text-xs text-muted-foreground" title={row.errorMessage ?? ""}>
                      {row.errorMessage ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
