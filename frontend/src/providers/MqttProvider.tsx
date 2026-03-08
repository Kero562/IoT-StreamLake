import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { mqtt, io, iot } from "aws-iot-device-sdk-v2";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import type { TelemetryMsg } from "../types/telemetry";
import { useChaosEngine, applyChaos, type ChaosControls, type ChaosState } from "../hooks/useChaosEngine";

/* ------------------------------------------------------------------ */
/*  Simulation knobs (dev-only, controlled via SimulationPanel)       */
/* ------------------------------------------------------------------ */
export type SimulationState = {
    disconnected: boolean;
    dropPercent: number; // 0–100
    delayMs: number; // artificial delay before delivering messages
};

export type SimulationControls = SimulationState & {
    setDisconnected: (v: boolean) => void;
    setDropPercent: (v: number) => void;
    setDelayMs: (v: number) => void;
};

/* ------------------------------------------------------------------ */
/*  Context shape                                                     */
/* ------------------------------------------------------------------ */
export type MqttContextValue = {
    messages: TelemetryMsg[];
    connected: boolean;
    lastMessageAt: number;
    simulation: SimulationControls;
    chaos: ChaosControls;
    /** IDs of all devices seen (for chaos engine targeting). */
    knownDeviceIds: string[];
};

const MqttContext = createContext<MqttContextValue | null>(null);

const BUFFER_SIZE = 500;
const TOPIC = "sensors/telemetry/#";

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */
export function MqttProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<TelemetryMsg[]>([]);
    const [connected, setConnected] = useState(false);
    const lastMessageAtRef = useRef(0);
    const [lastMessageAt, setLastMessageAt] = useState(0);

    // Simulation state
    const [disconnected, setDisconnected] = useState(false);
    const [dropPercent, setDropPercent] = useState(0);
    const [delayMs, setDelayMs] = useState(0);

    // Chaos engine
    const { controls: chaosControls, chaosRef } = useChaosEngine();

    // Track known device IDs (for chaos targeting)
    const knownDeviceIdsRef = useRef<Set<string>>(new Set());
    const [knownDeviceIds, setKnownDeviceIds] = useState<string[]>([]);

    // Keep simulation values accessible in the subscribe callback without re-subscribing
    const simRef = useRef({ disconnected, dropPercent, delayMs });
    useEffect(() => {
        simRef.current = { disconnected, dropPercent, delayMs };
    }, [disconnected, dropPercent, delayMs]);

    // Heartbeat: sync lastMessageAtRef → state every second
    useEffect(() => {
        const id = setInterval(() => {
            setLastMessageAt(lastMessageAtRef.current);
        }, 1_000);
        return () => clearInterval(id);
    }, []);

    // Periodically sync known device IDs to state (for chaos engine)
    useEffect(() => {
        const id = setInterval(() => {
            setKnownDeviceIds(Array.from(knownDeviceIdsRef.current));
        }, 5_000);
        return () => clearInterval(id);
    }, []);

    const connectionRef = useRef<mqtt.MqttClientConnection | null>(null);

    const pushMessage = useCallback((msg: TelemetryMsg) => {
        // Track device ID
        if (msg.device_id) {
            knownDeviceIdsRef.current.add(msg.device_id);
        }

        // Apply chaos mutations
        const chaos = chaosRef.current as ChaosState;
        const processed = applyChaos(
            msg,
            chaos,
            Array.from(knownDeviceIdsRef.current)
        );

        if (!processed) return; // chaos engine dropped this message

        const now = Date.now();
        lastMessageAtRef.current = now;
        setMessages((prev) => [processed as TelemetryMsg, ...prev].slice(0, BUFFER_SIZE));
    }, [chaosRef]);

    useEffect(() => {
        const region = import.meta.env.VITE_REGION as string;
        const endpoint = import.meta.env.VITE_IOT_ENDPOINT as string;
        const identityPoolId = import.meta.env
            .VITE_COGNITO_IDENTITY_POOL_ID as string;

        if (!region || !endpoint || !identityPoolId) {
            console.error(
                "[MqttProvider] Missing VITE_REGION / VITE_IOT_ENDPOINT / VITE_COGNITO_IDENTITY_POOL_ID"
            );
            return;
        }

        let cancelled = false;

        (async () => {
            const clientId =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? `streamlake-web-${crypto.randomUUID()}`
                    : `streamlake-web-${Math.random().toString(36).slice(2)}`;

            const awsCreds = fromCognitoIdentityPool({
                clientConfig: { region },
                identityPoolId,
            });
            const c = await awsCreds();
            if (cancelled) return;

            const builder =
                iot.AwsIotMqttConnectionConfigBuilder.new_builder_for_websocket()
                    .with_clean_session(true)
                    .with_client_id(clientId)
                    .with_endpoint(endpoint)
                    .with_credentials(
                        region,
                        c.accessKeyId!,
                        c.secretAccessKey!,
                        c.sessionToken ?? ""
                    )
                    .with_keep_alive_seconds(60);

            const config = builder.build();
            const client = new mqtt.MqttClient(new io.ClientBootstrap());
            const connection = client.new_connection(config);
            connectionRef.current = connection;

            try {
                await connection.connect();
                if (cancelled) {
                    await connection.disconnect().catch(() => { });
                    return;
                }
                setConnected(true);

                await connection.subscribe(
                    TOPIC,
                    mqtt.QoS.AtLeastOnce,
                    (_topic, payload) => {
                        const sim = simRef.current;

                        // Simulation: forced disconnect → silently drop
                        if (sim.disconnected) return;

                        // Simulation: random drop
                        if (sim.dropPercent > 0 && Math.random() * 100 < sim.dropPercent)
                            return;

                        try {
                            const text = new TextDecoder().decode(payload);
                            const parsed = JSON.parse(text) as TelemetryMsg;

                            // Extract device_id from topic if missing in payload
                            if (parsed.device_id == null) {
                                const parts = _topic.split("/");
                                parsed.device_id = parts[parts.length - 1];
                            }

                            const deliver = () => pushMessage(parsed);

                            // Simulation: artificial delay
                            if (sim.delayMs > 0) {
                                setTimeout(deliver, sim.delayMs);
                            } else {
                                deliver();
                            }
                        } catch {
                            // ignore malformed payloads
                        }
                    }
                );
            } catch (err) {
                console.error("[MqttProvider] connect/subscribe error:", err);
                setConnected(false);
            }
        })();

        return () => {
            cancelled = true;
            setConnected(false);
            const conn = connectionRef.current;
            connectionRef.current = null;
            if (conn) conn.disconnect().catch(() => { });
        };
    }, []); // single connection for the app lifetime

    // Simulation: update "connected" state when forced-disconnect toggles
    useEffect(() => {
        if (disconnected) {
            setConnected(false);
        } else if (connectionRef.current) {
            setConnected(true);
        }
    }, [disconnected]);

    const simulation: SimulationControls = {
        disconnected,
        dropPercent,
        delayMs,
        setDisconnected,
        setDropPercent,
        setDelayMs,
    };

    return (
        <MqttContext.Provider
            value={{ messages, connected, lastMessageAt, simulation, chaos: chaosControls, knownDeviceIds }}
        >
            {children}
        </MqttContext.Provider>
    );
}

/* ------------------------------------------------------------------ */
/*  Consumer hooks                                                    */
/* ------------------------------------------------------------------ */
export function useMqttContext(): MqttContextValue {
    const ctx = useContext(MqttContext);
    if (!ctx)
        throw new Error("useMqttContext must be used inside <MqttProvider>");
    return ctx;
}

export function useMqttMessages() {
    const { messages, connected, lastMessageAt, simulation } = useMqttContext();
    return { messages, connected, lastMessageAt, simulation };
}

export function useMqttSimulation() {
    return useMqttContext().simulation;
}

export function useMqttChaos() {
    return useMqttContext().chaos;
}
