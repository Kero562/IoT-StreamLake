import { useEffect, useMemo, useRef, useState } from 'react';
import { useIotLive } from './useIotLive';

type TelemetryMsg = {
  device_id?: string;
  timestamp?: number | string;
  __arrival?: number;
  __topic?: string;
  __timestampMs?: number;
  [k: string]: unknown;
};

// normalize seconds/ISO -> ms
function toMs(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v > 1e12 ? v : Math.round(v * 1000);
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n > 1e12 ? n : Math.round(n * 1000);
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Counts UNIQUE devices seen in the last `windowMs` (default 5 minutes).
 * Uses a rolling Map so the count isn't capped by the message buffer size.
 */
export function useActiveDevices(
  windowMs = 5 * 60 * 1000,
  topic = 'sensors/telemetry/#',
  buffer = 200
) {
  const messages = useIotLive<TelemetryMsg>(topic, buffer);

  // steady ticking clock
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // last seen timestamp per device
  const lastSeenRef = useRef(new Map<string, number>());

  // ingest new messages and update last-seen
  useEffect(() => {
    for (const m of messages) {
      const topicParts = m.__topic?.split('/') ?? [];
      const topicId = topicParts[topicParts.length - 1]; // fallback if payload missing
      const id = m.device_id ?? topicId;
      if (!id) continue;

      const ts =
        m.__timestampMs ??
        toMs(m.timestamp) ??
        m.__arrival ??
        Date.now();

      const prev = lastSeenRef.current.get(id) ?? 0;
      if (ts > prev) lastSeenRef.current.set(id, ts);
    }
  }, [messages]);

  // expire devices outside the window and return count
  const active = useMemo(() => {
    const cutoff = now - windowMs;
    for (const [id, ts] of Array.from(lastSeenRef.current)) {
      if (ts < cutoff) lastSeenRef.current.delete(id);
    }
    return lastSeenRef.current.size;
  }, [now, windowMs]);

  return active;
}
