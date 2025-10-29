import { useState } from "react";
import clsx from "clsx";

type HeaderProps = {
    title?: string;
}

export default function Header({ title= "🌊 Streamlake IoT"}: HeaderProps) {
    const [pressed, setPressed] = useState(false);

    const handleSettingsClick = () => {
        setPressed(true);
        setTimeout(() => setPressed(false), 150);
    }
    
    return (
        <header className="bg-white shadow-sm border-b border-gray-100"> {/* Header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> {/* Centered page container + side paddings */}
                <div className="flex justify-between items-center h-16"> {/* Header row: left/right groups, 64px tall */}
                    
                    <div className="flex items-center"> {/* Left group */}
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                            Subscriber Dashboard
                        </span>
                    </div>

                    <div className="flex items-center space-x-4">  {/* Right group */}
                        <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulseSoft" />
                            <span className="text-sm text-gray-600">Live Data</span>
                        </div>

                    <button
                        type="button"
                        aria-label="Open settings"
                        onClick={handleSettingsClick}
                        className={clsx(
                            "text-white px-4 py-2 rounded-lg text-sm font-medium",
                            "transition-all duration-150 transform",
                            pressed ? "bg-blue-800 scale-90" : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                        )}
                        >
                        Settings
                    </button>
                    </div>
                </div>
            </div>
        </header>
    )
}