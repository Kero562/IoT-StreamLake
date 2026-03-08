import { useState } from "react";

import Header from "./components/Header";
import KpiCard from "./components/Kpicard";
import LiveSensorReadings from "./components/LiveSensorReadings";
import DeviceLookup from "./components/DeviceLookup";
import AlertsPanel from "./components/AlertsPanel";
import SimulationPanel from "./components/SimulationPanel";

import { useActiveDevices } from "./hooks/useActiveDevices";
import { useThroughput } from "./hooks/useThroughput";
import { useSystemHealth } from "./hooks/useSystemHealth";
import { useAlerts } from "./hooks/useAlerts";
import { useDeviceIndex } from "./hooks/useDeviceIndex";
import { useDeviceHealth } from "./hooks/useDeviceHealth";
import { useMqttMessages } from "./providers/MqttProvider";

export default function App() {
  // ---- shared data ----
  const { messages } = useMqttMessages();
  const active = useActiveDevices(5 * 60 * 1000);
  const { label: throughputLabel } = useThroughput(5000);
  const deviceHealth = useDeviceHealth();
  const health = useSystemHealth(15000, 5000, deviceHealth.fleetHealthPercent);
  const { alerts, acknowledge, dismiss, clearHistory } = useAlerts(
    deviceHealth.deviceStatuses,
    deviceHealth.fleetHealthPercent
  );
  const { resolve: resolveDevice } = useDeviceIndex();

  // ---- Alerts panel state ----
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  // ---- latest sensor readings ----
  const latest = messages[0] ?? null;
  const temperature =
    latest && typeof latest.temperature === "number" ? latest.temperature : null;
  const humidity =
    latest && typeof latest.humidity === "number" ? latest.humidity : null;

  // Energy: use payload value if available, otherwise estimate from temperature
  const rawEnergy =
    latest && typeof latest.energy === "number" ? latest.energy : null;
  const energyEstimated = rawEnergy == null && temperature != null;
  // Estimate: temperature * 0.12  (documented approximation)
  const energy = rawEnergy ?? (temperature != null ? +(temperature * 0.12).toFixed(2) : null);

  // ---- health icon logic ----
  let healthIcon: React.ReactNode;
  if (health.healthPercent >= 90) {
    healthIcon = <span role="img" aria-label="healthy">💚</span>;
  } else if (health.healthPercent >= 30) {
    healthIcon = <span role="img" aria-label="degraded">🟡</span>;
  } else {
    healthIcon = <span role="img" aria-label="critical">🔴</span>;
  }

  // ---- alert count ----
  const activeAlertCount = alerts.filter((a) => !a.resolvedAt).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Active Devices"
            value={String(active)}
            icon={<span role="img" aria-label="devices">📱</span>}
            variant="gradient"
          />

          <KpiCard
            title="Data Throughput"
            value={throughputLabel}
            subtitle="Real-time streaming"
            icon={<span role="img" aria-label="bolt">⚡</span>}
          />

          <KpiCard
            title="System Health"
            value={`${health.healthPercent}%`}
            subtitle={health.statusText}
            valueClassName={health.valueClassName}
            icon={healthIcon}
          />

          {/* Alerts KPI — clickable to open the panel */}
          <button
            type="button"
            onClick={() => setAlertsPanelOpen(true)}
            className="text-left w-full"
          >
            <KpiCard
              title="Alerts"
              value={String(activeAlertCount)}
              subtitle={
                activeAlertCount === 0
                  ? "No active alerts"
                  : `${activeAlertCount} active — tap to view`
              }
              valueClassName={
                activeAlertCount > 0 ? "text-red-500" : undefined
              }
              icon={<span role="img" aria-label="alert">⚠️</span>}
            />
          </button>
        </div>
      </main>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 pb-8">
        <LiveSensorReadings
          temperature={temperature}
          humidity={humidity}
          energy={energy}
          energyEstimated={energyEstimated}
        />

        <div className="self-center">
          <DeviceLookup resolveDevice={resolveDevice} />
        </div>
      </div>

      {/* Alerts slide-out panel (replaces AlertsBanner) */}
      <AlertsPanel
        alerts={alerts}
        acknowledge={acknowledge}
        dismiss={dismiss}
        clearHistory={clearHistory}
        open={alertsPanelOpen}
        onClose={() => setAlertsPanelOpen(false)}
      />

      <SimulationPanel />
    </div>
  );
}
