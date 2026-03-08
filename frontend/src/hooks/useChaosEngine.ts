import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ChaosScenario = "deviceDropout" | "sensorSpike" | "fleetDegradation";

export type ChaosConfig = {
    /** Master switch. */
    enabled: boolean;
    /** Demo Mode: auto-run chaos on an interval. */
    demoMode: boolean;
    /** Seconds between demo-mode auto-events (default 30). */
    demoIntervalSec: number;

    /* — Device Dropout — */
    deviceDropout: boolean;
    /** 0–100 : % of known devices to silently drop messages for. */
    dropoutPercent: number;

    /* — Sensor Spike — */
    sensorSpike: boolean;
    /** Interval in seconds between injected spikes (default 10). */
    spikeIntervalSec: number;

    /* — Fleet Degradation — */
    fleetDegradation: boolean;
    /** Progressive escalation speed: 1 (slow) – 5 (fast). */
    degradationSpeed: number;
};

export type ChaosState = ChaosConfig & {
    /** Device IDs currently being dropped (for deviceDropout). */
    droppedDevices: Set<string>;
    /** Accumulated fleet degradation level 0–100. */
    degradationLevel: number;
    /** Whether next message should get spiked. */
    shouldSpikeNext: boolean;
};

export type ChaosControls = ChaosConfig & {
    setEnabled: (v: boolean) => void;
    setDemoMode: (v: boolean) => void;
    setDemoIntervalSec: (v: number) => void;
    setDeviceDropout: (v: boolean) => void;
    setDropoutPercent: (v: number) => void;
    setSensorSpike: (v: boolean) => void;
    setSpikeIntervalSec: (v: number) => void;
    setFleetDegradation: (v: boolean) => void;
    setDegradationSpeed: (v: number) => void;
    resetAll: () => void;
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULTS: ChaosConfig = {
    enabled: false,
    demoMode: false,
    demoIntervalSec: 30,
    deviceDropout: false,
    dropoutPercent: 20,
    sensorSpike: false,
    spikeIntervalSec: 10,
    fleetDegradation: false,
    degradationSpeed: 2,
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/**
 * Client-side chaos injection engine.
 *
 * Returns controls for the SimulationPanel and a ref-based state reader
 * that the MqttProvider can call synchronously on every incoming message
 * to decide whether to mutate/drop it.
 */
export function useChaosEngine() {
    const [config, setConfig] = useState<ChaosConfig>({ ...DEFAULTS });

    // Mutable state used by the message interceptor (not React state)
    const chaosRef = useRef<ChaosState>({
        ...DEFAULTS,
        droppedDevices: new Set(),
        degradationLevel: 0,
        shouldSpikeNext: false,
    });

    // Sync config → ref
    useEffect(() => {
        Object.assign(chaosRef.current, config);
    }, [config]);

    // --- Demo Mode timer ---
    const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (demoTimerRef.current) clearInterval(demoTimerRef.current);

        if (config.demoMode && config.enabled) {
            demoTimerRef.current = setInterval(() => {
                // Cycle through chaos scenarios
                const scenarios: ChaosScenario[] = ["deviceDropout", "sensorSpike", "fleetDegradation"];
                const pick = scenarios[Math.floor(Math.random() * scenarios.length)];

                setConfig((prev) => ({
                    ...prev,
                    deviceDropout: pick === "deviceDropout" ? true : prev.deviceDropout,
                    sensorSpike: pick === "sensorSpike" ? true : prev.sensorSpike,
                    fleetDegradation: pick === "fleetDegradation" ? true : prev.fleetDegradation,
                }));
            }, config.demoIntervalSec * 1000);
        }

        return () => {
            if (demoTimerRef.current) clearInterval(demoTimerRef.current);
        };
    }, [config.demoMode, config.enabled, config.demoIntervalSec]);

    // --- Sensor Spike timer ---
    useEffect(() => {
        if (!config.enabled || !config.sensorSpike) {
            chaosRef.current.shouldSpikeNext = false;
            return;
        }

        const id = setInterval(() => {
            chaosRef.current.shouldSpikeNext = true;
        }, config.spikeIntervalSec * 1000);

        return () => clearInterval(id);
    }, [config.enabled, config.sensorSpike, config.spikeIntervalSec]);

    // --- Fleet Degradation escalation ---
    useEffect(() => {
        if (!config.enabled || !config.fleetDegradation) {
            chaosRef.current.degradationLevel = 0;
            return;
        }

        const id = setInterval(() => {
            const step = config.degradationSpeed * 2; // 2–10% per tick
            chaosRef.current.degradationLevel = Math.min(
                90,
                chaosRef.current.degradationLevel + step
            );
        }, 5_000); // escalate every 5s

        return () => clearInterval(id);
    }, [config.enabled, config.fleetDegradation, config.degradationSpeed]);

    // --- Controls ---
    const set = useCallback(
        <K extends keyof ChaosConfig>(key: K, value: ChaosConfig[K]) =>
            setConfig((prev) => ({ ...prev, [key]: value })),
        []
    );

    const resetAll = useCallback(() => {
        setConfig({ ...DEFAULTS });
        chaosRef.current = {
            ...DEFAULTS,
            droppedDevices: new Set(),
            degradationLevel: 0,
            shouldSpikeNext: false,
        };
    }, []);

    const controls: ChaosControls = {
        ...config,
        setEnabled: (v) => set("enabled", v),
        setDemoMode: (v) => set("demoMode", v),
        setDemoIntervalSec: (v) => set("demoIntervalSec", v),
        setDeviceDropout: (v) => set("deviceDropout", v),
        setDropoutPercent: (v) => set("dropoutPercent", v),
        setSensorSpike: (v) => set("sensorSpike", v),
        setSpikeIntervalSec: (v) => set("spikeIntervalSec", v),
        setFleetDegradation: (v) => set("fleetDegradation", v),
        setDegradationSpeed: (v) => set("degradationSpeed", v),
        resetAll,
    };

    return { controls, chaosRef };
}

/* ------------------------------------------------------------------ */
/*  Message interceptor (called from MqttProvider on each message)     */
/* ------------------------------------------------------------------ */

/**
 * Given a chaos state ref and a set of known device IDs, decides whether
 * to drop / mutate an incoming message. Returns the (possibly mutated)
 * message, or `null` to drop it.
 */
export function applyChaos(
    msg: { device_id?: string; temperature?: number; humidity?: number;[k: string]: unknown },
    chaos: ChaosState,
    knownDeviceIds: string[]
): typeof msg | null {
    if (!chaos.enabled) return msg;

    const deviceId = msg.device_id ?? "";

    // --- Device Dropout ---
    if (chaos.deviceDropout && knownDeviceIds.length > 0) {
        // Lazily populate dropped devices set
        const targetCount = Math.max(
            1,
            Math.ceil((knownDeviceIds.length * chaos.dropoutPercent) / 100)
        );

        if (chaos.droppedDevices.size < targetCount) {
            // Pick random devices to drop
            const shuffled = [...knownDeviceIds].sort(() => Math.random() - 0.5);
            chaos.droppedDevices = new Set(shuffled.slice(0, targetCount));
        }

        if (chaos.droppedDevices.has(deviceId)) {
            return null; // silently drop
        }
    } else if (!chaos.deviceDropout) {
        chaos.droppedDevices.clear();
    }

    // --- Fleet Degradation (additive drop based on degradation level) ---
    if (chaos.fleetDegradation && chaos.degradationLevel > 0) {
        if (Math.random() * 100 < chaos.degradationLevel) {
            return null;
        }
    }

    // --- Sensor Spike ---
    if (chaos.sensorSpike && chaos.shouldSpikeNext) {
        chaos.shouldSpikeNext = false;
        const mutated = { ...msg };
        // Inject extreme values
        mutated.temperature = Math.random() > 0.5
            ? 50 + Math.random() * 15 // hot spike: 50–65°C
            : -10 - Math.random() * 15; // cold spike: -10 to -25°C
        mutated.humidity = Math.random() > 0.5
            ? 95 + Math.random() * 5 // high: 95–100%
            : 5 + Math.random() * 10; // low: 5–15%
        return mutated;
    }

    return msg;
}
