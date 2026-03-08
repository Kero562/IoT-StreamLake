import { useMemo } from "react";
import { useMqttMessages } from "../providers/MqttProvider";
import type { TelemetryMsg } from "../types/telemetry";

/**
 * Returns the latest `buffer` telemetry messages from the shared MQTT stream.
 * This is a thin wrapper over the shared MqttProvider context.
 */
export function useIotLive<T = TelemetryMsg>(buffer = 200): T[] {
  const { messages } = useMqttMessages();
  return useMemo(
    () => messages.slice(0, buffer) as unknown as T[],
    [messages, buffer]
  );
}
