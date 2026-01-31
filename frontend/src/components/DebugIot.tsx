import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIotLive } from '../hooks/useIotLive';

type TelemetryMsg = {
  device_id: string;
  timestamp: number | string;
  temperature?: number;
  humidity?: number;
  __arrival?: number; // added by useIotLive
  __topic?: string;   // added by useIotLive
};

export default function DebugIot() {
  // Subscribe to your telemetry stream. Buffer size here doesn't cap the totals,
  // because we accumulate into a Set below.
  const msgs = useIotLive<TelemetryMsg>('sensors/telemetry/#', 2000);

  // Accumulate unique device_ids since mount
  const allIdsRef = useRef<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [since, setSince] = useState(() => Date.now());

  useEffect(() => {
    let changed = false;
    for (const m of msgs) {
      const id = m?.device_id;
      if (!id) continue;
      if (!allIdsRef.current.has(id)) {
        allIdsRef.current.add(id);
        changed = true;
      }
    }
    if (changed) setTotal(allIdsRef.current.size);
  }, [msgs]);

  const elapsedSec = Math.max(1, Math.round((Date.now() - since) / 1000));
  const ratePerSec = Math.round(total / elapsedSec);
  const sampleIds = useMemo(() => Array.from(allIdsRef.current).slice(0, 20), [total]);

  const reset = () => {
    allIdsRef.current.clear();
    setTotal(0);
    setSince(Date.now());
  };

  return (
    <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>IoT Debug — Raw Uniques Since Mount</div>
        <button onClick={reset} style={{ padding: '4px 8px', fontSize: 12 }}>Reset</button>
      </div>

      <p style={{ margin: '4px 0 8px' }}>
        Total unique <code>device_id</code>s: <strong>{total}</strong> • Elapsed: {elapsedSec}s • ~{ratePerSec}/s
      </p>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
        Sample (first 20): {sampleIds.length ? sampleIds.join(', ') : '—'}
      </div>

      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Last {msgs.length} messages (topic = "sensors/telemetry/#")
      </div>
      <pre style={{ maxHeight: 280, overflow: 'auto', fontSize: 12, lineHeight: 1.4, margin: 0 }}>
        {JSON.stringify(msgs, null, 2)}
      </pre>
    </div>
  );
}
