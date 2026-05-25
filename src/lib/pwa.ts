const PWA_WORKER_PATHS = ["/sw.js", "/service-worker.js"];

function isPreviewOrIframeContext() {
  const hostname = window.location.hostname;
  const isPreviewHost =
    hostname.includes("id-preview--") ||
    hostname.includes("lovable.app") ||
    hostname.includes("lovableproject.com");

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  return isPreviewHost || isInIframe;
}

async function cleanupPwaWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) => {
        const scriptUrl = registration.active?.scriptURL || registration.installing?.scriptURL;
        if (!scriptUrl) return false;

        return PWA_WORKER_PATHS.some((workerPath) => scriptUrl.endsWith(workerPath));
      })
      .map((registration) => registration.unregister()),
  );
}

export async function registerPwaServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewOrIframeContext()) {
    await cleanupPwaWorkers();
    return;
  }

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}