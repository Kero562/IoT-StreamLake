/** Canonical telemetry message shape arriving from MQTT. */
export type TelemetryMsg = {
    device_id?: string;
    timestamp?: number | string;
    temperature?: number;
    humidity?: number;
    energy?: number;
    [k: string]: unknown;
};
