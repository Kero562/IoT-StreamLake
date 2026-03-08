import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import type { MqttContextValue } from "../../providers/MqttProvider";

// ---------- Mock the MqttProvider ----------
const mockCtx: MqttContextValue = {
    messages: [],
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

// Import AFTER mock is set up
const { useSystemHealth } = await import("../../hooks/useSystemHealth");

describe("useSystemHealth", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCtx.connected = true;
        mockCtx.lastMessageAt = Date.now();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns 100% when messages are recent", async () => {
        mockCtx.lastMessageAt = Date.now();
        mockCtx.connected = true;

        const { result } = renderHook(() => useSystemHealth(15000, 5000));

        // Tick the interval
        await act(async () => {
            vi.advanceTimersByTime(1100);
        });

        expect(result.current.healthPercent).toBe(100);
        expect(result.current.statusText).toBe("All systems operational");
    });

    it("degrades when lastMessageAge > degradeAfterMs", async () => {
        // Last message was 8s ago, degrade threshold is 5s, down threshold is 15s
        mockCtx.lastMessageAt = Date.now() - 8000;
        mockCtx.connected = true;

        const { result } = renderHook(() => useSystemHealth(15000, 5000));

        await act(async () => {
            vi.advanceTimersByTime(1100);
        });

        expect(result.current.healthPercent).toBeLessThan(100);
        expect(result.current.healthPercent).toBeGreaterThan(0);
        expect(result.current.statusText).toBe("Telemetry delayed");
    });

    it("returns 0% when disconnected and no messages", async () => {
        mockCtx.lastMessageAt = 0;
        mockCtx.connected = false;

        const { result } = renderHook(() => useSystemHealth(15000, 5000));

        await act(async () => {
            vi.advanceTimersByTime(1100);
        });

        expect(result.current.healthPercent).toBe(0);
        expect(result.current.statusText).toBe("Disconnected");
    });
});
