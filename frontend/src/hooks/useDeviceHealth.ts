import { useEffect, useRef, useState } from "react";
import { useMqttMessages } from "../providers/MqttProvider";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DeviceHealthStatus = "healthy" | "degraded" | "offline";

export type DeviceHealthEntry = {
    id: string;
    lastSeen: number;
    status: DeviceHealthStatus;
    /** Last reported temperature (for stuck-sensor detection). */
    lastTemp: number | null;
    lastTempChangeAt: number;
};

export type DeviceHealthResult = {
    /** Percentage of tracked devices that are "healthy" (0–100). */
    fleetHealthPercent: number;
    /** Total tracked devices. */
    totalDevices: number;
    /** Counts by status. */
    healthy: number;
    degraded: number;
    offline: number;
    /** Full device status map (id → entry). */
    deviceStatuses: Map<string, DeviceHealthEntry>;
};

/* ------------------------------------------------------------------ */
/*  Thresholds                                                         */
/* ------------------------------------------------------------------ */

const DEGRADED_AFTER_MS = 15_000; // 15 s → degraded
const OFFLINE_AFTER_MS = 45_000; // 45 s → offline
const PRUNE_AFTER_MS = 5 * 60_000; // 5 min → forget

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Tracks per-device health based on message recency.
 * Maintains a rolling map of devices and their status.
 * Exports fleet-wide health percentage for use by useSystemHealth.
 */
export function useDeviceHealth(): DeviceHealthResult {
    const { messages } = useMqttMessages();
    const indexRef = useRef(new Map<string, DeviceHealthEntry>());

    const [result, setResult] = useState<DeviceHealthResult>({
        fleetHealthPercent: 100,
        totalDevices: 0,
        healthy: 0,
        degraded: 0,
        offline: 0,
        deviceStatuses: new Map(),
    });

    // Ingest new messages
    useEffect(() => {
        const now = Date.now();
        for (const msg of messages) {
            const id = msg.device_id;
            if (!id) continue;

            const existing = indexRef.current.get(id);
            const temp = msg.temperature ?? null;

            if (existing) {
                existing.lastSeen = now;
                // Track temperature changes for stuck-sensor detection
                if (temp !== null && temp !== existing.lastTemp) {
                    existing.lastTemp = temp;
                    existing.lastTempChangeAt = now;
                }
            } else {
                indexRef.current.set(id, {
                    id,
                    lastSeen: now,
                    status: "healthy",
                    lastTemp: temp,
                    lastTempChangeAt: now,
                });
            }
        }
    }, [messages]);

    // Periodic evaluation (every 2s)
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            let healthy = 0;
            let degraded = 0;
            let offline = 0;

            for (const [id, entry] of Array.from(indexRef.current)) {
                const age = now - entry.lastSeen;

                // Prune very old devices
                if (age > PRUNE_AFTER_MS) {
                    indexRef.current.delete(id);
                    continue;
                }

                if (age <= DEGRADED_AFTER_MS) {
                    entry.status = "healthy";
                    healthy++;
                } else if (age <= OFFLINE_AFTER_MS) {
                    entry.status = "degraded";
                    degraded++;
                } else {
                    entry.status = "offline";
                    offline++;
                }
            }

            const total = healthy + degraded + offline;
            const pct = total > 0 ? Math.round((healthy / total) * 100) : 100;

            setResult({
                fleetHealthPercent: pct,
                totalDevices: total,
                healthy,
                degraded,
                offline,
                deviceStatuses: new Map(indexRef.current),
            });
        }, 2_000);

        return () => clearInterval(timer);
    }, []);

    return result;
}
