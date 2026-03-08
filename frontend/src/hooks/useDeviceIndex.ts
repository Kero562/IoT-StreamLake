import { useEffect, useRef } from "react";
import { useMqttMessages } from "../providers/MqttProvider";
import type { Device } from "../components/DeviceLookup";

type DeviceEntry = {
    id: string;
    lastSeen: number;
    temperature: number | null;
    humidity: number | null;
    energy: number | null;
    messageCount: number;
};

/**
 * Builds an in-memory device index from live telemetry.
 * Returns an async-compatible resolver function that can be passed to <DeviceLookup />.
 */
export function useDeviceIndex() {
    const { messages } = useMqttMessages();
    const indexRef = useRef(new Map<string, DeviceEntry>());

    useEffect(() => {
        for (const msg of messages) {
            const id = msg.device_id;
            if (!id) continue;

            const existing = indexRef.current.get(id);
            const now = Date.now();

            if (existing) {
                existing.lastSeen = now;
                if (msg.temperature != null) existing.temperature = msg.temperature;
                if (msg.humidity != null) existing.humidity = msg.humidity;
                if (msg.energy != null) existing.energy = msg.energy;
                existing.messageCount += 1;
            } else {
                indexRef.current.set(id, {
                    id,
                    lastSeen: now,
                    temperature: msg.temperature ?? null,
                    humidity: msg.humidity ?? null,
                    energy: msg.energy ?? null,
                    messageCount: 1,
                });
            }
        }
    }, [messages]);

    /** Async-compatible resolver for DeviceLookup. */
    const resolve = async (searchId: string): Promise<Device | null> => {
        // Try exact match first, then case-insensitive prefix
        const normalized = searchId.toLowerCase();
        let entry: DeviceEntry | undefined;

        entry = indexRef.current.get(searchId);
        if (!entry) {
            entry = indexRef.current.get(searchId.toLowerCase());
        }
        if (!entry) {
            // Prefix search — find first device whose id contains the search term
            for (const [key, val] of indexRef.current) {
                if (key.toLowerCase().includes(normalized)) {
                    entry = val;
                    break;
                }
            }
        }

        if (!entry) return null;

        const ageSec = Math.round((Date.now() - entry.lastSeen) / 1000);
        const isOnline = ageSec < 30;

        const tempStr =
            entry.temperature != null ? `${entry.temperature.toFixed(1)}°C` : "—";
        const humStr =
            entry.humidity != null ? `${entry.humidity.toFixed(0)}%` : "—";

        return {
            id: entry.id,
            type: "IoT Sensor",
            icon: "📡",
            model: "StreamLake Telemetry",
            installed: "—",
            status: isOnline ? "Online" : `Last seen ${ageSec}s ago`,
            readingLabel: "Temperature / Humidity",
            readingValue: `${tempStr} / ${humStr}`,
            dataRate: `${entry.messageCount} msgs`,
        };
    };

    return { resolve, index: indexRef };
}
