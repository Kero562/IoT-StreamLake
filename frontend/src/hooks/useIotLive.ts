import { useEffect, useRef, useState } from 'react';
import { mqtt, io, iot } from 'aws-iot-device-sdk-v2';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

type AnyObj = Record<string, unknown>;

function safeParse(text: string): AnyObj | { raw: string } {
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === 'object' ? (obj as AnyObj) : { raw: text };
  } catch {
    return { raw: text };
  }
}

export function useIotLive<T = unknown>(topic: string, buffer = 200): T[] {
  const [messages, setMessages] = useState<T[]>([]);
  const connectionRef = useRef<mqtt.MqttClientConnection | null>(null);

  useEffect(() => {
    const region = import.meta.env.VITE_REGION as string;
    const endpoint = import.meta.env.VITE_IOT_ENDPOINT as string;
    const identityPoolId = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID as string;

    if (!region || !endpoint || !identityPoolId) {
      console.error('Missing VITE_REGION / VITE_IOT_ENDPOINT / VITE_COGNITO_IDENTITY_POOL_ID');
      return;
    }

    let cancelled = false;

    (async () => {
      // Stable-enough client id per tab load
      const clientId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `streamlake-web-${crypto.randomUUID()}`
          : `streamlake-web-${Math.random().toString(36).slice(2)}`;

      // 1) Get Cognito creds
      const awsCreds = fromCognitoIdentityPool({
        clientConfig: { region },
        identityPoolId,
      });
      const c = await awsCreds();
      if (cancelled) return;

      // 2) Configure MQTT over WebSockets with SigV4 (browser: pass raw creds)
      const builder = iot.AwsIotMqttConnectionConfigBuilder.new_builder_for_websocket()
        .with_clean_session(true)
        .with_client_id(clientId)
        .with_endpoint(endpoint)
        .with_credentials(
          region,
          c.accessKeyId!,
          c.secretAccessKey!,
          c.sessionToken ?? ''
        )
        .with_keep_alive_seconds(60);

      const config = builder.build();

      const client = new mqtt.MqttClient(new io.ClientBootstrap());
      const connection = client.new_connection(config);
      connectionRef.current = connection;

      try {
        // 3) Connect + subscribe
        await connection.connect();
        if (cancelled) {
          await connection.disconnect().catch(() => {});
          return;
        }

        await connection.subscribe(
          topic,
          mqtt.QoS.AtLeastOnce,
          (_topic, payload) => {
            try {
              const text = new TextDecoder().decode(payload);
              const parsed = safeParse(text);

              // Extract device id from payload first; fall back to topic segment (last part)
              const topicParts = _topic.split('/');
              const topicDeviceId =
                topicParts.length > 0 ? topicParts[topicParts.length - 1] : undefined;

              const payloadDeviceId = (parsed as AnyObj)['device_id'] as string | undefined;

              // If the payload lacks device_id, set it from the topic
              if (payloadDeviceId == null && topicDeviceId) {
                (parsed as AnyObj)['device_id'] = topicDeviceId;
              }

              // prepend newest; [newMsg, ...prev]
              setMessages((prev) => [parsed as unknown as T, ...prev].slice(0, buffer));
            } catch {
              // ignore malformed payloads
            }
          }
        );
      } catch (err) {
        console.error('IoT connection/subscribe error:', err);
      }

      if (cancelled && connectionRef.current) {
        try {
          await connectionRef.current.disconnect();
        } catch {
          /* noop */
        }
      }
    })();

    return () => {
      cancelled = true;
      const conn = connectionRef.current;
      connectionRef.current = null;
      if (conn) {
        // fire & forget to avoid blocking unmount
        conn.disconnect().catch(() => {});
      }
    };
  }, [topic, buffer]);

  return messages;
}
