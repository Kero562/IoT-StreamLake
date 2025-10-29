import { useState } from "react";

export type Device = {
  id: string;
  type: string;              
  icon?: string;             
  model?: string;            
  installed?: string;        
  status?: string;           
  readingLabel?: string;     
  readingValue?: string;     
  dataRate?: string;        
};

type Props = {
  resolveDevice?: (id: string) => Promise<Device | null> | Device | null;
};

export default function DeviceLookup({ resolveDevice }: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setNotFound(false);
    setDevice(null);
    setLoading(true);

    try {
      const trimmed = deviceId.trim().toUpperCase();
      if (!trimmed) {
        setLoading(false);
        return;
      }

      const result = resolveDevice
        ? await resolveDevice(trimmed)
        : null; // no fake data

      if (result) {
        setDevice(result);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setDevice(null);
    setNotFound(false);
    setDeviceId("");
  }

  return (
    <section className="bg-white rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
        <span className="mr-2">🔍</span>
        Device Lookup
      </h2>

      {/* Search form (hidden when a device is selected) */}
      {!device && (
        <div id="deviceSearchForm" className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">📱</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Enter Device ID
              </h3>
              <p className="text-sm text-gray-600">
                Search for specific device information and real-time data
              </p>
            </div>

            <form onSubmit={onSearch} className="space-y-4">
              <div>
                <label
                  htmlFor="deviceId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Device ID
                </label>
                <input
                  id="deviceId"
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="e.g., TEMP-001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white py-3 px-4 rounded-lg font-medium transition-all duration-150 transform active:scale-95"
              >
                {loading ? "Searching…" : "🔍 Search Device"}
              </button>
            </form>

            {notFound && (
              <p className="mt-4 text-sm text-red-600 text-center">
                Device not found. Double-check the ID.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Device details */}
      {device && (
        <div id="deviceDetails">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Device Information</h3>
              <button
                onClick={clearSearch}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                ← Back to Search
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className="text-4xl mb-3">{device.icon ?? "📱"}</div>
                  <h4 className="font-semibold text-gray-900 text-lg">
                    {device.type || "Device"}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">{device.id}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Model:</span>
                    <span className="font-medium">{device.model || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Installed:</span>
                    <span className="font-medium">{device.installed || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-3">Live Readings</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-gray-900">
                      {device.readingLabel || "Current Reading"}
                    </span>
                    <span className="font-bold text-blue-600 text-lg">
                      {device.readingValue || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className="font-medium text-green-600">
                      {device.status || "Online"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Data Rate:</span>
                    <span className="font-medium text-gray-900">
                      {device.dataRate || "0 KB/s"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Device Status banner */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3" />
              <span className="font-medium text-green-800">
                Device Status: {device.status || "Online"}
              </span>
              <span className="ml-auto text-sm text-green-600">
                Last update: Just now
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}