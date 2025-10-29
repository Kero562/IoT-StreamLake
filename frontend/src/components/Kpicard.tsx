import type { ReactNode } from "react";
import clsx from "clsx";

type Props = {
    title: string;
    value: string;
    subtitle?: string;
    icon?: ReactNode;
    valueClassName?: string;
    variant?: "white" | "gradient";
}

export default function KpiCard({
    title,
    value,
    subtitle,
    icon,
    valueClassName,
    variant = "white",
}: Props) {
    const isGradient = variant === "gradient";

    return (
        <div 
        className={clsx(
            "rounded-xl p-6 transition-transform duration-300 ease-out",
            isGradient
            ? "metric-card-bg text-white hover:-translate-y-1 hover:shadow-2xl"
            : "bg-white shadow-lg hover:-translate-y-1"
        )}
        >
        
        <div className="flex items-center justify-between">
            <div>
                <p className={clsx("text-sm font-medium", isGradient ? "text-blue-100" : "text-gray-600")}>
                    {title}
                </p>

                <p className={clsx("text-3xl font-bold", valueClassName ?? (isGradient ? "" : "text-gray-900"))}>
                    {value}
                </p>
            </div>

            <div className={clsx("text-4xl", isGradient && "opacity-80")}>
                {icon}
            </div>
        </div>

        {subtitle && (
            <div className="mt-4">
                <span className={clsx("text-sm", isGradient ? "text-green-300" : "text-blue-600")}>
                    {subtitle}
                </span>
            </div>
        )}

        </div>
    )
}