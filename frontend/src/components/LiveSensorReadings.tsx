export default function LiveSensorReadings() {
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
              <div className="text-2xl font-bold text-orange-600" aria-live="polite">
                0.0°C
              </div>
              <div className="text-sm text-gray-500">Normal</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2" aria-hidden="true">
            <div
              className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
              style={{ width: "0%" }}
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
              <div className="text-2xl font-bold text-blue-600">0%</div>
              <div className="text-sm text-gray-500">Optimal</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2" aria-hidden="true">
            <div
              className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full"
              style={{ width: "0%" }}
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
                <h3 className="font-semibold text-gray-900">Energy Usage</h3>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-600" aria-live="polite">
                0.0 kW
              </div>
              <div className="text-sm text-gray-500">Efficient</div>
            </div>

          </div>

          <div className="w-full bg-gray-200 rounded-full h-2" aria-hidden="true">
            <div
              className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full"
              style={{ width: "0%" }}
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
