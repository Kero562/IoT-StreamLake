import type { Alert } from "../hooks/useAlerts";

const SEVERITY_CONFIG = {
    critical: {
        icon: "🔴",
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-800",
        badge: "bg-red-100 text-red-700",
    },
    warning: {
        icon: "🟡",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        text: "text-yellow-800",
        badge: "bg-yellow-100 text-yellow-700",
    },
    info: {
        icon: "🔵",
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-800",
        badge: "bg-blue-100 text-blue-700",
    },
};

function formatTime(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type Props = {
    alerts: Alert[];
};

export default function AlertsBanner({ alerts }: Props) {
    const active = alerts.filter((a) => !a.resolvedAt);
    const resolving = alerts.filter((a) => a.resolvedAt);

    if (alerts.length === 0) return null;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
            <div className="space-y-2">
                {active.map((alert) => {
                    const cfg = SEVERITY_CONFIG[alert.severity];
                    return (
                        <div
                            key={alert.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${cfg.bg} ${cfg.border} transition-all duration-300`}
                        >
                            <span className="text-lg">{cfg.icon}</span>
                            <div className="flex-1">
                                <span className={`text-sm font-medium ${cfg.text}`}>
                                    {alert.message}
                                </span>
                            </div>
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}
                            >
                                {alert.severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">
                                {formatTime(alert.triggeredAt)}
                            </span>
                        </div>
                    );
                })}
                {resolving.map((alert) => {
                    const cfg = SEVERITY_CONFIG[alert.severity];
                    return (
                        <div
                            key={alert.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border opacity-50 ${cfg.bg} ${cfg.border} transition-opacity duration-1000`}
                        >
                            <span className="text-lg">✅</span>
                            <div className="flex-1">
                                <span className={`text-sm ${cfg.text} line-through`}>
                                    {alert.message}
                                </span>
                            </div>
                            <span className="text-xs text-green-600 font-medium">
                                Resolved
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
