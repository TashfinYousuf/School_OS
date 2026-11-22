"use client";

import { useEffect, useState } from "react";
import { Download, Bell, X, Smartphone, CheckCircle2 } from "lucide-react";
import { subscribeToPushNotifications, registerServiceWorker } from "@/lib/pushNotification";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker on mount
    registerServiceWorker();

    // 2. Check standalone display mode (already installed)
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 4. Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isInStandaloneMode) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if notifications already granted
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleEnableNotifications = async () => {
    const res = await subscribeToPushNotifications(localStorage.getItem("user_role") || "teacher");
    if (res.success) {
      setPushEnabled(true);
      alert("EducationOS Notifications & Reminders are now active!");
    } else {
      alert(res.message);
    }
  };

  if (isStandalone && pushEnabled) return null;

  return (
    <>
      {/* Top/Floating Install & Reminder Bar */}
      {(!isStandalone && (showInstallBanner || isIOS)) && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-99999 bg-[#0c0c0e] border border-blue-500/30 text-white p-4 rounded-3xl shadow-2xl space-y-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 rounded-xl text-white">
                <Smartphone size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold">Install EducationOS App</h4>
                <p className="text-[11px] text-gray-400">Install on device for offline attendance & quick access.</p>
              </div>
            </div>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-gray-500 hover:text-white p-1"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <Download size={14} />
              <span>Install App</span>
            </button>

            {!pushEnabled && (
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                title="Enable Push Reminders"
              >
                <Bell size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* iOS Safari 'Add to Home Screen' Step Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-999999 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#0f0f11] border border-white/10 text-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm">Install on iPhone / iPad</h4>
              <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Apple Safari does not allow 1-click prompts. Follow these 2 steps:
            </p>
            <div className="text-xs space-y-2 bg-white/5 p-3 rounded-2xl">
              <div>1. Tap the <strong>Share</strong> button (box with upward arrow) at the bottom of Safari.</div>
              <div>2. Scroll down and tap <strong>Add to Home Screen</strong>.</div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
}