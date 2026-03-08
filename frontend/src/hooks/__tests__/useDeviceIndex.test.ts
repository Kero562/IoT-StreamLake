import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MqttContextValue } from "../../providers/MqttProvider";
import type { TelemetryMsg } from "../../types/telemetry";

// ---------- Mock ----------
const mockCtx: MqttContextValue = {
    messages: [] as TelemetryMsg[],
    connected: true,
    lastMessageAt: Date.now(),
    simulation: {
        disconnected: false,
        dropPercent: 0,
        delayMs: 0,
        setDisconnected: vi.fn(),
        setDropPercent: vi.fn(),
        setDelayMs: vi.fn(),
    },
    chaos: {
        enabled: false,
        demoMode: false,
        demoIntervalSec: 30,
        deviceDropout: false,
        dropoutPercent: 20,
        sensorSpike: false,
        spikeIntervalSec: 10,
        fleetDegradation: false,
        degradationSpeed: 2,
        setEnabled: vi.fn(),
        setDemoMode: vi.fn(),
        setDemoIntervalSec: vi.fn(),
        setDeviceDropout: vi.fn(),
        setDropoutPercent: vi.fn(),
        setSensorSpike: vi.fn(),
        setSpikeIntervalSec: vi.fn(),
        setFleetDegradation: vi.fn(),
        setDegradationSpeed: vi.fn(),
        resetAll: vi.fn(),
    },
    knownDeviceIds: [],
};

vi.mock("../../providers/MqttProvider", () => ({
    useMqttMessages: () => ({
        messages: mockCtx.messages,
        connected: mockCtx.connected,
        lastMessageAt: mockCtx.lastMessageAt,
    }),
}));

const { useDeviceIndex } = await import("../../hooks/useDeviceIndex");

describe("useDeviceIndex", () => {
    beforeEach(() => {
        mockCtx.messages = [];
    });

    it("returns device details after ingesting a message", async () => {
        mockCtx.messages = [
            {
                device_id: "sensor-001",
                timestamp: Date.now(),
                temperature: 25.3,
                humidity: 55,
            },
        ];

        const { result } = renderHook(() => useDeviceIndex());

        const device = await act(async () => {
            return result.current.resolve("sensor-001");
        });

        expect(device).not.toBeNull();
        expect(device!.id).toBe("sensor-001");
        expect(device!.readingValue).toContain("25.3");
    });

    it("returns null for unknown device", async () => {
        mockCtx.messages = [
            {
                device_id: "sensor-001",
                timestamp: Date.now(),
                temperature: 22,
                humidity: 40,
            },
        ];

        const { result } = renderHook(() => useDeviceIndex());

        const device = await act(async () => {
            return result.current.resolve("unknown-device-xyz");
        });

        expect(device).toBeNull();
    });

    it("updates metrics on subsequent messages", async () => {
        mockCtx.messages = [
            {
                device_id: "sensor-002",
                timestamp: Date.now(),
                temperature: 20,
                humidity: 45,
            },
        ];

        const { result, rerender } = renderHook(() => useDeviceIndex());

        // Update with new reading
        mockCtx.messages = [
            {
                device_id: "sensor-002",
                timestamp: Date.now(),
                temperature: 30,
                humidity: 65,
            },
        ];
        rerender();

        const device = await act(async () => {
            return result.current.resolve("sensor-002");
        });

        expect(device).not.toBeNull();
        expect(device!.readingValue).toContain("30.0");
    });
});
