import { useEffect, useRef, useState } from "react";
import { useMqttMessages } from "../providers/MqttProvider";

export type HealthResult = {
  healthPercent: number;
  statusText: string;
  valueClassName: string;
  lastMessageAgeMs: number;
  /** Fleet health component (0–100, from useDeviceHealth). */
  fleetHealthPercent: number;
};

/**
 * Derives system health from the shared MQTT stream.
 *
 * The score is a weighted blend of:
 *   - **Stream freshness** (60%) — degrades when messages stop arriving
 *   - **Fleet health** (40%) — % of tracked devices reporting healthy
 *
 * Simulation penalties (drop/delay) are applied on top.
 */
export function useSystemHealth(
  downAfterMs: number = 15000,
  degradeAfterMs: number = 5000,
  /** Fleet health percentage (0–100) from useDeviceHealth. */
  fleetHealthPercent: number = 100
): HealthResult {
  const { connected, lastMessageAt, simulation } = useMqttMessages();

  const [result, setResult] = useState<HealthResult>({
    healthPercent: 0,
    statusText: "Connecting...",
    valueClassName: "text-slate-300",
    lastMessageAgeMs: Number.POSITIVE_INFINITY,
    fleetHealthPercent: 100,
  });

  const connectedRef = useRef(connected);
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  const lastMessageAtRef = useRef(lastMessageAt);
  useEffect(() => {
    lastMessageAtRef.current = lastMessageAt;
  }, [lastMessageAt]);

  const simulationRef = useRef(simulation);
  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  const fleetRef = useRef(fleetHealthPercent);
  useEffect(() => {
    fleetRef.current = fleetHealthPercent;
  }, [fleetHealthPercent]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const last = lastMessageAtRef.current;
      const age = last ? now - last : Number.POSITIVE_INFINITY;

      const sim = simulationRef.current;
      const effectivelyConnected = connectedRef.current && !sim?.disconnected;

      const receiving =
        age !== Number.POSITIVE_INFINITY && age <= downAfterMs;

      // ---- Stream freshness score (0–100) ----
      let streamScore = 0;

      if (!effectivelyConnected) {
        streamScore = 0;
      } else if (receiving) {
        if (age <= degradeAfterMs) {
          streamScore = 100;
        } else {
          const span = Math.max(1, downAfterMs - degradeAfterMs);
          const over = age - degradeAfterMs;
          const pct = Math.max(0, 1 - over / span);
          streamScore = Math.round(30 + pct * 70);
        }
      } else {
        streamScore = 5;
      }

      // Apply simulation penalties
      if (effectivelyConnected && sim) {
        const dropPenalty = Math.round(Math.min(40, sim.dropPercent * 0.4));
        const delayPenalty = Math.round(Math.min(30, sim.delayMs / 100));
        streamScore = Math.max(0, streamScore - dropPenalty - delayPenalty);
      }

      // ---- Blended score: 60% stream + 40% fleet ----
      const fleet = fleetRef.current;
      let score = Math.round(streamScore * 0.6 + fleet * 0.4);
      if (!effectivelyConnected) {
        score = 0;
      }

      // ---- Status text & class ----
      let statusText = "All systems operational";
      let valueClassName = "text-green-300";

      if (!effectivelyConnected) {
        statusText = "Disconnected";
        valueClassName = "text-red-300";
      } else if (!receiving) {
        statusText = "No telemetry received";
        valueClassName = "text-red-300";
      } else if (score < 50) {
        statusText = "Fleet health critical";
        valueClassName = "text-red-300";
      } else if (score < 80) {
        statusText = fleet < 70 ? "Fleet health degraded" : "Telemetry delayed";
        valueClassName = "text-yellow-300";
      } else if (
        age > degradeAfterMs ||
        (sim && (sim.delayMs > 0 || sim.dropPercent > 0))
      ) {
        statusText = "Telemetry delayed";
        valueClassName = "text-yellow-300";
      }

      setResult({
        healthPercent: score,
        statusText,
        valueClassName,
        lastMessageAgeMs: age,
        fleetHealthPercent: fleet,
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [degradeAfterMs, downAfterMs]);

  return result;
}
