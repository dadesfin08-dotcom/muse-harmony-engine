import { useEffect } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { usePushNotifications, type PushUserType } from "@/hooks/usePushNotifications";

type PushNotificationsToggleProps = {
  role: PushUserType;
  label: string;
  className?: string;
};

export function PushNotificationsToggle({ role, label, className }: PushNotificationsToggleProps) {
  const {
    isSupported,
    showIosInstallHint,
    isPermissionDenied,
    isAuthenticated,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    syncSubscriptionState,
  } =
    usePushNotifications();

  useEffect(() => {
    void syncSubscriptionState();
  }, [syncSubscriptionState]);

  const handleCheckedChange = async (checked: boolean) => {
    try {
      if (checked) {
        await subscribe(role);
        toast.success("Push notifications enabled.");
        return;
      }

      await unsubscribe();
      toast.success("Push notifications disabled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push notification update failed.");
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <BellRing className="size-4 text-primary" />
          <span className="truncate text-xs text-muted-foreground sm:text-sm">{label}</span>
        </div>
        <Switch checked={isSubscribed} onCheckedChange={handleCheckedChange} disabled={!isSupported || isLoading || !isAuthenticated} />
      </div>

      {!isAuthenticated ? (
        <p className="mt-2 text-xs text-muted-foreground">سجّل الدخول أولاً لتفعيل الإشعارات.</p>
      ) : null}

      {isPermissionDenied ? (
        <p className="mt-2 text-xs text-destructive">
          ​
        </p>
      ) : null}

      {showIosInstallHint ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 size-3.5 shrink-0" />
          Install the app first on iOS: Safari → Share → Add to Home Screen.
        </p>
      ) : null}
    </div>
  );
}