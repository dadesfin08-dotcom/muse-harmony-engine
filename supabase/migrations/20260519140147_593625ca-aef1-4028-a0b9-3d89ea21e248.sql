create table if not exists public.webhook_execution_logs (
  id uuid primary key default gen_random_uuid(),
  order_push_event_id uuid null,
  order_id uuid null,
  workflow_name text not null,
  event_type text not null,
  execution_status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null,
  duration_ms integer not null default 0,
  attempt integer not null default 1,
  response_status integer null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint webhook_execution_logs_status_check check (execution_status in ('success', 'failed')),
  constraint webhook_execution_logs_workflow_check check (workflow_name in ('order-accepted-alert', 'order-out-for-delivery', 'cyclist-broadcast-alert'))
);

alter table public.webhook_execution_logs enable row level security;

drop policy if exists "Admins can view webhook execution logs" on public.webhook_execution_logs;
create policy "Admins can view webhook execution logs"
on public.webhook_execution_logs
for select
to authenticated
using (public.is_admin(auth.uid()));

create index if not exists idx_webhook_execution_logs_created_at
  on public.webhook_execution_logs (created_at desc);

create index if not exists idx_webhook_execution_logs_workflow_created_at
  on public.webhook_execution_logs (workflow_name, created_at desc);

create index if not exists idx_webhook_execution_logs_status_created_at
  on public.webhook_execution_logs (execution_status, created_at desc);

create index if not exists idx_webhook_execution_logs_order_event
  on public.webhook_execution_logs (order_push_event_id, order_id);