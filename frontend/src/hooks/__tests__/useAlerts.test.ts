import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

const { useAlerts } = await import("../../hooks/useAlerts");

describe("useAlerts", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCtx.connected = true;
        mockCtx.lastMessageAt = Date.now();
        mockCtx.messages = [];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("generates connection-lost alert when disconnected", async () => {
        mockCtx.connected = false;
        mockCtx.lastMessageAt = 0;

        const { result } = renderHook(() => useAlerts());

        await act(async () => {
            vi.advanceTimersByTime(2100);
        });

        const connAlert = result.current.alerts.find((a) => a.id === "connection-lost");
        expect(connAlert).toBeDefined();
        expect(connAlert!.severity).toBe("critical");
    });

    it("resolves connection-lost alert when reconnected", async () => {
        mockCtx.connected = false;
        mockCtx.lastMessageAt = 0;

        const { result, rerender } = renderHook(() => useAlerts());

        // Trigger alert
        await act(async () => {
            vi.advanceTimersByTime(2100);
        });
        expect(result.current.alerts.find((a) => a.id === "connection-lost")).toBeDefined();

        // "Reconnect"
        mockCtx.connected = true;
        mockCtx.lastMessageAt = Date.now();
        rerender();

        await act(async () => {
            vi.advanceTimersByTime(2100);
        });

        const connAlert = result.current.alerts.find((a) => a.id === "connection-lost");
        // Should be resolvedAt (or removed after delay)
        expect(!connAlert || connAlert.resolvedAt != null).toBe(true);
    });

    it("generates temperature out-of-range alert", async () => {
        mockCtx.connected = true;
        mockCtx.lastMessageAt = Date.now();
        mockCtx.messages = [
            { device_id: "test-1", timestamp: Date.now(), temperature: 50, humidity: 50 },
        ];

        const { result } = renderHook(() => useAlerts());

        await act(async () => {
            vi.advanceTimersByTime(2100);
        });

        const tempAlert = result.current.alerts.find(
            (a) => a.id === "temp-out-of-range"
        );
        expect(tempAlert).toBeDefined();
        expect(tempAlert!.severity).toBe("warning");
    });
});
