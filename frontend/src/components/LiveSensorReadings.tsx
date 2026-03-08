type Props = {
  temperature: number | null;
  humidity: number | null;
  energy: number | null;
  energyEstimated: boolean;
};

function tempStatus(v: number | null): { label: string; className: string } {
  if (v == null) return { label: "No data", className: "text-gray-400" };
  if (v > 40) return { label: "Critical", className: "text-red-600" };
  if (v > 35) return { label: "High", className: "text-orange-600" };
  if (v < 5) return { label: "Low", className: "text-blue-600" };
  return { label: "Normal", className: "text-green-600" };
}

function humidityStatus(v: number | null): { label: string; className: string } {
  if (v == null) return { label: "No data", className: "text-gray-400" };
  if (v > 80) return { label: "High", className: "text-orange-600" };
  if (v < 25) return { label: "Low", className: "text-yellow-600" };
  return { label: "Optimal", className: "text-green-600" };
}

function energyStatus(v: number | null): { label: string; className: string } {
  if (v == null) return { label: "No data", className: "text-gray-400" };
  if (v > 4) return { label: "High", className: "text-red-600" };
  if (v > 3) return { label: "Moderate", className: "text-yellow-600" };
  return { label: "Efficient", className: "text-green-600" };
}

function pct(value: number | null, max: number): number {
  if (value == null || !isFinite(value)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function fmt(value: number | null, unit: string, decimals = 1): string {
  if (value == null) return "—";
  return `${value.toFixed(decimals)}${unit}`;
}

export default function LiveSensorReadings({
  temperature,
  humidity,
  energy,
  energyEstimated,
}: Props) {
  const tStatus = tempStatus(temperature);
  const hStatus = humidityStatus(humidity);
  const eStatus = energyStatus(energy);

  return (
    <section className="bg-white rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-600 mb-6 flex items-center">
        <span className="mr-2">📊</span>
        Live Sensor Readings
      </h2>

      <div className="space-y-6">
        {/* Temperature */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🌡️</span>
              <h3 className="font-semibold text-gray-900">Temperature</h3>
            </div>
            <div className="text-right">
              <div
                className="text-2xl font-bold text-orange-600"
                aria-live="polite"
              >
                {fmt(temperature, "°C")}
              </div>
              <div className={`text-sm ${tStatus.className}`}>
                {tStatus.label}
              </div>
            </div>
          </div>
          <div
            className="w-full bg-gray-200 rounded-full h-2"
            aria-hidden="true"
          >
            <div
              className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct(temperature, 50)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0°C</span>
            <span>50°C</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="text-2xl mr-3">💧</span>
              <h3 className="font-semibold text-gray-900">Humidity</h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {fmt(humidity, "%", 0)}
              </div>
              <div className={`text-sm ${hStatus.className}`}>
                {hStatus.label}
              </div>
            </div>
          </div>
          <div
            className="w-full bg-gray-200 rounded-full h-2"
            aria-hidden="true"
          >
            <div
              className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct(humidity, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Energy Usage */}
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-lg border border-cyan-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="text-2xl mr-3">⚡</span>
              <h3 className="font-semibold text-gray-900">
                Energy Usage
                {energyEstimated && (
                  <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    est.
                  </span>
                )}
              </h3>
            </div>
            <div className="text-right">
              <div
                className="text-2xl font-bold text-cyan-600"
                aria-live="polite"
              >
                {fmt(energy, " kW")}
              </div>
              <div className={`text-sm ${eStatus.className}`}>
                {eStatus.label}
              </div>
            </div>
          </div>
          <div
            className="w-full bg-gray-200 rounded-full h-2"
            aria-hidden="true"
          >
            <div
              className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct(energy, 5)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 kW</span>
            <span>5 kW</span>
          </div>
        </div>
      </div>
    </section>
  );
}
