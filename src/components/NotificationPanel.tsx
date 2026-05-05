"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, CheckCircle, X, Volume2, VolumeX } from "lucide-react";

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  autoTestComplete: boolean;
  benchmarkComplete: boolean;
  thermalAlert: boolean;
  lowBattery: boolean;
  temperatureThreshold: number;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  autoTestComplete: true,
  benchmarkComplete: true,
  thermalAlert: true,
  lowBattery: true,
  temperatureThreshold: 90,
};

const STORAGE_KEY = "ai-laptop-tester-notifications";

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// Global notification controller
let notificationCallbacks: ((message: string, type: "success" | "warning" | "error") => void)[] = [];
let soundCallbacks: (() => void)[] = [];

export function registerNotificationCallback(
  cb: (message: string, type: "success" | "warning" | "error") => void
): () => void {
  notificationCallbacks.push(cb);
  return () => {
    notificationCallbacks = notificationCallbacks.filter((c) => c !== cb);
  };
}

export function sendNotification(message: string, type: "success" | "warning" | "error" = "success") {
  const settings = loadNotificationSettings();
  if (!settings.enabled) return;

  // Show toast
  notificationCallbacks.forEach((cb) => cb(message, type));

  // Send browser notification if supported
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("AI Laptop Tester Pro", {
        body: message,
        icon: "/icon.png",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("AI Laptop Tester Pro", {
            body: message,
            icon: "/icon.png",
          });
        }
      });
    }
  }
}

export function sendTestCompleteNotification(score: number, verdict: string) {
  const settings = loadNotificationSettings();
  if (!settings.enabled || !settings.autoTestComplete) return;

  const type = score >= 80 ? "success" : score >= 50 ? "warning" : "error";
  sendNotification(`Test Complete! Score: ${score.toFixed(0)}/100 — ${verdict}`, type);
}

export function sendBenchmarkCompleteNotification(toolName: string, score?: number) {
  const settings = loadNotificationSettings();
  if (!settings.enabled || !settings.benchmarkComplete) return;

  const msg = score
    ? `${toolName} benchmark complete! Score: ${score.toFixed(0)}`
    : `${toolName} benchmark complete!`;
  sendNotification(msg, "success");
}

export function sendThermalAlert(cpuTemp: number, gpuTemp: number) {
  const settings = loadNotificationSettings();
  if (!settings.enabled || !settings.thermalAlert) return;
  if (cpuTemp < settings.temperatureThreshold && gpuTemp < settings.temperatureThreshold) return;

  sendNotification(
    `Thermal Alert! CPU: ${cpuTemp.toFixed(1)}°C, GPU: ${gpuTemp.toFixed(1)}°C`,
    "error"
  );
}

export function sendLowBatteryNotification(batteryPct: number) {
  const settings = loadNotificationSettings();
  if (!settings.enabled || !settings.lowBattery) return;
  if (batteryPct > 20) return;

  sendNotification(`Low Battery Warning: ${batteryPct.toFixed(0)}% remaining`, "warning");
}

export default function NotificationPanel() {
  const [settings, setSettings] = useState<NotificationSettings>(loadNotificationSettings);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; type: "success" | "warning" | "error"; time: number }[]
  >([]);

  useEffect(() => {
    const unregister = registerNotificationCallback((message, type) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setNotifications((prev) => [...prev.slice(-4), { id, message, type, time: Date.now() }]);

      // Auto-dismiss
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    });

    return unregister;
  }, []);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveNotificationSettings(newSettings);
  }, [settings]);

  const toggleSetting = useCallback((key: keyof NotificationSettings) => {
    const current = settings[key];
    if (typeof current === "boolean") {
      updateSettings({ [key]: !current } as Partial<NotificationSettings>);
    }
  }, [settings, updateSettings]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        updateSettings({ enabled: true });
      }
    }
  }, [updateSettings]);

  return (
    <>
      {/* Settings Panel */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#f1f5f9] tracking-tight flex items-center gap-2">
            <Bell size={16} className="text-[#f59e0b]" />
            Notifications
          </h2>
          <button
            onClick={() => {
              if (!settings.enabled) {
                requestPermission();
              } else {
                updateSettings({ enabled: false });
              }
            }}
            className="text-xs px-2 py-1 rounded-full font-medium transition-all"
            style={{
              backgroundColor: settings.enabled ? "#22c55e20" : "#ef444420",
              color: settings.enabled ? "#22c55e" : "#ef4444",
              border: `1px solid ${settings.enabled ? "#22c55e40" : "#ef444440"}`,
            }}
          >
            {settings.enabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <ToggleRow
            label="Auto Test Complete"
            description="Notify when automated test finishes"
            enabled={settings.autoTestComplete && settings.enabled}
            onToggle={() => toggleSetting("autoTestComplete")}
            icon={<CheckCircle size={14} />}
          />
          <ToggleRow
            label="Benchmark Complete"
            description="Notify when individual benchmarks finish"
            enabled={settings.benchmarkComplete && settings.enabled}
            onToggle={() => toggleSetting("benchmarkComplete")}
            icon={<CheckCircle size={14} />}
          />
          <ToggleRow
            label="Thermal Alerts"
            description={`Alert when CPU/GPU exceeds ${settings.temperatureThreshold}°C`}
            enabled={settings.thermalAlert && settings.enabled}
            onToggle={() => toggleSetting("thermalAlert")}
            icon={<Bell size={14} />}
          />
          <ToggleRow
            label="Low Battery"
            description="Alert when battery drops below 20%"
            enabled={settings.lowBattery && settings.enabled}
            onToggle={() => toggleSetting("lowBattery")}
            icon={<Bell size={14} />}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <span className="text-xs text-[#94a3b8]">Temp Threshold:</span>
          <input
            type="range"
            min={70}
            max={100}
            value={settings.temperatureThreshold}
            onChange={(e) => updateSettings({ temperatureThreshold: Number(e.target.value) })}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ backgroundColor: "#2a3654", accentColor: "#f59e0b" }}
          />
          <span className="text-xs font-mono text-[#f59e0b] w-8">
            {settings.temperatureThreshold}°C
          </span>
        </div>

        {!settings.enabled && (
          <div className="text-xs text-[#94a3b8] bg-[#1a2235] rounded-lg p-3">
            Enable notifications to get alerts for test completion, thermal warnings, and low battery.
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className="pointer-events-auto rounded-xl p-4 min-w-[300px] max-w-[400px]"
              style={{
                backgroundColor: "#1a2235",
                border: `1px solid ${notif.type === "success" ? "#22c55e40" : notif.type === "warning" ? "#f59e0b40" : "#ef444440"}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5"
                  style={{
                    color:
                      notif.type === "success"
                        ? "#22c55e"
                        : notif.type === "warning"
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                >
                  <Bell size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f1f5f9] font-medium">{notif.message}</p>
                  <p className="text-xs text-[#475569] mt-1">
                    {new Date(notif.time).toLocaleTimeString("vi-VN")}
                  </p>
                </div>
                <button
                  onClick={() => dismissNotification(notif.id)}
                  className="text-[#475569] hover:text-[#f1f5f9] transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  icon,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#111827] cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <span className="text-[#94a3b8]">{icon}</span>
        <div>
          <p className="text-xs text-[#f1f5f9] font-medium">{label}</p>
          <p className="text-xs text-[#475569]">{description}</p>
        </div>
      </div>
      <div
        className="w-9 h-5 rounded-full transition-colors relative"
        style={{ backgroundColor: enabled ? "#22c55e" : "#475569" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{
            transform: enabled ? "translateX(18px)" : "translateX(2px)",
          }}
        />
      </div>
    </div>
  );
}
