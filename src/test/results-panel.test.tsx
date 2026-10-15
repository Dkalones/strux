import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsPanel } from "@/components/strux/results-panel";
import { analyzeBeam } from "@/lib/structural";

describe("structural diagram labels", () => {
  it("does not label every sample of constant shear and axial-force segments", () => {
    const analysis = analyzeBeam({
      length: 6,
      supports: [
        { id: "A", type: "pinned", x: 0 },
        { id: "B", type: "roller", x: 6 },
      ],
      forces: [{ id: "P", x: 3, fx: 10, fy: -10 }],
      couples: [],
      distributed: [],
    });
    if (!analysis.ok) throw new Error(analysis.message);
    const props = { analysis, stale: false, length: 6, onTab: () => {} };
    const { container, rerender } = render(<ResultsPanel {...props} tab={0} />);

    const assertLabelsAreReadable = () => {
      const labels = [...container.querySelectorAll(".diagram-label")];
      const xs = labels.map((label) => Number(label.getAttribute("x"))).sort((a, b) => a - b);
      expect(labels.length).toBeLessThanOrEqual(6);
      for (let index = 1; index < xs.length; index++) {
        const previous = xs[index - 1];
        const current = xs[index];
        if (previous !== undefined && current !== undefined && current - previous < 40)
          expect(current).toBe(previous);
      }
    };

    assertLabelsAreReadable();
    rerender(<ResultsPanel {...props} tab={2} />);
    assertLabelsAreReadable();
  });
});
