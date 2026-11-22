import { fetchWithTenant } from "./api-client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export async function subscribeToPushNotifications(
  userRole: string = "teacher"
): Promise<{ success: boolean; message: string }> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { success: false, message: "Push notifications are not supported on this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, message: "Notification permission was denied." };
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration) {
    return { success: false, message: "Service worker not active." };
  }

  try {
    // VAPID Public Key (Replace with your server key in production)
    const publicVapidKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5NMPH8A";
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    const userId = localStorage.getItem("user_id") || "default_user";

    // Send subscription payload to FastAPI backend
    await fetchWithTenant("/api/v1/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        role: userRole,
        subscription: subscription.toJSON()
      })
    });

    return { success: true, message: "Push notifications enabled successfully!" };
  } catch (error) {
    console.error("Failed to subscribe push:", error);
    return { success: false, message: "Could not activate push service." };
  }
}