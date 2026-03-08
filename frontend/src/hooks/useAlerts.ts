import { useCallback, useEffect, useRef, useState } from "react";
import { useMqttMessages } from "../providers/MqttProvider";
import type { TelemetryMsg } from "../types/telemetry";
import type { DeviceHealthEntry } from "./useDeviceHealth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AlertSeverity = "info" | "warning" | "critical";

export type Alert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  triggeredAt: number;
  resolvedAt?: number;
  /** If user has explicitly acknowledged this alert. */
  acknowledged?: boolean;
  /** Optional: associated device. */
  deviceId?: string;
  /** Category for filtering. */
  category: AlertCategory;
};

export type AlertCategory =
  | "connection"
  | "stream"
  | "sensor"
  | "device"
  | "fleet"
  | "simulation";

/* ------------------------------------------------------------------ */
/*  localStorage persistence helpers                                   */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "iot-streamlake-alerts";
const MAX_HISTORY = 50;

function loadHistory(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Alert[];
  } catch {
    return [];
  }
}

function saveHistory(alerts: Alert[]) {
  try {
    // Only persist resolved/acknowledged alerts (history)
    const history = alerts
      .filter((a) => a.resolvedAt || a.acknowledged)
      .slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* quota exceeded — ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Thresholds                                                         */
/* ------------------------------------------------------------------ */

const STALE_THRESHOLD_MS = 10_000;
const TEMP_LOW = 5;
const TEMP_HIGH = 45;
const HUMIDITY_LOW = 20;
const HUMIDITY_HIGH = 90;
const ENERGY_HIGH = 4.5;
const DEVICE_CRITICAL_MS = 120_000;
const SENSOR_STUCK_MS = 60_000;
const RESOLVE_CLEAR_DELAY_MS = 8_000;

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Evaluates alert conditions every ~2s from the shared MQTT stream.
 * Auto-resolves alerts when conditions recover.
 *
 * @param deviceStatuses - Per-device health map from useDeviceHealth
 * @param fleetHealthPercent - Fleet health % from useDeviceHealth
 */
export function useAlerts(
  deviceStatuses?: Map<string, DeviceHealthEntry>,
  fleetHealthPercent: number = 100
): {
  alerts: Alert[];
  acknowledge: (id: string) => void;
  dismiss: (id: string) => void;
  clearHistory: () => void;
} {
  const { messages, connected, lastMessageAt, simulation } = useMqttMessages();
  const [alerts, setAlerts] = useState<Alert[]>(() => loadHistory());

  // Refs for stable access in interval
  const connectedRef = useRef(connected);
  const lastMessageAtRef = useRef(lastMessageAt);
  const messagesRef = useRef(messages);
  const simulationRef = useRef(simulation);
  const deviceStatusesRef = useRef(deviceStatuses);
  const fleetHealthRef = useRef(fleetHealthPercent);

  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { lastMessageAtRef.current = lastMessageAt; }, [lastMessageAt]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { simulationRef.current = simulation; }, [simulation]);
  useEffect(() => { deviceStatusesRef.current = deviceStatuses; }, [deviceStatuses]);
  useEffect(() => { fleetHealthRef.current = fleetHealthPercent; }, [fleetHealthPercent]);

  // Persist on change
  useEffect(() => {
    saveHistory(alerts);
  }, [alerts]);

  // --- Actions ---
  const acknowledge = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, resolvedAt: a.resolvedAt || Date.now() } : a
      )
    );
  }, []);

  const clearHistory = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.resolvedAt));
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // --- Evaluation loop ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      setAlerts((prev) => {
        const next = [...prev];

        const upsert = (
          id: string,
          active: boolean,
          severity: AlertSeverity,
          message: string,
          category: AlertCategory,
          deviceId?: string
        ) => {
          const idx = next.findIndex((a) => a.id === id);

          if (active) {
            if (idx === -1) {
              next.push({ id, severity, message, triggeredAt: now, category, deviceId });
            } else if (next[idx].resolvedAt) {
              // Re-trigger
              next[idx] = { id, severity, message, triggeredAt: now, category, deviceId };
            } else if (
              next[idx].message !== message ||
              next[idx].severity !== severity
            ) {
              next[idx] = { ...next[idx], severity, message };
            }
          } else if (idx !== -1 && !next[idx].resolvedAt) {
            next[idx] = { ...next[idx], resolvedAt: now };
          }
        };

        const sim = simulationRef.current;
        const simDisconnected = Boolean(sim?.disconnected);
        const simDropPercent = sim?.dropPercent ?? 0;
        const simDelayMs = sim?.delayMs ?? 0;

        // =====================================================
        // Connection alerts
        // =====================================================
        upsert(
          "connection-lost",
          !connectedRef.current || simDisconnected,
          "critical",
          "MQTT connection lost — live data unavailable",
          "connection"
        );

        // =====================================================
        // Stream alerts
        // =====================================================
        const age = lastMessageAtRef.current
          ? now - lastMessageAtRef.current
          : Number.POSITIVE_INFINITY;

        const isStale =
          connectedRef.current &&
          !simDisconnected &&
          (age > STALE_THRESHOLD_MS || !lastMessageAtRef.current);

        upsert(
          "stale-stream",
          isStale,
          "warning",
          `No telemetry received for ${Math.round(age / 1000)}s`,
          "stream"
        );

        // Throughput collapse: stream was active but age is growing fast
        const throughputCollapse =
          connectedRef.current &&
          !simDisconnected &&
          lastMessageAtRef.current > 0 &&
          age > 8_000 &&
          age < Number.POSITIVE_INFINITY;

        upsert(
          "throughput-collapse",
          throughputCollapse,
          age > 20_000 ? "critical" : "warning",
          `Data throughput near zero — last message ${Math.round(age / 1000)}s ago`,
          "stream"
        );

        // =====================================================
        // Simulation signal alerts
        // =====================================================
        upsert(
          "sim-drop",
          simDropPercent >= 50,
          "warning",
          `Simulation message drop is ${simDropPercent}%`,
          "simulation"
        );

        upsert(
          "sim-delay",
          simDelayMs >= 1000,
          simDelayMs >= 3000 ? "warning" : "info",
          `Simulation delay is ${simDelayMs}ms`,
          "simulation"
        );

        // =====================================================
        // Sensor out-of-range (latest message)
        // =====================================================
        const latest = messagesRef.current[0] as TelemetryMsg | undefined;
        if (latest) {
          const t = latest.temperature;
          const h = latest.humidity;
          const e = latest.energy;

          upsert(
            "temp-out-of-range",
            t != null && (t < TEMP_LOW || t > TEMP_HIGH),
            t != null && (t < -5 || t > 55) ? "critical" : "warning",
            t != null
              ? `Temperature ${t.toFixed(1)}°C outside safe range (${TEMP_LOW}–${TEMP_HIGH}°C)`
              : "",
            "sensor",
            latest.device_id
          );

          upsert(
            "humidity-out-of-range",
            h != null && (h < HUMIDITY_LOW || h > HUMIDITY_HIGH),
            "warning",
            h != null
              ? `Humidity ${h.toFixed(0)}% outside optimal range (${HUMIDITY_LOW}–${HUMIDITY_HIGH}%)`
              : "",
            "sensor",
            latest.device_id
          );

          upsert(
            "energy-high",
            e != null && e > ENERGY_HIGH,
            "warning",
            e != null ? `Energy consumption ${e.toFixed(2)} kW exceeds threshold (${ENERGY_HIGH} kW)` : "",
            "sensor",
            latest.device_id
          );
        }

        // =====================================================
        // Per-device health alerts
        // =====================================================
        const statuses = deviceStatusesRef.current;
        if (statuses && statuses.size > 0) {
          // Track up to 5 offline devices as individual alerts
          let offlineCount = 0;
          for (const [, entry] of statuses) {
            if (entry.status === "offline" && offlineCount < 5) {
              const offlineAge = now - entry.lastSeen;
              upsert(
                `device-offline:${entry.id}`,
                true,
                offlineAge > DEVICE_CRITICAL_MS ? "critical" : "warning",
                `Device ${entry.id} offline for ${Math.round(offlineAge / 1000)}s`,
                "device",
                entry.id
              );
              offlineCount++;
            } else if (entry.status !== "offline") {
              // Resolve if device came back
              const existingIdx = next.findIndex(
                (a) => a.id === `device-offline:${entry.id}`
              );
              if (existingIdx !== -1 && !next[existingIdx].resolvedAt) {
                next[existingIdx] = { ...next[existingIdx], resolvedAt: now };
              }
            }

            // Sensor stuck detection
            if (
              entry.lastTemp !== null &&
              now - entry.lastTempChangeAt > SENSOR_STUCK_MS &&
              entry.status === "healthy"
            ) {
              upsert(
                `sensor-stuck:${entry.id}`,
                true,
                "info",
                `Device ${entry.id} temperature stuck at ${entry.lastTemp?.toFixed(1)}°C for ${Math.round((now - entry.lastTempChangeAt) / 1000)}s`,
                "sensor",
                entry.id
              );
            } else {
              const stuckIdx = next.findIndex(
                (a) => a.id === `sensor-stuck:${entry.id}`
              );
              if (stuckIdx !== -1 && !next[stuckIdx].resolvedAt) {
                next[stuckIdx] = { ...next[stuckIdx], resolvedAt: now };
              }
            }
          }
        }

        // =====================================================
        // Fleet health alerts
        // =====================================================
        const fleet = fleetHealthRef.current;
        upsert(
          "fleet-degraded",
          fleet < 70,
          fleet < 40 ? "critical" : "warning",
          `Fleet health at ${fleet}% — ${fleet < 40 ? "critical" : "degraded"} device availability`,
          "fleet"
        );

        // =====================================================
        // Clean up resolved alerts after delay
        // =====================================================
        return next.filter(
          (a) => !a.resolvedAt || now - a.resolvedAt < RESOLVE_CLEAR_DELAY_MS
        );
      });
    }, 2_000);

    return () => clearInterval(timer);
  }, []);

  return { alerts, acknowledge, dismiss, clearHistory };
}
