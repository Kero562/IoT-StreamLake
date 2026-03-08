import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LiveSensorReadings from "../../components/LiveSensorReadings";

describe("LiveSensorReadings", () => {
    it("renders section with heading and status labels for valid values", () => {
        const { container } = render(
            <LiveSensorReadings
                temperature={24.5}
                humidity={55}
                energy={2.94}
                energyEstimated={false}
            />
        );

        // Section must exist
        expect(container.querySelector("section")).toBeTruthy();

        // Heading
        expect(container.innerHTML).toContain("Live Sensor Readings");

        // Status labels for in-range values
        expect(container.innerHTML).toContain("Normal");     // temperature 24.5 is normal
        expect(container.innerHTML).toContain("Optimal");    // humidity 55 is optimal
        expect(container.innerHTML).toContain("Efficient");  // energy 2.94 is efficient

        // Progress bars exist (style width > 0%)
        const bars = container.querySelectorAll('[style*="width"]');
        expect(bars.length).toBeGreaterThanOrEqual(3);
        // At least one bar should have width > 0
        const hasNonZero = Array.from(bars).some((b) => {
            const w = (b as HTMLElement).style.width;
            return w && w !== "0%";
        });
        expect(hasNonZero).toBe(true);
    });

    it("renders dash for null values", () => {
        const { container } = render(
            <LiveSensorReadings
                temperature={null}
                humidity={null}
                energy={null}
                energyEstimated={false}
            />
        );

        const html = container.innerHTML;
        // At least 3 em-dashes (U+2014) for the 3 missing values
        expect((html.match(/\u2014/g) ?? []).length).toBeGreaterThanOrEqual(3);
    });

    it("shows estimated label for energy", () => {
        const { container } = render(
            <LiveSensorReadings
                temperature={22}
                humidity={50}
                energy={2.64}
                energyEstimated={true}
            />
        );

        expect(container.innerHTML).toContain("est.");
    });

    it("shows No data status for missing readings", () => {
        const { container } = render(
            <LiveSensorReadings
                temperature={null}
                humidity={null}
                energy={null}
                energyEstimated={false}
            />
        );

        const html = container.innerHTML;
        const noDataCount = (html.match(/No data/g) ?? []).length;
        expect(noDataCount).toBe(3);
    });
});
