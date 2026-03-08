import { useEffect, useRef, useState } from "react";
import type { Alert, AlertCategory, AlertSeverity } from "../hooks/useAlerts";

const PREFS_KEY = "iot-streamlake-alert-prefs";

type PanelPrefs = { activeTab: string };

type TabKey = "all" | AlertSeverity | "resolved";

type Props = {
  alerts: Alert[];
  acknowledge: (id: string) => void;
  dismiss: (id: string) => void;
  clearHistory: () => void;
  open: boolean;
  onClose: () => void;
};

function loadPrefs(): PanelPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as PanelPrefs) : { activeTab: "all" };
  } catch {
    return { activeTab: "all" };
  }
}

function savePrefs(prefs: PanelPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore localStorage failures.
  }
}

const SEV = {
  critical: {
    icon: "[!]",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    badge: "bg-red-100 text-red-700",
  },
  warning: {
    icon: "[~]",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    badge: "bg-yellow-100 text-yellow-700",
  },
  info: {
    icon: "[i]",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-700",
  },
} as const;

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  connection: "Connection",
  stream: "Stream",
  sensor: "Sensor",
  device: "Device",
  fleet: "Fleet",
  simulation: "Simulation",
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAgo(ms: number): string {
  const sec = Math.round((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s ago`;
}

export default function AlertsPanel({
  alerts,
  acknowledge,
  dismiss,
  clearHistory,
  open,
  onClose,
}: Props) {
  const prefs = useRef(loadPrefs());
  const [activeTab, setActiveTab] = useState<TabKey>(
    prefs.current.activeTab as TabKey
  );
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    prefs.current.activeTab = activeTab;
    savePrefs(prefs.current);
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const id = setTimeout(() => window.addEventListener("mousedown", onMouseDown), 100);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  const active = alerts.filter((a) => !a.resolvedAt);
  const resolved = alerts.filter((a) => a.resolvedAt);

  const criticalCount = active.filter((a) => a.severity === "critical").length;
  const warningCount = active.filter((a) => a.severity === "warning").length;
  const infoCount = active.filter((a) => a.severity === "info").length;

  const filtered = (() => {
    let pool: Alert[];
    switch (activeTab) {
      case "critical":
        pool = active.filter((a) => a.severity === "critical");
        break;
      case "warning":
        pool = active.filter((a) => a.severity === "warning");
        break;
      case "info":
        pool = active.filter((a) => a.severity === "info");
        break;
      case "resolved":
        pool = resolved;
        break;
      default:
        pool = active;
    }

    if (!search.trim()) return pool;

    const q = search.toLowerCase();
    return pool.filter(
      (a) =>
        a.message.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        Boolean(a.deviceId && a.deviceId.toLowerCase().includes(q))
    );
  })();

  const tabs: { key: TabKey; label: string; count?: number; color?: string }[] = [
    { key: "all", label: "All", count: active.length },
    { key: "critical", label: "Critical", count: criticalCount, color: "text-red-600" },
    { key: "warning", label: "Warning", count: warningCount, color: "text-yellow-600" },
    { key: "info", label: "Info", count: infoCount, color: "text-blue-600" },
    { key: "resolved", label: "History", count: resolved.length, color: "text-gray-500" },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Alerts Panel"
        className={`
          fixed z-50 bg-white shadow-2xl transition-transform duration-300 ease-out
          inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh]
          md:inset-y-0 md:right-0 md:left-auto md:bottom-auto
          md:w-[420px] md:rounded-t-none md:rounded-l-2xl md:max-h-full
          ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}
        `}
      >
        <div className="flex flex-col h-full max-h-[85vh] md:max-h-screen">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Alerts</h2>
              <div className="flex gap-2 mt-1 text-xs">
                {criticalCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                    Critical {criticalCount}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                    Warning {warningCount}
                  </span>
                )}
                {infoCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                    Info {infoCount}
                  </span>
                )}
                {active.length === 0 && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                    All clear
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              aria-label="Close alerts panel"
            >
              X
            </button>
          </div>

          <div className="shrink-0 border-b border-gray-100 bg-white px-4 pt-3 pb-3">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className={isActive ? "text-gray-300" : tab.color ?? "text-gray-400"}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 pt-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter alerts..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="relative z-0 min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500 font-medium">
                  {activeTab === "resolved" ? "No alert history" : "All systems nominal"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {activeTab === "resolved"
                    ? "Resolved alerts appear here"
                    : "No active alerts to display"}
                </p>
              </div>
            )}

            {filtered.map((alert) => {
              const cfg = SEV[alert.severity];
              const isResolved = Boolean(alert.resolvedAt);

              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-3 transition-all duration-300 ${
                    isResolved ? "opacity-50" : ""
                  } ${cfg.bg} ${cfg.border}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{isResolved ? "[ok]" : cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isResolved ? "line-through" : ""} ${cfg.text}`}>
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {CATEGORY_LABELS[alert.category]}
                        </span>
                        {alert.deviceId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">
                            {alert.deviceId}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {formatTime(alert.triggeredAt)} | {formatAgo(alert.triggeredAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isResolved && (
                    <div className="flex gap-2 mt-2 ml-6">
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => acknowledge(alert.id)}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.acknowledged && (
                        <span className="text-[11px] px-2.5 py-1 text-green-600 font-medium">
                          Acknowledged
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => dismiss(alert.id)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {isResolved && alert.resolvedAt && (
                    <p className="text-[10px] text-green-600 mt-1.5 ml-6 font-medium">
                      Resolved at {formatTime(alert.resolvedAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {activeTab === "resolved" && resolved.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={clearHistory}
                className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                Clear History
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
