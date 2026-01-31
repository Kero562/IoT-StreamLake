import Header from "./components/Header";
import KpiCard from "./components/Kpicard";
import LiveSensorReadings from "./components/LiveSensorReadings";
import DeviceLookup from "./components/DeviceLookup";
import { useActiveDevices } from "./hooks/useActiveDevices";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DebugIot from "./components/DebugIot";

export default function App() {

  const active = useActiveDevices(5 * 60 * 1000);

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
            value="1.2 GB/s"
            subtitle="Real-time streaming"
            icon={<span role="img" aria-label="bolt">⚡</span>}
          />

          <KpiCard
            title="System Health"
            value="98%"
            subtitle="All systems operational"
            valueClassName="text-green-300"
            icon={<span role="img" aria-label="system health good">💚</span>}
            //icon={<span role="img" aria-label="system health warning">🟡</span>}
            //icon={<span role="img" aria-label="system health critical">🔴</span>}
          />

          <KpiCard
            title="Alerts"
            value="0"
            subtitle="placeholder"
            icon={<span role="img" aria-label="alert">⚠️</span>}
          />
        </div>
      </main>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LiveSensorReadings />

        <div className="self-center">
          <DeviceLookup />
        </div>
        
      </div>
      {/* <DebugIot /> */}
    </div>
  
  )
}
