import { useState } from "react";
import { useMqttSimulation, useMqttChaos } from "../providers/MqttProvider";

function isSimEnabled(): boolean {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("sim") === "1";
}

export default function SimulationPanel() {
    const sim = useMqttSimulation();
    const chaos = useMqttChaos();
    const [collapsed, setCollapsed] = useState(false);

    if (!isSimEnabled()) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80">
            <div className="bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
                {/* Header */}
                <button
                    type="button"
                    onClick={() => setCollapsed((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors"
                >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                        🧪 Simulation Controls
                        {chaos.enabled && (
                            <span className="px-1.5 py-0.5 bg-red-500 text-[10px] rounded-full font-bold animate-pulse">
                                CHAOS
                            </span>
                        )}
                    </span>
                    <span className="text-xs text-gray-400">
                        {collapsed ? "▲ Expand" : "▼ Collapse"}
                    </span>
                </button>

                {!collapsed && (
                    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* ===== Network Simulation ===== */}
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                            Network Simulation
                        </div>

                        {/* Force Disconnect */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-300">Force Disconnect</span>
                            <input
                                type="checkbox"
                                checked={sim.disconnected}
                                onChange={(e) => sim.setDisconnected(e.target.checked)}
                                className="w-5 h-5 rounded accent-red-500"
                            />
                        </label>

                        {/* Drop Percent */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300">Message Drop</span>
                                <span className="text-yellow-400 font-mono">
                                    {sim.dropPercent}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={sim.dropPercent}
                                onChange={(e) => sim.setDropPercent(Number(e.target.value))}
                                className="w-full accent-yellow-500"
                            />
                        </div>

                        {/* Delay */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-300">Artificial Delay</span>
                                <span className="text-blue-400 font-mono">
                                    {sim.delayMs} ms
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={5000}
                                step={100}
                                value={sim.delayMs}
                                onChange={(e) => sim.setDelayMs(Number(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                        </div>

                        {/* ===== Divider ===== */}
                        <hr className="border-gray-700" />

                        {/* ===== Chaos Engineering ===== */}
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                            🔥 Chaos Engineering
                        </div>

                        {/* Master switch */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-300">Enable Chaos</span>
                            <input
                                type="checkbox"
                                checked={chaos.enabled}
                                onChange={(e) => chaos.setEnabled(e.target.checked)}
                                className="w-5 h-5 rounded accent-red-500"
                            />
                        </label>

                        {chaos.enabled && (
                            <div className="space-y-3 pl-2 border-l-2 border-red-500/30">
                                {/* Demo Mode */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <span className="text-sm text-gray-300">Demo Mode</span>
                                        <p className="text-[10px] text-gray-500">Auto-cycles chaos scenarios</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={chaos.demoMode}
                                        onChange={(e) => chaos.setDemoMode(e.target.checked)}
                                        className="w-5 h-5 rounded accent-orange-500"
                                    />
                                </label>

                                {chaos.demoMode && (
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-400">Cycle Interval</span>
                                            <span className="text-orange-400 font-mono text-xs">
                                                {chaos.demoIntervalSec}s
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10}
                                            max={120}
                                            step={5}
                                            value={chaos.demoIntervalSec}
                                            onChange={(e) => chaos.setDemoIntervalSec(Number(e.target.value))}
                                            className="w-full accent-orange-500"
                                        />
                                    </div>
                                )}

                                <hr className="border-gray-700/50" />

                                {/* Device Dropout */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-gray-300">📴 Device Dropout</span>
                                    <input
                                        type="checkbox"
                                        checked={chaos.deviceDropout}
                                        onChange={(e) => chaos.setDeviceDropout(e.target.checked)}
                                        className="w-5 h-5 rounded accent-purple-500"
                                    />
                                </label>
                                {chaos.deviceDropout && (
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-400">Devices Affected</span>
                                            <span className="text-purple-400 font-mono text-xs">
                                                {chaos.dropoutPercent}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={80}
                                            step={5}
                                            value={chaos.dropoutPercent}
                                            onChange={(e) => chaos.setDropoutPercent(Number(e.target.value))}
                                            className="w-full accent-purple-500"
                                        />
                                    </div>
                                )}

                                {/* Sensor Spike */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-gray-300">📈 Sensor Spike</span>
                                    <input
                                        type="checkbox"
                                        checked={chaos.sensorSpike}
                                        onChange={(e) => chaos.setSensorSpike(e.target.checked)}
                                        className="w-5 h-5 rounded accent-amber-500"
                                    />
                                </label>
                                {chaos.sensorSpike && (
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-400">Spike Interval</span>
                                            <span className="text-amber-400 font-mono text-xs">
                                                Every {chaos.spikeIntervalSec}s
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={3}
                                            max={60}
                                            step={1}
                                            value={chaos.spikeIntervalSec}
                                            onChange={(e) => chaos.setSpikeIntervalSec(Number(e.target.value))}
                                            className="w-full accent-amber-500"
                                        />
                                    </div>
                                )}

                                {/* Fleet Degradation */}
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-gray-300">⚡ Fleet Degradation</span>
                                    <input
                                        type="checkbox"
                                        checked={chaos.fleetDegradation}
                                        onChange={(e) => chaos.setFleetDegradation(e.target.checked)}
                                        className="w-5 h-5 rounded accent-rose-500"
                                    />
                                </label>
                                {chaos.fleetDegradation && (
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-400">Speed</span>
                                            <span className="text-rose-400 font-mono text-xs">
                                                {chaos.degradationSpeed}x
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1}
                                            max={5}
                                            step={1}
                                            value={chaos.degradationSpeed}
                                            onChange={(e) => chaos.setDegradationSpeed(Number(e.target.value))}
                                            className="w-full accent-rose-500"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reset */}
                        <button
                            type="button"
                            onClick={() => {
                                sim.setDisconnected(false);
                                sim.setDropPercent(0);
                                sim.setDelayMs(0);
                                chaos.resetAll();
                            }}
                            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                        >
                            Reset All
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
