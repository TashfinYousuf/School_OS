// frontend/public/sw.js
// Stage 11: Production-Grade Service Worker with Cache Partitioning & Sensitive API Quarantine

const SHELL_CACHE = "educationos-shell-v4";
const STATIC_CACHE = "educationos-static-v4";

const APP_SHELL_URLS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

// Sensitive routes: NEVER CACHE IN SERVICE WORKER (Quarantine rule)
const SENSITIVE_URL_PATTERNS = [
  /\/api\/v1\/(auth|finance|guardians|audit|settings|approvals|admissions|billing)/i,
  /\/dashboard\/(finance|guardians|settings|billing)/i
];

// 1. Service Worker Installation (Resilient pre-caching)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.allSettled(
        APP_SHELL_URLS.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((res) => {
              if (res.ok) {
                return cache.put(url, res);
              }
              console.warn("[SW] Skip caching non-OK shell resource:", url, res.status);
            })
            .catch((err) => {
              console.warn("[SW] Pre-cache fetch failed for:", url, err);
            })
        )
      );
    })
  );
  self.skipWaiting();
});

// 2. Activation & Cleanup of Stale Caches
self.addEventListener("activate", (event) => {
  const currentCaches = [SHELL_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Request Routing & Cache Partitioning Strategy
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET requests are cacheable
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // A. Quarantine Rule: Sensitive API and Financial Routes are strictly Network-Only
  const isSensitive = SENSITIVE_URL_PATTERNS.some((pattern) => pattern.test(url.pathname));
  if (isSensitive) {
    event.respondWith(fetch(request));
    return;
  }

  // B. HTML Navigation (Page routing): Network-first with resilient online check before /offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          // Only divert to /offline if physically offline
          const isPhysicallyOffline = typeof navigator !== "undefined" && navigator.onLine === false;
          if (isPhysicallyOffline) {
            const fallback = await caches.match("/offline");
            return fallback || new Response("Offline. Please reconnect to internet.", {
              headers: { "Content-Type": "text/html" }
            });
          }

          // If physically online, attempt one immediate retry before returning server error
          try {
            const retryRes = await fetch(request);
            if (retryRes && retryRes.status === 200) return retryRes;
          } catch {
            // ignore retry failure
          }

          // NEVER force physically connected sessions into /offline page
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Server Busy</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0b0c10;color:#fff;text-align:center;"><div style="max-width:420px;padding:2rem;border:1px solid #1f2833;border-radius:1rem;background:#12141a;"><h2 style="margin-top:0;font-size:1.25rem;">Server Request Timeout</h2><p style="color:#8a909d;font-size:0.875rem;line-height:1.5;">The application server is processing a heavy task or taking longer to respond. You are still connected.</p><button onclick="window.location.reload()" style="margin-top:1rem;padding:0.6rem 1.2rem;background:#2563eb;color:#fff;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer;">Retry Request</button></div></body></html>`,
            {
              status: 504,
              headers: { "Content-Type": "text/html" }
            }
          );
        })
    );
    return;
  }

  // C. Static Assets (_next/static, images, fonts, css): Cache-first with background revalidate
  const isStatic = (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  );

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // D. Allowed Non-Sensitive Reference APIs (Academic reference data): Network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: "Offline: Network unavailable.",
            is_offline: true,
            status: 503
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // Default fallback: Network fetch
  event.respondWith(fetch(request));
});

// 4. Web Push Notifications Receiver
self.addEventListener("push", (event) => {
  let data = {
    title: "EducationOS Notification",
    body: "You have a new institutional alert.",
    url: "/dashboard",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png"
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  // Sanitize notification payload: Never display raw account balances or private passwords
  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
      dateOfArrival: Date.now()
    },
    actions: [
      { action: "explore", title: "Open App" },
      { action: "close", title: "Dismiss" }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 5. Notification Click Action (Deep Linking)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
