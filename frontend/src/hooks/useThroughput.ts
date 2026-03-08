import { useEffect, useRef, useState } from "react";
import { useMqttMessages } from "../providers/MqttProvider";
import type { TelemetryMsg } from "../types/telemetry";

type BytePoint = { t: number; bytes: number };

function formatBps(bps: number) {
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let v = bps;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function useThroughput(windowMs: number = 5000) {
  const { messages, lastMessageAt } = useMqttMessages();

  const [bps, setBps] = useState(0);
  const [label, setLabel] = useState("0 B/s");
  const [lastMessageAgeMs, setLastMessageAgeMs] = useState<number>(
    Number.POSITIVE_INFINITY
  );

  const pointsRef = useRef<BytePoint[]>([]);
  const prevHeadRef = useRef<TelemetryMsg | null>(null);

  // Track byte points as new messages arrive.
  // We cannot rely on buffer length because it caps at 500.
  useEffect(() => {
    if (messages.length === 0) {
      prevHeadRef.current = null;
      return;
    }

    const previousHead = prevHeadRef.current;
    let added = 0;

    if (!previousHead) {
      added = Math.min(messages.length, 50);
    } else {
      while (
        added < messages.length &&
        added < 50 &&
        messages[added] !== previousHead
      ) {
        added++;
      }

      if (added === messages.length) {
        // Previous head is no longer in buffer (rollover/reset),
        // so treat the visible slice as newly observed.
        added = Math.min(messages.length, 50);
      }
    }

    if (added > 0) {
      const now = Date.now();
      for (let i = 0; i < Math.min(added, 50); i++) {
        const msg = messages[i];
        const bytes = msg ? JSON.stringify(msg).length : 80;
        pointsRef.current.push({ t: now, bytes });
      }

      const cutoff = now - windowMs;
      while (pointsRef.current.length && pointsRef.current[0].t < cutoff) {
        pointsRef.current.shift();
      }
    }

    prevHeadRef.current = messages[0] ?? null;
  }, [messages, windowMs]);

  // Periodic recalculate
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const cutoff = now - windowMs;
      const arr = pointsRef.current;
      while (arr.length && arr[0].t < cutoff) arr.shift();

      const totalBytes = arr.reduce((sum, p) => sum + p.bytes, 0);
      const windowSeconds = windowMs / 1000;
      const currentBps = windowSeconds > 0 ? totalBytes / windowSeconds : 0;

      setBps(currentBps);
      setLabel(formatBps(currentBps));
      setLastMessageAgeMs(
        lastMessageAt ? now - lastMessageAt : Number.POSITIVE_INFINITY
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [windowMs, lastMessageAt]);

  return { bps, label, lastMessageAgeMs };
}
